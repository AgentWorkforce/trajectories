/**
 * File system storage adapter for trajectories
 *
 * Stores trajectories as JSON files in a .trajectories directory.
 * Active trajectories go in active/, completed in completed/YYYY-MM/.
 */

import { randomUUID } from "node:crypto";
import { type Dirent, existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { validateTrajectory } from "../core/schema.js";
import type {
  Trajectory,
  TrajectoryQuery,
  TrajectorySummary,
} from "../core/types.js";
import { exportToMarkdown } from "../export/markdown.js";
import type { StorageAdapter } from "./interface.js";

/**
 * Expand ~ to home directory in a path
 */
function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return join(process.env.HOME ?? "", path.slice(1));
  }
  return path;
}

/**
 * Get trajectory search paths from environment variable
 * TRAJECTORIES_SEARCH_PATHS is colon-separated (like PATH)
 * Falls back to current directory's .trajectories if not set
 */
export function getSearchPaths(): string[] {
  const searchPathsEnv = process.env.TRAJECTORIES_SEARCH_PATHS;
  if (searchPathsEnv) {
    return searchPathsEnv
      .split(":")
      .map((p) => p.trim())
      .filter(Boolean)
      .map(expandPath);
  }

  // Default: check for TRAJECTORIES_DATA_DIR, then fall back to ./.trajectories
  const dataDir = process.env.TRAJECTORIES_DATA_DIR;
  if (dataDir) {
    return [expandPath(dataDir)];
  }

  return [join(process.cwd(), ".trajectories")];
}

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
 * Tagged result from reading a trajectory file. Lets callers distinguish
 * missing files, malformed JSON, and schema violations so they can pick
 * their own policy (reconcile counts and moves on; `get()` returns null;
 * a future `getStrict()` could throw).
 */
export type ReadTrajectoryResult =
  | { ok: true; trajectory: Trajectory }
  | {
      ok: false;
      reason: "malformed_json" | "schema_violation" | "io_error";
      path: string;
      error: unknown;
    };

/**
 * Aggregated counts emitted by reconcileIndex for observability. Exposed
 * on the return value so tests and callers can assert on counts without
 * parsing log output.
 */
export interface ReconcileSummary {
  scanned: number;
  added: number;
  alreadyIndexed: number;
  skippedMalformedJson: number;
  skippedSchemaViolation: number;
  skippedIoError: number;
}

/**
 * Per-path promise-chain mutex for index.json access.
 *
 * Keyed by the absolute index path, so multiple FileStorage instances in
 * the same process that target the same `.trajectories` directory share
 * the same lock. This is an in-process mutex only — it does not protect
 * against writers in other processes. Cross-process safety is provided
 * by the atomic tmp-file + rename in `saveIndex` (rename is atomic on
 * POSIX, so readers never observe a half-written index).
 *
 * Implementation: store the tail of a promise chain per path. Each new
 * critical section chains onto `.then(task)` so it only runs after the
 * previous task resolves. We swallow errors on the tail so one failed
 * task doesn't poison the chain for subsequent callers.
 */
const indexLocks = new Map<string, Promise<unknown>>();

