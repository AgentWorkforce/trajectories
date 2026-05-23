/**
 * File system storage adapter for trajectories
 *
 * Stores each trajectory in its own directory under .trajectories.
 * Active trajectories go in active/<id>/, completed in completed/YYYY-MM/<id>/.
 */

import { type Dirent, existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import type { z } from "zod";
import { validateTrajectory } from "../core/schema.js";
import type {
  Trajectory,
  TrajectoryQuery,
  TrajectorySummary,
} from "../core/types.js";
import { exportToMarkdown } from "../export/markdown.js";
import type { StorageAdapter } from "./interface.js";

const TRAJECTORY_FILE = "trajectory.json";
const SUMMARY_FILE = "summary.md";
const COMPACTION_FILE = "compaction.json";
const LEGACY_COMPACTION_SUFFIX = ".compaction.json";

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

interface CompactionMarker {
  trajectoryId: string;
  compactedInto: string;
  compactedAt: string;
}

export interface DeleteTrajectorySummary {
  removedTrajectories: number;
  deletedJsonFiles: number;
  deletedMarkdownFiles: number;
  deletedTraceFiles: number;
  deletedCompactionFiles: number;
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
 * Reason a single trajectory file was skipped during reconcile.
 */
export type ReconcileFailureReason =
  | "malformed_json"
  | "schema_violation"
  | "io_error";

/**
 * Per-file failure record for a skipped trajectory. `message` is a
 * pre-rendered, single-line description suitable for direct display in
 * CLI output — callers should not have to know about Zod or fs error
 * shapes to render diagnostics.
 */
export interface ReconcileFailure {
  path: string;
  reason: ReconcileFailureReason;
  message: string;
}

/**
 * Aggregated counts emitted by reconcileIndex for observability. Exposed
 * on the return value so tests and callers can assert on counts without
 * parsing log output. `failures` carries the per-file detail so a CLI
 * doctor or `--verbose` mode can print actionable info without re-walking
 * the directory tree.
 */
export interface ReconcileSummary {
  scanned: number;
  added: number;
  alreadyIndexed: number;
  skippedMalformedJson: number;
  skippedSchemaViolation: number;
  skippedIoError: number;
  failures: ReconcileFailure[];
}

/**
 * Render a read failure into a single-line, human-readable message.
 * Knows enough about Zod and Node's fs errors to extract the most
 * useful field; falls back to String(error) for anything else.
 */
function describeReadFailure(
  reason: ReconcileFailureReason,
  error: unknown,
): string {
  if (
    reason === "schema_violation" &&
    error &&
    typeof error === "object" &&
    "issues" in error
  ) {
    const issues = (error as z.ZodError).issues ?? [];
    if (issues.length > 0) {
      const first = issues[0];
      const where = first.path.length > 0 ? first.path.join(".") : "root";
      const extra = issues.length > 1 ? ` (+${issues.length - 1} more)` : "";
      return `${where}: ${first.message}${extra}`;
    }
    return "schema validation failed";
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * File system storage adapter
 */
export class FileStorage implements StorageAdapter {
  private baseDir: string;
  private trajectoriesDir: string;
  private activeDir: string;
  private completedDir: string;
  private lastReconcileSummary?: ReconcileSummary;

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
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await mkdir(this.trajectoriesDir, { recursive: true });
    await mkdir(this.activeDir, { recursive: true });
    await mkdir(this.completedDir, { recursive: true });

    await this.migrateLegacyIndexCompactionMarkers();
    await rm(join(this.trajectoriesDir, "index.json"), { force: true });

    // Scan on-disk trajectories so status/doctor can surface invalid files.
    await this.reconcileIndex();
  }

  /**
   * Scan active/ and completed/ recursively and report trajectory files
   * that can be loaded plus files that should be surfaced by doctor.
   *
   * Handles three on-disk layouts in completed/:
   *   - flat:      completed/{id}.json         (legacy workforce data)
   *   - monthly:   completed/YYYY-MM/{id}.json (legacy monthly layout)
   *   - directory: completed/YYYY-MM/{id}/trajectory.json (current layout)
   *   - nested:    completed/.../{id}.json     (defensive — any depth)
   *
   * The method name is kept for callers such as `trail doctor`, but no
   * shared index file is written.
   */
  async reconcileIndex(): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = {
      scanned: 0,
      added: 0,
      alreadyIndexed: 0,
      skippedMalformedJson: 0,
      skippedSchemaViolation: 0,
      skippedIoError: 0,
      failures: [],
    };

    const discovered = await this.listTrajectoryFiles();

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
        summary.failures.push({
          path: result.path,
          reason: result.reason,
          message: describeReadFailure(result.reason, result.error),
        });
        continue;
      }
      summary.added += 1;
    }

    // Only log when something interesting happened. Noise is worse than
    // silence here — the CLI spinner is the user's feedback.
    const hadSkips =
      summary.skippedMalformedJson +
        summary.skippedSchemaViolation +
        summary.skippedIoError >
      0;
    if (hadSkips) {
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

    this.lastReconcileSummary = summary;
    return summary;
  }

  /**
   * Returns the most recent reconcile summary, if any. Lets the CLI
   * inspect the failures collected during `initialize()` without having
   * to re-walk the directory tree (and re-emit the warn line).
   */
  getLastReconcileSummary(): ReconcileSummary | undefined {
    return this.lastReconcileSummary;
  }

  /**
   * Move trajectory files that fail to load into `.trajectories/invalid/`
   * so reconcile no longer scans them. Only quarantines parse and schema
   * failures — transient io_error failures are left in place because the
   * file may load fine on the next attempt.
   *
   * Returns the list of files that were moved (with their original paths
   * and the destination directory) so the caller can report what changed.
   */
  async quarantineInvalid(): Promise<{
    moved: ReconcileFailure[];
    targetDir: string;
  }> {
    const summary = await this.reconcileIndex();
    const targetDir = join(this.trajectoriesDir, "invalid");
    const candidates = summary.failures.filter((f) => f.reason !== "io_error");
    if (candidates.length === 0) {
      return { moved: [], targetDir };
    }
    await mkdir(targetDir, { recursive: true });
    const moved: ReconcileFailure[] = [];
    for (const failure of candidates) {
      const dest = await this.resolveQuarantineDest(failure.path, targetDir);
      try {
        await mkdir(dirname(dest), { recursive: true });
        await rename(failure.path, dest);
        moved.push(failure);
      } catch (error) {
        // Skip and surface — never silently lose a file. The doctor
        // command rolls these into its output so the user can intervene.
        console.warn(
          `[trajectories] failed to quarantine ${failure.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { moved, targetDir };
  }

  /**
   * Pick a destination path under `targetDir` for a quarantined file.
   *
   * Preserves the file's relative location under the trajectories root
   * (e.g. `completed/2026-04/foo.json` → `invalid/completed/2026-04/foo.json`)
   * so two invalid files that share a basename across `active/` and
   * `completed/` don't collapse onto each other and silently overwrite.
   *
   * Falls back to a numeric-suffix scheme for paths that live outside
   * the trajectories directory or that, after relative resolution, would
   * still collide with something already quarantined.
   */
  private async resolveQuarantineDest(
    sourcePath: string,
    targetDir: string,
  ): Promise<string> {
    const rel = relative(this.trajectoriesDir, sourcePath);
    const safeRel =
      rel && !rel.startsWith("..") && !isAbsolute(rel)
        ? rel
        : basename(sourcePath);
    let dest = join(targetDir, safeRel);
    if (!existsSync(dest)) return dest;

    // Defensive: someone (or a previous quarantine run) already put a
    // file at this path. Append an incrementing suffix so we still keep
    // both copies for inspection.
    const ext = safeRel.endsWith(".json") ? ".json" : "";
    const stem = ext ? safeRel.slice(0, -ext.length) : safeRel;
    for (let i = 1; i < 1000; i += 1) {
      dest = join(targetDir, `${stem}.${i}${ext}`);
      if (!existsSync(dest)) return dest;
    }
    // 1000 collisions on the same basename is pathological; fall through
    // with the last candidate so rename surfaces the EEXIST itself.
    return dest;
  }

  /**
   * Recursively collect trajectory JSON file paths under `dir` into `out`.
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
      } else if (entry.isFile() && isTrajectoryJsonFile(entry.name)) {
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

    const existingPaths = await this.findTrajectoryFilePaths(trajectory.id);
    let trajectoryDir: string;
    if (isCompleted) {
      const date = new Date(trajectory.completedAt ?? trajectory.startedAt);
      const monthDir = join(
        this.completedDir,
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      );
      trajectoryDir = join(monthDir, trajectory.id);
    } else {
      trajectoryDir = join(this.activeDir, trajectory.id);
    }

    const filePath = join(trajectoryDir, TRAJECTORY_FILE);
    await this.removeTrajectoryFiles(existingPaths, filePath);
    await mkdir(trajectoryDir, { recursive: true });

    if (isCompleted) {
      const markdown = exportToMarkdown(trajectory);
      await writeFile(join(trajectoryDir, SUMMARY_FILE), markdown, "utf-8");
    }

    await writeFile(filePath, JSON.stringify(trajectory, null, 2), "utf-8");
  }

  /**
   * Get a trajectory by ID
   */
  async get(id: string): Promise<Trajectory | null> {
    for (const filePath of this.getActiveCandidatePaths(id)) {
      if (!existsSync(filePath)) continue;
      const trajectory = await this.readTrajectoryOrNull(filePath);
      if (trajectory?.id === id) {
        return trajectory;
      }
    }

    const paths = await this.findTrajectoryFilePaths(id);
    for (const filePath of paths) {
      const trajectory = await this.readTrajectoryOrNull(filePath);
      if (trajectory?.id === id) {
        return trajectory;
      }
    }

    return null;
  }

  /**
   * Get the currently active trajectory
   */
  async getActive(): Promise<Trajectory | null> {
    const activeFiles = await this.collectTrajectoryFiles(this.activeDir);

    if (activeFiles.length === 0) {
      return null;
    }

    // Get most recently started
    let mostRecent: Trajectory | null = null;
    let mostRecentTime = 0;

    for (const filePath of activeFiles) {
      const trajectory = await this.readTrajectoryOrNull(filePath);
      if (trajectory?.status !== "active") continue;

      const startTime = new Date(trajectory.startedAt).getTime();
      if (startTime > mostRecentTime) {
        mostRecentTime = startTime;
        mostRecent = trajectory;
      }
    }

    return mostRecent;
  }

  /**
   * List trajectories with optional filtering
   */
  async list(query: TrajectoryQuery): Promise<TrajectorySummary[]> {
    let trajectories = await this.loadAllTrajectories();

    // Filter by status
    if (query.status) {
      trajectories = trajectories.filter((t) => t.status === query.status);
    }

    // Filter by date range
    if (query.since) {
      const sinceTime = new Date(query.since).getTime();
      trajectories = trajectories.filter(
        (trajectory) => new Date(trajectory.startedAt).getTime() >= sinceTime,
      );
    }
    if (query.until) {
      const untilTime = new Date(query.until).getTime();
      trajectories = trajectories.filter(
        (trajectory) => new Date(trajectory.startedAt).getTime() <= untilTime,
      );
    }

    // Sort (default: startedAt desc)
    const sortBy = query.sortBy ?? "startedAt";
    const sortOrder = query.sortOrder ?? "desc";
    trajectories.sort((a, b) => {
      const aVal = this.getSortValue(a, sortBy);
      const bVal = this.getSortValue(b, sortBy);
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortOrder === "asc" ? cmp : -cmp;
    });

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 500;
    trajectories = trajectories.slice(offset, offset + limit);

    // Convert to summaries
    return trajectories.map((trajectory) => this.toSummary(trajectory));
  }

  /**
   * Delete a trajectory
   */
  async delete(id: string): Promise<void> {
    await this.deleteWithSummary(id);
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
   * Mark a trajectory as compacted without writing to a shared index.
   */
  async markCompacted(id: string, compactedInto: string): Promise<boolean> {
    const markedIds = await this.markCompactedMany([id], compactedInto);
    return markedIds.has(id);
  }

  /**
   * Mark multiple trajectories as compacted with one filesystem scan.
   */
  async markCompactedMany(
    ids: string[],
    compactedInto: string,
  ): Promise<Set<string>> {
    const pathsById = await this.findTrajectoryFilePathsForIds(ids);
    const markedIds = new Set<string>();
    const compactedAt = new Date().toISOString();
    const writes: Promise<void>[] = [];

    for (const [id, paths] of pathsById.entries()) {
      if (paths.length === 0) {
        continue;
      }

      markedIds.add(id);
      const marker: CompactionMarker = {
        trajectoryId: id,
        compactedInto,
        compactedAt,
      };

      for (const filePath of paths) {
        writes.push(
          writeFile(
            this.getCompactionMarkerPath(filePath, id),
            JSON.stringify(marker, null, 2),
            "utf-8",
          ),
        );
      }
    }

    await Promise.all(writes);
    return markedIds;
  }

  /**
   * Return trajectory IDs that have a per-trajectory compaction marker.
   */
  async getCompactedTrajectoryIds(): Promise<Set<string>> {
    const markerPaths = await this.listCompactionMarkerFiles();
    const compactedIds = new Set<string>();

    for (const markerPath of markerPaths) {
      try {
        const marker = JSON.parse(
          await readFile(markerPath, "utf-8"),
        ) as Partial<CompactionMarker>;
        const trajectoryId =
          typeof marker.trajectoryId === "string"
            ? marker.trajectoryId
            : this.getTrajectoryIdFromCompactionMarkerPath(markerPath);
        if (trajectoryId && typeof marker.compactedInto === "string") {
          compactedIds.add(trajectoryId);
        }
      } catch {
        // Ignore malformed compaction markers. They should not block normal
        // list/search/compact operations.
      }
    }

    return compactedIds;
  }

  /**
   * Delete a trajectory and return file counts for CLI reporting.
   */
  async deleteWithSummary(id: string): Promise<DeleteTrajectorySummary> {
    return this.deleteManyWithSummary([id]);
  }

  /**
   * Delete multiple trajectories with one filesystem scan.
   */
  async deleteManyWithSummary(ids: string[]): Promise<DeleteTrajectorySummary> {
    const summary: DeleteTrajectorySummary = {
      removedTrajectories: 0,
      deletedJsonFiles: 0,
      deletedMarkdownFiles: 0,
      deletedTraceFiles: 0,
      deletedCompactionFiles: 0,
    };
    const pathsById = await this.findTrajectoryFilePathsForIds(ids);
    const deletedPaths = new Set<string>();

    for (const paths of pathsById.values()) {
      for (const filePath of paths) {
        if (deletedPaths.has(filePath)) {
          continue;
        }
        deletedPaths.add(filePath);
        await this.removeTrajectoryFile(filePath, summary);
      }
    }

    return summary;
  }

  /**
   * Close storage (no-op for file storage)
   */
  async close(): Promise<void> {
    // No cleanup needed for file storage
  }

  // Private helpers

  private getActiveCandidatePaths(id: string): string[] {
    if (!isSafeTrajectoryId(id)) {
      return [];
    }

    return [
      join(this.activeDir, id, TRAJECTORY_FILE),
      // Legacy layout from v0.5.x and earlier.
      join(this.activeDir, `${id}.json`),
    ];
  }

  private async loadAllTrajectories(): Promise<Trajectory[]> {
    const files = await this.listTrajectoryFiles();
    const trajectories = new Map<string, Trajectory>();

    for (const filePath of files) {
      const trajectory = await this.readTrajectoryOrNull(filePath);
      if (!trajectory) {
        continue;
      }

      const current = trajectories.get(trajectory.id);
      if (!current || this.isNewerTrajectory(trajectory, current)) {
        trajectories.set(trajectory.id, trajectory);
      }
    }

    return Array.from(trajectories.values());
  }

  private async listTrajectoryFiles(): Promise<string[]> {
    const [activeFiles, completedFiles] = await Promise.all([
      this.collectTrajectoryFiles(this.activeDir),
      this.collectTrajectoryFiles(this.completedDir),
    ]);

    return [...activeFiles, ...completedFiles];
  }

  private async collectTrajectoryFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    await this.walkJsonFilesInto(dir, files);
    return files;
  }

  private async findTrajectoryFilePaths(id: string): Promise<string[]> {
    const pathsById = await this.findTrajectoryFilePathsForIds([id]);
    return pathsById.get(id) ?? [];
  }

  private async findTrajectoryFilePathsForIds(
    ids: Iterable<string>,
  ): Promise<Map<string, string[]>> {
    const targetIds = new Set(Array.from(ids).filter(isSafeTrajectoryId));
    const pathsById = new Map<string, string[]>(
      Array.from(targetIds).map((id) => [id, []]),
    );
    if (targetIds.size === 0) {
      return pathsById;
    }

    const allFiles = await this.listTrajectoryFiles();
    for (const filePath of allFiles) {
      const trajectoryId = this.getTrajectoryIdFromPath(filePath);
      if (!trajectoryId || !targetIds.has(trajectoryId)) {
        continue;
      }
      pathsById.get(trajectoryId)?.push(filePath);
    }

    return pathsById;
  }

  private getTrajectoryIdFromPath(filePath: string): string | undefined {
    if (basename(filePath) === TRAJECTORY_FILE) {
      const id = basename(dirname(filePath));
      return isSafeTrajectoryId(id) ? id : undefined;
    }

    const name = basename(filePath);
    if (name.endsWith(".json")) {
      const id = name.slice(0, -".json".length);
      return isSafeTrajectoryId(id) ? id : undefined;
    }

    return undefined;
  }

  private async removeTrajectoryFiles(
    paths: string[],
    exceptPath?: string,
  ): Promise<void> {
    const summary = this.emptyDeleteSummary();

    for (const filePath of paths) {
      if (filePath === exceptPath) {
        continue;
      }
      await this.removeTrajectoryFile(filePath, summary);
    }
  }

  private async removeTrajectoryFile(
    filePath: string,
    summary: DeleteTrajectorySummary,
  ): Promise<void> {
    if (basename(filePath) === TRAJECTORY_FILE) {
      const trajectoryDir = dirname(filePath);
      await this.countDirectoryTrajectoryFiles(trajectoryDir, summary);
      await this.removeFileIfExists(
        join(dirname(trajectoryDir), `${basename(trajectoryDir)}.trace.json`),
        "trace",
        summary,
      );
      await rm(trajectoryDir, { recursive: true, force: true });
      return;
    }

    await this.removeFileIfExists(filePath, "json", summary);
    await this.removeFileIfExists(
      getMarkdownOutputPath(filePath),
      "markdown",
      summary,
    );
    await this.removeFileIfExists(
      getTraceOutputPath(filePath),
      "trace",
      summary,
    );
    await this.removeFileIfExists(
      getLegacyCompactionMarkerPath(filePath),
      "compaction",
      summary,
    );
  }

  private async countDirectoryTrajectoryFiles(
    trajectoryDir: string,
    summary: DeleteTrajectorySummary,
  ): Promise<void> {
    await this.countFileIfExists(
      join(trajectoryDir, TRAJECTORY_FILE),
      "json",
      summary,
    );
    await this.countFileIfExists(
      join(trajectoryDir, SUMMARY_FILE),
      "markdown",
      summary,
    );
    await this.countFileIfExists(
      join(trajectoryDir, `${basename(trajectoryDir)}.trace.json`),
      "trace",
      summary,
    );
    await this.countFileIfExists(
      join(trajectoryDir, "trace.json"),
      "trace",
      summary,
    );
    await this.countFileIfExists(
      join(trajectoryDir, COMPACTION_FILE),
      "compaction",
      summary,
    );
  }

  private async removeFileIfExists(
    path: string,
    kind: "json" | "markdown" | "trace" | "compaction",
    summary: DeleteTrajectorySummary,
  ): Promise<void> {
    if (!existsSync(path)) {
      return;
    }
    await rm(path, { force: true });
    this.incrementDeleteSummary(kind, summary);
  }

  private async countFileIfExists(
    path: string,
    kind: "json" | "markdown" | "trace" | "compaction",
    summary: DeleteTrajectorySummary,
  ): Promise<void> {
    if (existsSync(path)) {
      this.incrementDeleteSummary(kind, summary);
    }
  }

  private incrementDeleteSummary(
    kind: "json" | "markdown" | "trace" | "compaction",
    summary: DeleteTrajectorySummary,
  ): void {
    if (kind === "json") {
      summary.deletedJsonFiles += 1;
      summary.removedTrajectories += 1;
    } else if (kind === "markdown") {
      summary.deletedMarkdownFiles += 1;
    } else if (kind === "trace") {
      summary.deletedTraceFiles += 1;
    } else {
      summary.deletedCompactionFiles += 1;
    }
  }

  private emptyDeleteSummary(): DeleteTrajectorySummary {
    return {
      removedTrajectories: 0,
      deletedJsonFiles: 0,
      deletedMarkdownFiles: 0,
      deletedTraceFiles: 0,
      deletedCompactionFiles: 0,
    };
  }

  private async listCompactionMarkerFiles(): Promise<string[]> {
    const markerPaths: string[] = [];
    await this.walkFilesInto(
      this.activeDir,
      markerPaths,
      isCompactionMarkerFile,
    );
    await this.walkFilesInto(
      this.completedDir,
      markerPaths,
      isCompactionMarkerFile,
    );
    return markerPaths;
  }

  private getCompactionMarkerPath(filePath: string, id: string): string {
    if (basename(filePath) === TRAJECTORY_FILE) {
      return join(dirname(filePath), COMPACTION_FILE);
    }

    return join(dirname(filePath), `${id}${LEGACY_COMPACTION_SUFFIX}`);
  }

  private getTrajectoryIdFromCompactionMarkerPath(
    markerPath: string,
  ): string | undefined {
    if (basename(markerPath) === COMPACTION_FILE) {
      const id = basename(dirname(markerPath));
      return id.startsWith("traj_") ? id : undefined;
    }

    const markerName = basename(markerPath);
    return markerName.endsWith(LEGACY_COMPACTION_SUFFIX)
      ? markerName.slice(0, -LEGACY_COMPACTION_SUFFIX.length)
      : undefined;
  }

  private async migrateLegacyIndexCompactionMarkers(): Promise<void> {
    const indexPath = join(this.trajectoriesDir, "index.json");
    if (!existsSync(indexPath)) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(indexPath, "utf-8"));
    } catch {
      return;
    }

    if (parsed === null || typeof parsed !== "object") {
      return;
    }

    const trajectories = (parsed as { trajectories?: unknown }).trajectories;
    if (
      trajectories === null ||
      typeof trajectories !== "object" ||
      Array.isArray(trajectories)
    ) {
      return;
    }

    await Promise.all(
      Object.entries(trajectories).map(async ([id, entry]) => {
        if (
          entry === null ||
          typeof entry !== "object" ||
          !isSafeTrajectoryId(id)
        ) {
          return;
        }

        const compactedInto = (entry as { compactedInto?: unknown })
          .compactedInto;
        const path = (entry as { path?: unknown }).path;
        if (typeof compactedInto !== "string") {
          return;
        }

        const paths =
          typeof path === "string" &&
          existsSync(path) &&
          this.isPathInsideTrajectoriesDir(path)
            ? [path]
            : await this.findTrajectoryFilePaths(id);
        if (paths.length === 0) return;

        const marker: CompactionMarker = {
          trajectoryId: id,
          compactedInto,
          compactedAt: new Date().toISOString(),
        };

        await Promise.all(
          paths.map((filePath) =>
            writeFile(
              this.getCompactionMarkerPath(filePath, id),
              JSON.stringify(marker, null, 2),
              "utf-8",
            ),
          ),
        );
      }),
    );
  }

  private isPathInsideTrajectoriesDir(path: string): boolean {
    const rel = relative(resolve(this.trajectoriesDir), resolve(path));
    return Boolean(rel && !rel.startsWith("..") && !isAbsolute(rel));
  }

  private async walkFilesInto(
    dir: string,
    out: string[],
    predicate: (name: string) => boolean,
  ): Promise<void> {
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
        await this.walkFilesInto(entryPath, out, predicate);
      } else if (entry.isFile() && predicate(entry.name)) {
        out.push(entryPath);
      }
    }
  }

  private getSortValue(
    trajectory: Trajectory,
    sortBy: NonNullable<TrajectoryQuery["sortBy"]>,
  ): string {
    if (sortBy === "title") {
      return trajectory.task.title;
    }

    return trajectory[sortBy] ?? "";
  }

  private toSummary(trajectory: Trajectory): TrajectorySummary {
    return {
      id: trajectory.id,
      title: trajectory.task.title,
      status: trajectory.status,
      startedAt: trajectory.startedAt,
      completedAt: trajectory.completedAt,
      confidence: trajectory.retrospective?.confidence,
      chapterCount: trajectory.chapters.length,
      decisionCount: trajectory.chapters.reduce(
        (count, chapter) =>
          count +
          chapter.events.filter((event) => event.type === "decision").length,
        0,
      ),
    };
  }

  private isNewerTrajectory(
    candidate: Trajectory,
    current: Trajectory,
  ): boolean {
    const candidateTime = new Date(
      candidate.completedAt ?? candidate.startedAt,
    ).getTime();
    const currentTime = new Date(
      current.completedAt ?? current.startedAt,
    ).getTime();

    return candidateTime > currentTime;
  }

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
}

function isTrajectoryJsonFile(name: string): boolean {
  return (
    name === TRAJECTORY_FILE ||
    (name.endsWith(".json") &&
      name !== "index.json" &&
      !name.endsWith(".trace.json") &&
      !name.endsWith(LEGACY_COMPACTION_SUFFIX) &&
      name !== COMPACTION_FILE)
  );
}

function isSafeTrajectoryId(id: string): boolean {
  return (
    id.length > 0 &&
    !id.includes("..") &&
    !id.includes("/") &&
    !id.includes("\\")
  );
}

function isCompactionMarkerFile(name: string): boolean {
  return name === COMPACTION_FILE || name.endsWith(LEGACY_COMPACTION_SUFFIX);
}

function getMarkdownOutputPath(outputPath: string): string {
  return outputPath.endsWith(".json")
    ? outputPath.slice(0, -".json".length).concat(".md")
    : `${outputPath}.md`;
}

function getTraceOutputPath(outputPath: string): string {
  return outputPath.endsWith(".json")
    ? outputPath.slice(0, -".json".length).concat(".trace.json")
    : `${outputPath}.trace.json`;
}

function getLegacyCompactionMarkerPath(outputPath: string): string {
  return outputPath.endsWith(".json")
    ? outputPath.slice(0, -".json".length).concat(LEGACY_COMPACTION_SUFFIX)
    : `${outputPath}${LEGACY_COMPACTION_SUFFIX}`;
}
