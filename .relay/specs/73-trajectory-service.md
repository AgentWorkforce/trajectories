# trajectory-service.ts — Complete Implementation

Write this file to `trail-viewer/server/src/trajectory-service.ts`.

```typescript
import { TrajectoryClient } from "agent-trajectories/sdk";
import type {
  Trajectory,
  TrajectorySummary,
  TrajectoryStatus,
  TrajectoryQuery,
} from "agent-trajectories";

// ---------------------------------------------------------------------------
// Default data directory
// ---------------------------------------------------------------------------

const DEFAULT_DATA_DIR = "../../data";

// ---------------------------------------------------------------------------
// TrajectoryService
// ---------------------------------------------------------------------------

export class TrajectoryService {
  private client: TrajectoryClient;
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir =
      dataDir ?? process.env.TRAJECTORIES_DATA_DIR ?? DEFAULT_DATA_DIR;
    this.client = new TrajectoryClient({
      dataDir: this.dataDir,
      autoSave: false,
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    await this.client.init();
  }

  // -------------------------------------------------------------------------
  // List & filter
  // -------------------------------------------------------------------------

  async listTrajectories(query?: {
    status?: TrajectoryStatus;
    search?: string;
    tags?: string[];
  }): Promise<TrajectorySummary[]> {
    // Build a TrajectoryQuery from the subset the caller provides
    const clientQuery: TrajectoryQuery = {};
    if (query?.status) {
      clientQuery.status = query.status;
    }

    let results = await this.client.list(clientQuery);

    // Client-side filtering for fields the SDK query doesn't support natively
    if (query?.search) {
      const term = query.search.toLowerCase();
      // We need full trajectory data to search description — fetch each match
      const filtered: TrajectorySummary[] = [];
      for (const summary of results) {
        const traj = await this.client.get(summary.id);
        if (!traj) continue;
        const title = traj.task.title.toLowerCase();
        const description = (traj.task.description ?? "").toLowerCase();
        if (title.includes(term) || description.includes(term)) {
          filtered.push(summary);
        }
      }
      results = filtered;
    }

    if (query?.tags && query.tags.length > 0) {
      const requiredTags = query.tags;
      const filtered: TrajectorySummary[] = [];
      for (const summary of results) {
        const traj = await this.client.get(summary.id);
        if (!traj) continue;
        const hasAll = requiredTags.every((t) => traj.tags.includes(t));
        if (hasAll) {
          filtered.push(summary);
        }
      }
      results = filtered;
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Single trajectory
  // -------------------------------------------------------------------------

  async getTrajectory(id: string): Promise<Trajectory | null> {
    return this.client.get(id);
  }

  // -------------------------------------------------------------------------
  // Full-text search
  // -------------------------------------------------------------------------

  async searchTrajectories(text: string): Promise<TrajectorySummary[]> {
    // The SDK search already searches across titles, descriptions, chapters,
    // and event content with case-insensitive matching.
    return this.client.search(text);
  }

  // -------------------------------------------------------------------------
  // Export: Markdown
  // -------------------------------------------------------------------------

  async getTrajectoryMarkdown(id: string): Promise<string> {
    const md = await this.client.exportMarkdown(id);
    return md ?? "";
  }

  // -------------------------------------------------------------------------
  // Export: Timeline
  // -------------------------------------------------------------------------

  async getTrajectoryTimeline(id: string): Promise<string> {
    const timeline = await this.client.exportTimeline(id);
    return timeline ?? "";
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  async getStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    abandoned: number;
  }> {
    const all = await this.client.list();
    const stats = { total: all.length, active: 0, completed: 0, abandoned: 0 };
    for (const t of all) {
      if (t.status === "active") stats.active++;
      else if (t.status === "completed") stats.completed++;
      else if (t.status === "abandoned") stats.abandoned++;
    }
    return stats;
  }
}

export default TrajectoryService;
```

## Implementation notes

- **Imports**: `TrajectoryClient` comes from `agent-trajectories/sdk` (the sub-path export). Core types (`Trajectory`, `TrajectorySummary`, `TrajectoryStatus`, `TrajectoryQuery`) come from the root `agent-trajectories` package.
- **Read-only mode**: `autoSave: false` ensures the service never mutates stored trajectories.
- **`listTrajectories`**: Delegates `status` filtering to the SDK's native `TrajectoryQuery`. For `search` and `tags` filtering (not supported natively by `TrajectoryQuery`), it fetches full trajectory objects and filters client-side.
- **`searchTrajectories`**: Uses the SDK's built-in `client.search()` which already does case-insensitive full-text search across titles, descriptions, chapter names, and event content.
- **`getTrajectoryMarkdown` / `getTrajectoryTimeline`**: Wraps the SDK's `exportMarkdown` / `exportTimeline` methods, returning empty string instead of null for convenience.
- **`getStats`**: Fetches full list once and counts by status.
- **`TrajectorySummary`** shape from the SDK: `{ id, title, status, startedAt, completedAt?, confidence?, chapterCount, decisionCount }`. Note: it does not include `tags` — the tags filter in `listTrajectories` fetches the full `Trajectory` to check.
