import { Hono } from "hono";
import type { ChatService } from "../chat-service";
import { formatTrajectoryForAgent } from "../trajectory-formatter";
import type { TrajectoryService } from "../trajectory-service";

export function createChatRoutes(
  chatService: ChatService,
  trajectoryService: TrajectoryService,
): Hono {
  const app = new Hono();

  // POST /chat/start
  app.post("/chat/start", async (c) => {
    try {
      const { trajectoryId, personas, preferredCLI } = await c.req.json<{
        trajectoryId: string;
        personas: string[];
        preferredCLI?: string;
      }>();

      const trajectory = await trajectoryService.getTrajectory(trajectoryId);
      if (!trajectory) {
        return c.json({ error: "Trajectory not found" }, 404);
      }

      const context = formatTrajectoryForAgent(trajectory);
      const sessionId = await chatService.startSession(
        trajectoryId,
        context,
        personas,
        preferredCLI,
      );

      return c.json({ sessionId }, 200);
    } catch (err) {
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // POST /chat/message
  app.post("/chat/message", async (c) => {
    try {
      const { sessionId, message, personas } = await c.req.json<{
        sessionId: string;
        message: string;
        personas: string[];
      }>();

      await chatService.sendMessage(sessionId, message, personas);
      return c.json({ ok: true }, 200);
    } catch (err) {
      if (err instanceof Error && err.message === "Session not found") {
        return c.json({ error: "Session not found" }, 404);
      }
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // POST /chat/stop
  app.post("/chat/stop", async (c) => {
    try {
      const { sessionId } = await c.req.json<{ sessionId: string }>();

      await chatService.stopSession(sessionId);
      return c.json({ ok: true }, 200);
    } catch (err) {
      if (err instanceof Error && err.message === "Session not found") {
        return c.json({ error: "Session not found" }, 404);
      }
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // POST /chat/persona/add
  app.post("/chat/persona/add", async (c) => {
    try {
      const { sessionId, personaId } = await c.req.json<{
        sessionId: string;
        personaId: string;
      }>();

      await chatService.addPersona(sessionId, personaId);
      return c.json({ ok: true }, 200);
    } catch (err) {
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // POST /chat/persona/remove
  app.post("/chat/persona/remove", async (c) => {
    try {
      const { sessionId, personaId } = await c.req.json<{
        sessionId: string;
        personaId: string;
      }>();

      await chatService.removePersona(sessionId, personaId);
      return c.json({ ok: true }, 200);
    } catch (err) {
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // GET /personas
  app.get("/personas", async (c) => {
    try {
      const personas = chatService.getPersonas();
      return c.json(personas, 200);
    } catch (err) {
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  return app;
}