function withIndexLock<T>(path: string, task: () => Promise<T>): Promise<T> {
  const prev = indexLocks.get(path) ?? Promise.resolve();
  const next = prev.then(task, task);
  // Replace the tail with a swallowed-error version so a rejection in
  // `task` doesn't propagate to the next queued caller.
  indexLocks.set(
    path,
    next.catch(() => undefined),
  );
  return next;
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

    // Check for TRAJECTORIES_DATA_DIR env var first
    // When set, use the path directly (no .trajectories suffix)
    const dataDir = process.env.TRAJECTORIES_DATA_DIR;
    if (dataDir) {
      this.trajectoriesDir = expandPath(dataDir);
    } else {
      this.trajectoriesDir = join(this.baseDir, ".trajectories");
    }

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

    // Create index if it doesn't exist. Take the lock so a parallel
    // initialize() in the same process doesn't race its seed write.
    if (!existsSync(this.indexPath)) {
      await withIndexLock(this.indexPath, async () => {
        if (!existsSync(this.indexPath)) {
          await this.saveIndex(this.emptyIndex());
        }
      });
    }

    // Reconcile on-disk trajectories with the index. Self-heals cases where
    // files were written by a different process or an older layout that
    // bypassed updateIndex.
    await this.reconcileIndex();
  }

  /**
   * Scan active/ and completed/ recursively and add any trajectory files
   * missing from the index. Existing entries are preserved — reconcile
   * only adds, never removes.
   *
   * Handles three on-disk layouts in completed/:
   *   - flat:      completed/{id}.json         (legacy workforce data)
   *   - monthly:   completed/YYYY-MM/{id}.json (current save() writes)
   *   - nested:    completed/.../{id}.json     (defensive — any depth)
   *
   * Returns a ReconcileSummary so tests and CLI wrappers can observe
   * outcomes without parsing logs. Only writes the index if anything was
   * added.
   */
  async reconcileIndex(): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = {
      scanned: 0,
      added: 0,
      alreadyIndexed: 0,
      skippedMalformedJson: 0,
      skippedSchemaViolation: 0,
      skippedIoError: 0,
    };

    await withIndexLock(this.indexPath, async () => {
      const index = await this.loadIndex();
      const before = Object.keys(index.trajectories).length;

      const discovered: string[] = [];

      // Walk active/ — intentionally NOT recursive; active trajectories
      // always live at the flat root.
      try {
        const activeFiles = await readdir(this.activeDir);
        for (const file of activeFiles) {
          if (!file.endsWith(".json")) continue;
          discovered.push(join(this.activeDir, file));
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }

      // Walk completed/ recursively so we transparently support every
      // historical layout without guessing depth.
      await this.walkJsonFilesInto(this.completedDir, discovered);

      for (const filePath of discovered) {
        summary.scanned += 1;
        const result = await this.readTrajectoryFile(filePath);
        if (!result.ok) {
          if (result.reason === "malformed_json") {
            summary.skippedMalformedJson += 1;
          } else if (result.reason === "schema_violation") {
            summary.skippedSchemaViolation += 1;
          } else {
            summary.skippedIoError += 1;
          }
          continue;
        }
        const trajectory = result.trajectory;
        if (index.trajectories[trajectory.id]) {
          summary.alreadyIndexed += 1;
          continue;
        }
        index.trajectories[trajectory.id] = {
          title: trajectory.task.title,
          status: trajectory.status,
          startedAt: trajectory.startedAt,
          completedAt: trajectory.completedAt,
          path: filePath,
        };
        summary.added += 1;
      }

      if (Object.keys(index.trajectories).length !== before) {
        await this.saveIndex(index);
      }
    });

    // Only log when something interesting happened. Noise is worse than
    // silence here — the CLI spinner is the user's feedback.
    const hadSkips =
      summary.skippedMalformedJson +
        summary.skippedSchemaViolation +
        summary.skippedIoError >
      0;
    if (summary.added > 0 || hadSkips) {
      const parts = [`reconciled ${summary.added}/${summary.scanned}`];
      if (summary.skippedMalformedJson > 0) {
        parts.push(`malformed: ${summary.skippedMalformedJson}`);
      }
      if (summary.skippedSchemaViolation > 0) {
        parts.push(`invalid: ${summary.skippedSchemaViolation}`);
      }
      if (summary.skippedIoError > 0) {
        parts.push(`io: ${summary.skippedIoError}`);
      }
      console.warn(`[trajectories] ${parts.join(", ")}`);
    }

    return summary;
  }

  /**
   * Recursively collect all .json file paths under `dir` into `out`.
   * Silently treats a missing directory as empty.
   */
  private async walkJsonFilesInto(dir: string, out: string[]): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkJsonFilesInto(entryPath, out);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        out.push(entryPath);
      }
    }
  }

  /**
   * Save a trajectory.
   *
   * Validates the input against the trajectory schema before touching
   * disk. Closes the historical read/write asymmetry where save() would
   * happily write data that the reader then rejected, producing files
   * that could never be loaded back.
   */
  async save(input: Trajectory): Promise<void> {
    const validation = validateTrajectory(input);
    if (!validation.success) {
      const issues =
        validation.errors?.issues
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "root";
            return `${path}: ${issue.message}`;
          })
          .join("; ") ?? "unknown validation error";
      throw new Error(`Cannot save invalid trajectory: ${issues}`);
    }
    // Use the parsed (defaulted) trajectory so newly-written files
    // always carry normalized fields like commits/filesChanged/tags.
    const trajectory = validation.data as Trajectory;

    const isCompleted =
      trajectory.status === "completed" || trajectory.status === "abandoned";

    // Determine file path
    let filePath: string;
    if (isCompleted) {
      const date = new Date(trajectory.completedAt ?? trajectory.startedAt);
      const monthDir = join(
        this.completedDir,
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
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
      return this.readTrajectoryOrNull(activePath);
    }

    // Check completed (need to search subdirectories)
    const index = await this.loadIndex();
    const entry = index.trajectories[id];
    if (entry?.path && existsSync(entry.path)) {
      return this.readTrajectoryOrNull(entry.path);
    }

    // Search completed directories manually if not in index. Handles both
    // the flat `completed/{id}.json` layout (legacy) and the nested
    // `completed/YYYY-MM/{id}.json` layout written by save().
    try {
      const flatPath = join(this.completedDir, `${id}.json`);
      if (existsSync(flatPath)) {
        return this.readTrajectoryOrNull(flatPath);
      }
      const months = await readdir(this.completedDir);
      for (const month of months) {
        const filePath = join(this.completedDir, month, `${id}.json`);
        if (existsSync(filePath)) {
          return this.readTrajectoryOrNull(filePath);
        }
      }
    } catch (error) {
      // ENOENT means directory doesn't exist yet - this is expected
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Error searching completed trajectories:", error);
      }
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
        const trajectory = await this.readTrajectoryOrNull(
          join(this.activeDir, file),
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
    } catch (error) {
      // ENOENT means directory doesn't exist yet - this is expected
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      // Log unexpected errors for debugging
      console.error("Error reading active trajectories:", error);
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
        ([, entry]) => new Date(entry.startedAt).getTime() >= sinceTime,
      );
    }
    if (query.until) {
      const untilTime = new Date(query.until).getTime();
      entries = entries.filter(
        ([, entry]) => new Date(entry.startedAt).getTime() <= untilTime,
      );
    }

    // Sort (default: startedAt desc)
    const sortBy = query.sortBy ?? "startedAt";
    const sortOrder = query.sortOrder ?? "desc";
    entries.sort((a, b) => {
      const aVal = a[1][sortBy as keyof (typeof a)[1]] ?? "";
      const bVal = b[1][sortBy as keyof (typeof b)[1]] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortOrder === "asc" ? cmp : -cmp;
    });

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 500;
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
              0,
            ) ?? 0,
        };
      }),
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

    // Read + mutate + write the index under the lock so we can't clobber
    // a concurrent save's update.
    await withIndexLock(this.indexPath, async () => {
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
      delete index.trajectories[id];
      await this.saveIndex(index);
    });
  }

  /**
   * Search trajectories by text
   */
  async search(
    text: string,
    options?: { limit?: number },
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
            event.content.toLowerCase().includes(searchLower),
        ),
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

  /**
   * Read a trajectory file and return a tagged result so callers can
   * distinguish missing files, malformed JSON, and schema violations.
   *
   * Does NOT log. Callers choose whether to warn, swallow, or throw.
   */
  private async readTrajectoryFile(
    path: string,
  ): Promise<ReadTrajectoryResult> {
    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (error) {
      return { ok: false, reason: "io_error", path, error };
    }

    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (error) {
      return { ok: false, reason: "malformed_json", path, error };
    }

    const validation = validateTrajectory(data);
    if (validation.success) {
      return { ok: true, trajectory: validation.data as Trajectory };
    }
    return {
      ok: false,
      reason: "schema_violation",
      path,
      error: validation.errors,
    };
  }

  /**
   * Convenience wrapper for callers that only care whether they got a
   * trajectory. Returns null for any failure and writes nothing to the
   * console — so nothing leaks into test output or the CLI spinner.
   */
  private async readTrajectoryOrNull(path: string): Promise<Trajectory | null> {
    const result = await this.readTrajectoryFile(path);
    return result.ok ? result.trajectory : null;
  }

  /**
   * Read and parse the on-disk index.
   *
   * Tolerances (belt-and-braces against the read/write race):
   *   - ENOENT: first-run, return an empty index silently.
   *   - Empty file: a concurrent writer truncated index.json in "w" mode
   *     right before we read. Return an empty index silently — this is
   *     not a real corruption, just an interleaving the mutex + atomic
   *     rename should already prevent. Logging here would be noise.
   *   - Non-empty but malformed JSON: genuinely corrupted on disk (hand
   *     edit, disk error, etc). Log it and return an empty index so the
   *     caller can recover, but keep the log so the problem is visible.
   */
  private async loadIndex(): Promise<TrajectoryIndex> {
    let content: string;
    try {
      content = await readFile(this.indexPath, "utf-8");
    } catch (error) {
      // ENOENT means index doesn't exist yet - expected on first run.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(
          "Error loading trajectory index, using empty index:",
          error,
        );
      }
      return this.emptyIndex();
    }

    // Empty file == treat as empty index. Happens when readFile sneaks
    // in between a writer's truncate and its write. Defense in depth
    // against the race the in-process mutex already eliminates.
    if (content.length === 0) {
      return this.emptyIndex();
    }

    try {
      return JSON.parse(content) as TrajectoryIndex;
    } catch (error) {
      console.error(
        "Error loading trajectory index, using empty index:",
        error,
      );
      return this.emptyIndex();
    }
  }

  private emptyIndex(): TrajectoryIndex {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      trajectories: {},
    };
  }

  /**
   * Atomic write: stage into a process-unique temp path in the same directory
   * and then rename over the live file. `rename` is atomic on POSIX, so
   * concurrent readers in any process either see the old complete file or
   * the new complete file — never a half-written / zero-byte state.
   *
   * Callers MUST hold `withIndexLock(this.indexPath, ...)` so the in-process
   * read-modify-write cycle stays serialized; the unique temp name also keeps
   * parallel writers in other processes from colliding on a shared tmp path.
   */
  private async saveIndex(index: TrajectoryIndex): Promise<void> {
    index.lastUpdated = new Date().toISOString();
    const tmpPath = `${this.indexPath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tmpPath, JSON.stringify(index, null, 2), "utf-8");
    await rename(tmpPath, this.indexPath);
  }

  private async updateIndex(
    trajectory: Trajectory,
    filePath: string,
  ): Promise<void> {
    await withIndexLock(this.indexPath, async () => {
      const index = await this.loadIndex();
      index.trajectories[trajectory.id] = {
        title: trajectory.task.title,
        status: trajectory.status,
        startedAt: trajectory.startedAt,
        completedAt: trajectory.completedAt,
        path: filePath,
      };
      await this.saveIndex(index);
    });
  }
}
