import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config, healthHandler } from "./health.js";

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use("*", cors());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health
app.get("/health", (c) => c.json(healthHandler()));

// Trajectories
const trajectories = new Hono();

trajectories.get("/", (c) => {
  // TODO: list trajectories
  return c.json({ trajectories: [] });
});

trajectories.get("/:id", (c) => {
  const id = c.req.param("id");
  // TODO: get trajectory by id
  return c.json({ id, trajectory: null });
});

app.route("/api/trajectories", trajectories);

// Chat
const chat = new Hono();

chat.post("/sessions", (c) => {
  // TODO: create chat session
  return c.json({ session: null }, 201);
});

chat.post("/sessions/:id/messages", (c) => {
  const id = c.req.param("id");
  // TODO: post message to session
  return c.json({ sessionId: id, message: null }, 201);
});

app.route("/api/chat", chat);

// Personas
const personas = new Hono();

personas.get("/", (c) => {
  // TODO: list personas
  return c.json({ personas: [] });
});

app.route("/api/personas", personas);

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error(`[server] unhandled error: ${err.message}`);
  return c.json({ error: "Internal Server Error" }, 500);
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

const server = serve(
  {
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  },
  (info: AddressInfo) => {
    console.log(
      `[trail-viewer] server listening on http://${info.address}:${info.port} (pid ${process.pid})`,
    );
  },
);

function shutdown(signal: string) {
  console.log(`\n[trail-viewer] received ${signal}, shutting down...`);
  server.close(() => {
    console.log("[trail-viewer] server closed");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ---------------------------------------------------------------------------
// Export for testing
// ---------------------------------------------------------------------------

export { app };
