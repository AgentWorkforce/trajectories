import type {
  Trajectory,
  TrajectoryQuery,
  TrajectoryStatus,
  TrajectorySummary,
} from "agent-trajectories";
import { TrajectoryClient } from "agent-trajectories/sdk";

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
    const clientQuery: TrajectoryQuery = {};

    if (query?.status) {
      clientQuery.status = query.status;
    }

    let results = await this.client.list(clientQuery);

    if (query?.search) {
      const term = query.search.toLowerCase();
      const filtered: TrajectorySummary[] = [];

      for (const summary of results) {
        const traj = await this.client.get(summary.id);
        if (!traj) {
          continue;
        }

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
        if (!traj) {
          continue;
        }

        const hasAll = requiredTags.every((tag) => traj.tags.includes(tag));
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
      if (t.status === "active") {
        stats.active++;
      } else if (t.status === "completed") {
        stats.completed++;
      } else if (t.status === "abandoned") {
        stats.abandoned++;
      }
    }

    return stats;
  }
}

export default TrajectoryService;
