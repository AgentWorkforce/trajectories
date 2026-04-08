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
      const body = await c.req.json();
      // Accept both camelCase and snake_case (Swift client uses convertToSnakeCase)
      const trajectoryId = body.trajectoryId ?? body.trajectory_id;
      const personas: string[] = body.personas ?? [];
      const preferredCLI: string | undefined =
        body.preferredCLI ?? body.preferred_cli;

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

      return c.json({ session_id: sessionId }, 200);
    } catch (err) {
      console.error("[chat/start] Error:", err);
      const message =
        err instanceof Error ? err.message : "Internal server error";
      return c.json({ error: message }, 500);
    }
  });

  // POST /chat/message
  app.post("/chat/message", async (c) => {
    try {
      const body = await c.req.json();
      const sessionId = body.sessionId ?? body.session_id;
      const message = body.message;
      const personas: string[] = body.personas ?? [];

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
      const body = await c.req.json();
      const sessionId = body.sessionId ?? body.session_id;

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
      const body = await c.req.json();
      const sessionId = body.sessionId ?? body.session_id;
      const personaId = body.personaId ?? body.persona_id;

      await chatService.addPersona(sessionId, personaId);
      return c.json({ ok: true }, 200);
    } catch (err) {
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // POST /chat/persona/remove
  app.post("/chat/persona/remove", async (c) => {
    try {
      const body = await c.req.json();
      const sessionId = body.sessionId ?? body.session_id;
      const personaId = body.personaId ?? body.persona_id;

      await chatService.removePersona(sessionId, personaId);
      return c.json({ ok: true }, 200);
    } catch (err) {
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // GET /chat/personas
  app.get("/chat/personas", async (c) => {
    try {
      const personas = chatService.getPersonas();
      return c.json(personas, 200);
    } catch (err) {
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  return app;
}
