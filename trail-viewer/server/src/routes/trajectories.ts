import { Hono } from "hono";
import type { TrajectoryService } from "../trajectory-service.js";

/**
 * Factory that creates the /trajectories + /stats route group.
 * Mounted at /api by the main server, so:
 *   GET /api/trajectories
 *   GET /api/trajectories/:id
 *   GET /api/stats
 */
export function createTrajectoryRoutes(service: TrajectoryService): Hono {
  const trajectories = new Hono();

  // -----------------------------------------------------------------------
  // GET /trajectories
  // -----------------------------------------------------------------------
  trajectories.get("/trajectories", async (c) => {
    try {
      const status = c.req.query("status") || undefined;
      const search = c.req.query("search") || undefined;
      const tagsRaw = c.req.query("tags");
      const tags = tagsRaw
        ? tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      const results = await service.listTrajectories({ status, search, tags });
      return c.json(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[trajectories] GET /trajectories error:", message);
      return c.json({ error: message }, 500);
    }
  });

  // -----------------------------------------------------------------------
  // GET /trajectories/:id
  // -----------------------------------------------------------------------
  trajectories.get("/trajectories/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const trajectory = await service.getTrajectory(id);

      if (!trajectory) {
        return c.json({ error: "Trajectory not found" }, 404);
      }

      return c.json(trajectory);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[trajectories] GET /trajectories/${c.req.param("id")} error:`,
        message,
      );
      return c.json({ error: message }, 500);
    }
  });

  // -----------------------------------------------------------------------
  // GET /stats
  // -----------------------------------------------------------------------
  trajectories.get("/stats", async (c) => {
    try {
      const stats = await service.getStats();
      return c.json(stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[trajectories] GET /stats error:", message);
      return c.json({ error: message }, 500);
    }
  });

  return trajectories;
}

export default createTrajectoryRoutes;
