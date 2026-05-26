import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
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

const DEFAULT_DATA_DIR = "../..";
const DEFAULT_TRAJECTORY_DATA_DIR = join(".agentworkforce", "trajectories");

function isTrajectoryDataDir(path: string): boolean {
  const normalized = path.replace(/[\\/]+$/, "");
  return (
    normalized.endsWith(DEFAULT_TRAJECTORY_DATA_DIR) ||
    existsSync(join(path, "active")) ||
    existsSync(join(path, "completed")) ||
    existsSync(join(path, "index.json"))
  );
}

function resolveTrajectoryDataDir(path: string): string {
  if (isTrajectoryDataDir(path)) {
    return path;
  }

  return join(path, DEFAULT_TRAJECTORY_DATA_DIR);
}

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
    // Suppress SDK validation noise during init
    const origError = console.error;
    console.error = () => {};
    try {
      await this.client.init();
    } finally {
      console.error = origError;
    }
    await this.rebuildIndex();
  }

  /**
   * Switch to a different data directory at runtime.
   */
  async switchDataDir(newDataDir: string): Promise<void> {
    this.dataDir = newDataDir;
    // Set env var so FileStorageProvider picks it up
    process.env.TRAJECTORIES_DATA_DIR = resolveTrajectoryDataDir(newDataDir);
    this.client = new TrajectoryClient({
      dataDir: newDataDir,
      autoSave: false,
    });
    await this.client.init();
    await this.rebuildIndex();
  }

  /**
   * Scan disk for trajectory files not in the index and register them.
   */
  private async rebuildIndex(): Promise<void> {
    // Get already-indexed IDs
    const indexed = await this.client.list();
    const indexedIds = new Set(indexed.map((t) => t.id));

    // Resolve the trajectory data directory
    const dataDir = process.env.TRAJECTORIES_DATA_DIR;
    const trajDir = dataDir ?? join(this.dataDir, DEFAULT_TRAJECTORY_DATA_DIR);
    const completedDir = join(trajDir, "completed");
    const activeDir = join(trajDir, "active");
    const indexPath = join(trajDir, "index.json");

    const allNewEntries: Record<
      string,
      {
        title: string;
        status: string;
        startedAt: string;
        completedAt?: string;
        path: string;
      }
    > = {};
    let discovered = 0;

    // Scan completed directory (may have subdirs like 2026-01/)
    if (existsSync(completedDir)) {
      const result = await this.scanDir(completedDir, indexedIds);
      discovered += result.count;
      Object.assign(allNewEntries, result.entries);
    }

    // Scan active directory
    if (existsSync(activeDir)) {
      const result = await this.scanDir(activeDir, indexedIds);
      discovered += result.count;
      Object.assign(allNewEntries, result.entries);
    }

    // Read existing index
    let index: {
      version: number;
      lastUpdated: string;
      trajectories: Record<string, unknown>;
    };
    try {
      const content = await readFile(indexPath, "utf-8");
      index = JSON.parse(content);
    } catch {
      index = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        trajectories: {},
      };
    }

    // Remove any trace_ entries that shouldn't be in the index
    let cleaned = false;
    for (const key of Object.keys(index.trajectories)) {
      if (key.startsWith("trace_")) {
        delete index.trajectories[key];
        cleaned = true;
      }
    }

    if (discovered > 0 || cleaned) {
      Object.assign(index.trajectories, allNewEntries);
      index.lastUpdated = new Date().toISOString();
      const { writeFile: writeFileAsync } = await import("node:fs/promises");
      await writeFileAsync(indexPath, JSON.stringify(index, null, 2), "utf-8");

      // Re-init the client to pick up the new index.
      // Suppress console.error during init — the SDK logs validation warnings
      // for trajectories that don't match its strict schema.
      const origError = console.error;
      console.error = () => {};
      try {
        this.client = new TrajectoryClient({
          dataDir: this.dataDir,
          autoSave: false,
        });
        await this.client.init();
      } finally {
        console.error = origError;
      }

      console.log(
        `Indexed ${discovered} new trajectories (${Object.keys(index.trajectories).length} total)`,
      );
    }
  }

  private async scanDir(
    dir: string,
    indexedIds: Set<string>,
  ): Promise<{
    count: number;
    entries: Record<
      string,
      {
        title: string;
        status: string;
        startedAt: string;
        completedAt?: string;
        path: string;
      }
    >;
  }> {
    let count = 0;
    const newEntries: Record<
      string,
      {
        title: string;
        status: string;
        startedAt: string;
        completedAt?: string;
        path: string;
      }
    > = {};
    const dirEntries = await readdir(dir, { withFileTypes: true });

    for (const entry of dirEntries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await this.scanDir(fullPath, indexedIds);
        count += sub.count;
        Object.assign(newEntries, sub.entries);
      } else if (
        entry.name.endsWith(".json") &&
        !entry.name.includes(".trace.json") &&
        entry.name.startsWith("traj_") &&
        !entry.name.startsWith("trace_")
      ) {
        const id = entry.name.replace(".json", "");
        if (!indexedIds.has(id)) {
          try {
            const content = await readFile(fullPath, "utf-8");
            const data = JSON.parse(content);
            if (data.id) {
              const title = data.task?.title ?? data.title ?? data.id;
              newEntries[data.id] = {
                title,
                status: data.status ?? "completed",
                startedAt: data.startedAt ?? new Date().toISOString(),
                completedAt: data.completedAt,
                path: fullPath,
              };
              indexedIds.add(data.id);
              count++;
            }
          } catch {
            // Skip invalid files
          }
        }
      }
    }

    return { count, entries: newEntries };
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

    // Suppress SDK validation noise for trajectories that don't match strict schema
    const origError = console.error;
    console.error = () => {};
    let results: TrajectorySummary[];
    try {
      results = await this.client.list(clientQuery);
    } finally {
      console.error = origError;
    }

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
    // Suppress SDK validation noise
    const origError = console.error;
    console.error = () => {};
    let result: Trajectory | null;
    try {
      result = await this.client.get(id);
    } finally {
      console.error = origError;
    }

    if (result) return result;

    // Fallback: read the raw JSON file directly (bypasses strict validation)
    const dataDir = process.env.TRAJECTORIES_DATA_DIR;
    const trajDir = dataDir ?? join(this.dataDir, DEFAULT_TRAJECTORY_DATA_DIR);
    const indexPath = join(trajDir, "index.json");

    try {
      const indexContent = await readFile(indexPath, "utf-8");
      const index = JSON.parse(indexContent);
      const entry = index.trajectories?.[id];
      if (entry?.path && existsSync(entry.path)) {
        const content = await readFile(entry.path, "utf-8");
        return JSON.parse(content) as Trajectory;
      }
    } catch {
      // Fall through
    }

    // Search directories manually
    for (const subdir of ["active", "completed"]) {
      const dir = join(trajDir, subdir);
      if (!existsSync(dir)) continue;
      const found = await this.findFileRecursive(dir, `${id}.json`);
      if (found) {
        try {
          const content = await readFile(found, "utf-8");
          return JSON.parse(content) as Trajectory;
        } catch {
          // Skip
        }
      }
    }

    return null;
  }

  private async findFileRecursive(
    dir: string,
    filename: string,
  ): Promise<string | null> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await this.findFileRecursive(fullPath, filename);
        if (found) return found;
      } else if (entry.name === filename) {
        return fullPath;
      }
    }
    return null;
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
