/**
 * File system storage adapter for trajectories
 *
 * Stores trajectories as JSON files in a .trajectories directory.
 * Active trajectories go in active/, completed in completed/YYYY-MM/.
 */

import { mkdir, readdir, readFile, writeFile, unlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { StorageAdapter, StorageConfig } from "./interface.js";
import type {
  Trajectory,
  TrajectorySummary,
  TrajectoryQuery,
} from "../core/types.js";
import { validateTrajectory } from "../core/schema.js";
import { exportToMarkdown } from "../export/markdown.js";

/**
 * Index file structure for quick lookups
 */
interface TrajectoryIndex {
  version: number;
  lastUpdated: string;
  trajectories: Record<
    string,
    {
      title: string;
      status: string;
      startedAt: string;
      completedAt?: string;
      path: string;
    }
  >;
}

/**
 * File system storage adapter
 */
export class FileStorage implements StorageAdapter {
  private baseDir: string;
  private trajectoriesDir: string;
  private activeDir: string;
  private completedDir: string;
  private indexPath: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
    this.trajectoriesDir = join(this.baseDir, ".trajectories");
    this.activeDir = join(this.trajectoriesDir, "active");
    this.completedDir = join(this.trajectoriesDir, "completed");
    this.indexPath = join(this.trajectoriesDir, "index.json");
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await mkdir(this.trajectoriesDir, { recursive: true });
    await mkdir(this.activeDir, { recursive: true });
    await mkdir(this.completedDir, { recursive: true });

    // Create index if it doesn't exist
    if (!existsSync(this.indexPath)) {
      await this.saveIndex({
        version: 1,
        lastUpdated: new Date().toISOString(),
        trajectories: {},
      });
    }
  }

  /**
   * Save a trajectory
   */
  async save(trajectory: Trajectory): Promise<void> {
    const isCompleted =
      trajectory.status === "completed" || trajectory.status === "abandoned";

    // Determine file path
    let filePath: string;
    if (isCompleted) {
      const date = new Date(trajectory.completedAt ?? trajectory.startedAt);
      const monthDir = join(
        this.completedDir,
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      );
      await mkdir(monthDir, { recursive: true });
      filePath = join(monthDir, `${trajectory.id}.json`);

      // Remove from active if it was there
      const activePath = join(this.activeDir, `${trajectory.id}.json`);
      if (existsSync(activePath)) {
        await unlink(activePath);
      }

      // Generate markdown summary for completed trajectories
      const mdPath = join(monthDir, `${trajectory.id}.md`);
      const markdown = exportToMarkdown(trajectory);
      await writeFile(mdPath, markdown, "utf-8");
    } else {
      filePath = join(this.activeDir, `${trajectory.id}.json`);
    }

    // Write trajectory file
    await writeFile(filePath, JSON.stringify(trajectory, null, 2), "utf-8");

    // Update index
    await this.updateIndex(trajectory, filePath);
  }

  /**
   * Get a trajectory by ID
   */
  async get(id: string): Promise<Trajectory | null> {
    // Check active first
    const activePath = join(this.activeDir, `${id}.json`);
    if (existsSync(activePath)) {
      return this.readTrajectoryFile(activePath);
    }

    // Check completed (need to search subdirectories)
    const index = await this.loadIndex();
    const entry = index.trajectories[id];
    if (entry?.path && existsSync(entry.path)) {
      return this.readTrajectoryFile(entry.path);
    }

    // Search completed directories manually if not in index
    try {
      const months = await readdir(this.completedDir);
      for (const month of months) {
        const filePath = join(this.completedDir, month, `${id}.json`);
        if (existsSync(filePath)) {
          return this.readTrajectoryFile(filePath);
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return null;
  }

  /**
   * Get the currently active trajectory
   */
  async getActive(): Promise<Trajectory | null> {
    try {
      const files = await readdir(this.activeDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) {
        return null;
      }

      // Get most recently started
      let mostRecent: Trajectory | null = null;
      let mostRecentTime = 0;

      for (const file of jsonFiles) {
        const trajectory = await this.readTrajectoryFile(
          join(this.activeDir, file)
        );
        if (trajectory) {
          const startTime = new Date(trajectory.startedAt).getTime();
          if (startTime > mostRecentTime) {
            mostRecentTime = startTime;
            mostRecent = trajectory;
          }
        }
      }

      return mostRecent;
    } catch {
      return null;
    }
  }

  /**
   * List trajectories with optional filtering
   */
  async list(query: TrajectoryQuery): Promise<TrajectorySummary[]> {
    const index = await this.loadIndex();
    let entries = Object.entries(index.trajectories);

    // Filter by status
    if (query.status) {
      entries = entries.filter(([, entry]) => entry.status === query.status);
    }

    // Filter by date range
    if (query.since) {
      const sinceTime = new Date(query.since).getTime();
      entries = entries.filter(
        ([, entry]) => new Date(entry.startedAt).getTime() >= sinceTime
      );
    }
    if (query.until) {
      const untilTime = new Date(query.until).getTime();
      entries = entries.filter(
        ([, entry]) => new Date(entry.startedAt).getTime() <= untilTime
      );
    }

    // Sort (default: startedAt desc)
    const sortBy = query.sortBy ?? "startedAt";
    const sortOrder = query.sortOrder ?? "desc";
    entries.sort((a, b) => {
      const aVal = a[1][sortBy as keyof typeof a[1]] ?? "";
      const bVal = b[1][sortBy as keyof typeof b[1]] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortOrder === "asc" ? cmp : -cmp;
    });

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    entries = entries.slice(offset, offset + limit);

    // Convert to summaries
    return Promise.all(
      entries.map(async ([id, entry]) => {
        // Load full trajectory to get counts
        const trajectory = await this.get(id);
        return {
          id,
          title: entry.title,
          status: entry.status as "active" | "completed" | "abandoned",
          startedAt: entry.startedAt,
          completedAt: entry.completedAt,
          confidence: trajectory?.retrospective?.confidence,
          chapterCount: trajectory?.chapters.length ?? 0,
          decisionCount:
            trajectory?.chapters.reduce(
              (count, chapter) =>
                count +
                chapter.events.filter((e) => e.type === "decision").length,
              0
            ) ?? 0,
        };
      })
    );
  }

  /**
   * Delete a trajectory
   */
  async delete(id: string): Promise<void> {
    // Remove from active
    const activePath = join(this.activeDir, `${id}.json`);
    if (existsSync(activePath)) {
      await unlink(activePath);
    }

    // Remove from completed (search subdirectories)
    const index = await this.loadIndex();
    const entry = index.trajectories[id];
    if (entry?.path && existsSync(entry.path)) {
      await unlink(entry.path);
      // Also remove markdown if exists
      const mdPath = entry.path.replace(".json", ".md");
      if (existsSync(mdPath)) {
        await unlink(mdPath);
      }
    }

    // Update index
    delete index.trajectories[id];
    await this.saveIndex(index);
  }

  /**
   * Search trajectories by text
   */
  async search(
    text: string,
    options?: { limit?: number }
  ): Promise<TrajectorySummary[]> {
    const allTrajectories = await this.list({});
    const searchLower = text.toLowerCase();
    const limit = options?.limit ?? 20;

    const matches: TrajectorySummary[] = [];

    for (const summary of allTrajectories) {
      if (matches.length >= limit) break;

      // Check title
      if (summary.title.toLowerCase().includes(searchLower)) {
        matches.push(summary);
        continue;
      }

      // Load full trajectory for deeper search
      const trajectory = await this.get(summary.id);
      if (!trajectory) continue;

      // Check retrospective
      if (
        trajectory.retrospective?.summary.toLowerCase().includes(searchLower)
      ) {
        matches.push(summary);
        continue;
      }

      // Check decisions
      const hasMatchingDecision = trajectory.chapters.some((chapter) =>
        chapter.events.some(
          (event) =>
            event.type === "decision" &&
            event.content.toLowerCase().includes(searchLower)
        )
      );
      if (hasMatchingDecision) {
        matches.push(summary);
      }
    }

    return matches;
  }

  /**
   * Close storage (no-op for file storage)
   */
  async close(): Promise<void> {
    // No cleanup needed for file storage
  }

  // Private helpers

  private async readTrajectoryFile(path: string): Promise<Trajectory | null> {
    try {
      const content = await readFile(path, "utf-8");
      const data = JSON.parse(content);
      const validation = validateTrajectory(data);
      if (validation.success) {
        return validation.data as Trajectory;
      }
      console.error(`Invalid trajectory at ${path}:`, validation.errors);
      return null;
    } catch (error) {
      console.error(`Failed to read trajectory at ${path}:`, error);
      return null;
    }
  }

  private async loadIndex(): Promise<TrajectoryIndex> {
    try {
      const content = await readFile(this.indexPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        trajectories: {},
      };
    }
  }

  private async saveIndex(index: TrajectoryIndex): Promise<void> {
    index.lastUpdated = new Date().toISOString();
    await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf-8");
  }

  private async updateIndex(
    trajectory: Trajectory,
    filePath: string
  ): Promise<void> {
    const index = await this.loadIndex();
    index.trajectories[trajectory.id] = {
      title: trajectory.task.title,
      status: trajectory.status,
      startedAt: trajectory.startedAt,
      completedAt: trajectory.completedAt,
      path: filePath,
    };
    await this.saveIndex(index);
  }
}
