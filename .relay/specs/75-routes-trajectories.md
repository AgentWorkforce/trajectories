# Spec: trajectories.ts (Hono Route Group)

**File path:** `trail-viewer/server/src/routes/trajectories.ts`

## Complete TypeScript File

```typescript
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
        ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
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
      console.error(`[trajectories] GET /trajectories/${c.req.param("id")} error:`, message);
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
```

## Integration Notes

### How main server.ts should use this

```typescript
import { createTrajectoryRoutes } from "./routes/trajectories.js";
import { TrajectoryService } from "./trajectory-service.js";

const service = new TrajectoryService(/* config */);
const trajectoryRoutes = createTrajectoryRoutes(service);

// Mount at /api — routes inside define /trajectories and /stats
app.route("/api", trajectoryRoutes);
```

### TrajectoryService contract (expected interface)

The route file imports `TrajectoryService` from `../trajectory-service.js`. That service must expose:

```typescript
export class TrajectoryService {
  listTrajectories(opts: {
    status?: string;
    search?: string;
    tags?: string[];
  }): Promise<TrajectorySummary[]>;

  getTrajectory(id: string): Promise<Trajectory | null>;

  getStats(): Promise<TrajectoryStats>;
}
```

Where `TrajectorySummary` and `Trajectory` come from the core types (`src/core/types.ts`), and `TrajectoryStats` is a new type the service defines (e.g., total count, status breakdown, tag distribution).

### Key design decisions

1. **Factory pattern (`createTrajectoryRoutes`)** — enables dependency injection of the service, making routes testable without real storage.
2. **Routes define `/trajectories` and `/stats` paths** — the `/api` prefix comes from the mount point in `server.ts`, not from the route file itself.
3. **All handlers are async** — service calls return Promises.
4. **Consistent error handling** — every route wraps in try/catch, extracts error message safely, logs to console, returns 500 with `{ error }` JSON.
5. **Tags parsed from comma-separated string** — `?tags=foo,bar` becomes `["foo", "bar"]`, with trimming and empty-string filtering.
6. **Query params coerced** — empty strings from missing query params converted to `undefined` so the service can distinguish "no filter" from "empty filter".
