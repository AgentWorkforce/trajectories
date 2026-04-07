import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ChatService } from "./chat-service";
import { RelayBridge } from "./relay-bridge";
import { createChatRoutes } from "./routes/chat";
import { createExportRoutes } from "./routes/exports";
import { createTrajectoryRoutes } from "./routes/trajectories";
import { TrajectoryService } from "./trajectory-service";

const PORT = Number.parseInt(process.env.PORT || "3847", 10);

async function main() {
  // 1. Initialize TrajectoryService
  const trajectoryService = new TrajectoryService();
  await trajectoryService.init();
  console.log("Trajectory service initialized");

  // 2. Create ChatService
  const chatService = new ChatService();

  // 3. Create Hono app
  const app = new Hono();
  app.use("/*", cors());

  // 4. Health check
  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() }),
  );

  // 5. Switch data directory endpoint
  app.post("/api/config/data-dir", async (c) => {
    const body = await c.req.json<{ path: string }>();
    if (!body.path) {
      return c.json({ error: "path is required" }, 400);
    }
    try {
      await trajectoryService.switchDataDir(body.path);
      const list = await trajectoryService.listTrajectories();
      return c.json({ ok: true, trajectoryCount: list.length });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // 6. Mount route groups
  app.route("/api", createTrajectoryRoutes(trajectoryService));
  app.route("/api", createExportRoutes(trajectoryService));
  app.route("/api", createChatRoutes(chatService, trajectoryService));

  // 6. Start server
  const server = serve({ fetch: app.fetch, port: PORT });

  // 7. Attach RelayBridge
  const bridge = new RelayBridge(server, chatService, trajectoryService);

  // 8. Startup banner
  console.log("=".repeat(50));
  console.log("Trail Viewer Server");
  console.log(`Port: ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`API: http://localhost:${PORT}/api/trajectories`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log("=".repeat(50));

  // 9. Graceful shutdown
  process.on("SIGINT", async () => {
    bridge.close();
    server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    bridge.close();
    server.close();
    process.exit(0);
  });
}

main();
