import type { Server as HTTPServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { ChatService } from "./chat-service";
import { PERSONAS } from "./personas";
import { formatTrajectoryForAgent } from "./trajectory-formatter";
import type { TrajectoryService } from "./trajectory-service";
import type {
  AgentMessageEvent,
  ClientToServerMessage,
  ErrorEvent,
  ServerToClientMessage,
  SessionStartedEvent,
  TypingEvent,
} from "./ws-types";
import { isClientMessage } from "./ws-types";

export class RelayBridge {
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;
  private chatService: ChatService;
  private trajectoryService: TrajectoryService;

  constructor(
    httpServer: HTTPServer,
    chatService: ChatService,
    trajectoryService: TrajectoryService,
  ) {
    this.chatService = chatService;
    this.trajectoryService = trajectoryService;
    this.clients = new Set();

    this.wss = new WebSocketServer({ server: httpServer, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log(
        `[relay-bridge] WebSocket client connected (total: ${this.clients.size + 1})`,
      );
      this.clients.add(ws);

      ws.on("message", (data: Buffer | string) => {
        this.handleClientMessage(ws, data);
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (err: Error) => {
        console.error("[RelayBridge] WebSocket error:", err.message);
        this.clients.delete(ws);
      });
    });

    // Wire ChatService callbacks
    this.chatService.onMessage((message) => {
      const persona = message.persona
        ? {
            id: message.persona.id,
            name: message.persona.name,
            emoji: message.persona.emoji,
            color: message.persona.color,
          }
        : null;
      const event: AgentMessageEvent = {
        type: "agent_message",
        from: message.from,
        content: message.content,
        persona,
        timestamp: message.timestamp.toISOString(),
      };
      this.broadcast(event);
    });

    this.chatService.onTyping((personaId: string, isTyping: boolean) => {
      const event: TypingEvent = {
        type: "typing",
        persona: personaId,
        isTyping,
      };
      this.broadcast(event);
    });
  }

  private async handleClientMessage(
    ws: WebSocket,
    raw: Buffer | string,
  ): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        typeof raw === "string" ? raw : raw.toString("utf-8"),
      );
    } catch {
      const error: ErrorEvent = {
        type: "error",
        message: "Invalid JSON",
        code: "PARSE_ERROR",
      };
      ws.send(JSON.stringify(error));
      return;
    }

    if (!isClientMessage(parsed)) {
      const error: ErrorEvent = {
        type: "error",
        message: "Invalid message format",
        code: "VALIDATION_ERROR",
      };
      ws.send(JSON.stringify(error));
      return;
    }

    const message = parsed as ClientToServerMessage;

    switch (message.type) {
      case "start_session": {
        try {
          const trajectory = await this.trajectoryService.getTrajectory(
            message.trajectoryId,
          );
          if (!trajectory) {
            const error: ErrorEvent = {
              type: "error",
              message: `Trajectory not found: ${message.trajectoryId}`,
              code: "NOT_FOUND",
            };
            ws.send(JSON.stringify(error));
            return;
          }
          const context = formatTrajectoryForAgent(trajectory);
          const sessionId = await this.chatService.startSession(
            message.trajectoryId,
            context,
            message.personas,
            message.preferredCLI,
          );
          const personas = Object.values(PERSONAS).map((p) => ({
            id: p.id,
            name: p.name,
            emoji: p.emoji,
            description: p.description,
            color: p.color,
          }));
          const event: SessionStartedEvent = {
            type: "session_started",
            sessionId,
            personas,
          };
          ws.send(JSON.stringify(event));
        } catch (err) {
          const error: ErrorEvent = {
            type: "error",
            message:
              err instanceof Error ? err.message : "Failed to start session",
            code: "SESSION_ERROR",
          };
          ws.send(JSON.stringify(error));
        }
        break;
      }

      case "send_message": {
        try {
          await this.chatService.sendMessage(
            message.sessionId,
            message.text,
            message.personas,
          );
        } catch (err) {
          const error: ErrorEvent = {
            type: "error",
            message:
              err instanceof Error ? err.message : "Failed to send message",
            code: "MESSAGE_ERROR",
          };
          ws.send(JSON.stringify(error));
        }
        break;
      }

      case "stop_session": {
        try {
          await this.chatService.stopSession(message.sessionId);
        } catch (err) {
          const error: ErrorEvent = {
            type: "error",
            message:
              err instanceof Error ? err.message : "Failed to stop session",
            code: "SESSION_ERROR",
          };
          ws.send(JSON.stringify(error));
        }
        break;
      }

      case "add_persona": {
        try {
          await this.chatService.addPersona(
            message.sessionId,
            message.personaId,
          );
        } catch (err) {
          const error: ErrorEvent = {
            type: "error",
            message:
              err instanceof Error ? err.message : "Failed to add persona",
            code: "PERSONA_ERROR",
          };
          ws.send(JSON.stringify(error));
        }
        break;
      }

      case "remove_persona": {
        try {
          await this.chatService.removePersona(
            message.sessionId,
            message.personaId,
          );
        } catch (err) {
          const error: ErrorEvent = {
            type: "error",
            message:
              err instanceof Error ? err.message : "Failed to remove persona",
            code: "PERSONA_ERROR",
          };
          ws.send(JSON.stringify(error));
        }
        break;
      }
    }
  }

  private broadcast(data: ServerToClientMessage): void {
    console.log(
      `[relay-bridge] broadcasting type=${data.type} to ${this.clients.size} clients`,
    );
    const json = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(json);
      } else {
        this.clients.delete(client);
      }
    }
  }

  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss.close();
  }
}
