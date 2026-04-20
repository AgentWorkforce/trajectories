import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the concurrent index.json read/write race.
 *
 * Repro shape (seen in relay workflow fan-outs): multiple async callers
 * invoke FileStorage.save at roughly the same millisecond. Each call
 * runs loadIndex -> mutate -> saveIndex. Without serialization:
 *
 *   - A writer opens index.json in "w" mode, truncating it to 0 bytes.
 *   - A concurrent reader sees the empty file, JSON.parse("") throws,
 *     the catch treats it as "no index" and returns an empty one.
 *   - That reader then writes its one mutation on top of the empty
 *     object, wiping every trajectory registered before it.
 */
describe("FileStorage concurrent save", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trail-concurrent-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("does not lose trajectories when many callers save concurrently", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    const { createTrajectory } = await import("../../src/core/trajectory.js");

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Fan out ~20 concurrent saves. Each one does load -> mutate -> save
    // of index.json, which is the exact interleaving that wipes prior
    // entries in the buggy code.
    const count = 20;
    const trajectories = Array.from({ length: count }, (_, i) =>
      createTrajectory({ title: `Concurrent ${i}` }),
    );
    await Promise.all(trajectories.map((t) => storage.save(t)));

    const indexPath = join(tempDir, ".trajectories", "index.json");
    const raw = await readFile(indexPath, "utf-8");

    // Final file on disk must be valid JSON — never a truncated write.
    const parsed = JSON.parse(raw) as {
      trajectories: Record<string, unknown>;
    };

    // All saved trajectories must be present in the final index.
    // The buggy code would lose most of them to truncated-read wipes.
    const ids = Object.keys(parsed.trajectories);
    expect(ids).toHaveLength(count);
    for (const t of trajectories) {
      expect(ids).toContain(t.id);
    }

    // No SyntaxError logged — empty reads should be tolerated silently,
    // and the mutex should prevent concurrent read/write interleaves.
    const loggedSyntaxError = errorSpy.mock.calls.some((args) =>
      args.some(
        (a) =>
          a instanceof SyntaxError ||
          (typeof a === "string" && a.includes("Unexpected end of JSON input")),
      ),
    );
    expect(loggedSyntaxError).toBe(false);
  });

  it("tolerates an empty index.json on disk without logging", async () => {
    // Mimics the "file truncated mid-write" observation: an empty file
    // should be treated as an empty index, not a JSON parse error.
    const { FileStorage } = await import("../../src/storage/file.js");
    const { createTrajectory } = await import("../../src/core/trajectory.js");
    const { writeFile } = await import("node:fs/promises");

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    // Force index.json to be empty after initialize.
    const indexPath = join(tempDir, ".trajectories", "index.json");
    await writeFile(indexPath, "", "utf-8");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const trajectory = createTrajectory({ title: "After empty read" });
    await storage.save(trajectory);

    const loggedSyntaxError = errorSpy.mock.calls.some((args) =>
      args.some(
        (a) =>
          a instanceof SyntaxError ||
          (typeof a === "string" && a.includes("Unexpected end of JSON input")),
      ),
    );
    expect(loggedSyntaxError).toBe(false);

    const raw = await readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      trajectories: Record<string, unknown>;
    };
    expect(parsed.trajectories[trajectory.id]).toBeDefined();
  });

  it("still surfaces genuinely malformed (non-empty) index.json", async () => {
    // If someone hand-edits index.json into invalid garbage, we still
    // want the console.error — that's a real problem worth surfacing.
    const { FileStorage } = await import("../../src/storage/file.js");
    const { createTrajectory } = await import("../../src/core/trajectory.js");
    const { writeFile } = await import("node:fs/promises");

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    const indexPath = join(tempDir, ".trajectories", "index.json");
    await writeFile(indexPath, "{not valid json at all", "utf-8");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Save still succeeds (we treat the index as empty and rebuild).
    const trajectory = createTrajectory({ title: "After garbage index" });
    await storage.save(trajectory);

    // Malformed JSON should still be logged.
    expect(errorSpy).toHaveBeenCalled();
  });
});
