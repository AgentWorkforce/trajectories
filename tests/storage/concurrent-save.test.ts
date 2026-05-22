import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Regression tests for concurrent file storage writes.
 *
 * The storage layout is intentionally index-free: concurrent saves should
 * create independent trajectory directories instead of racing on a shared
 * index.json read-modify-write cycle.
 */
describe("FileStorage concurrent save", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trail-concurrent-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("does not lose trajectories when many callers save concurrently", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    const { createTrajectory } = await import("../../src/core/trajectory.js");

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    const count = 20;
    const trajectories = Array.from({ length: count }, (_, i) =>
      createTrajectory({ title: `Concurrent ${i}` }),
    );
    await Promise.all(trajectories.map((t) => storage.save(t)));

    const activeDir = join(tempDir, ".trajectories", "active");
    const activeEntries = await readdir(activeDir);
    expect(activeEntries).toHaveLength(count);
    for (const trajectory of trajectories) {
      expect(
        existsSync(join(activeDir, trajectory.id, "trajectory.json")),
      ).toBe(true);
    }
    expect(existsSync(join(tempDir, ".trajectories", "index.json"))).toBe(
      false,
    );

    const summaries = await storage.list({});
    expect(summaries.map((summary) => summary.id).sort()).toEqual(
      trajectories.map((trajectory) => trajectory.id).sort(),
    );
  });

  it("removes a legacy index.json without logging corruption", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    const { writeFile } = await import("node:fs/promises");

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    const indexPath = join(tempDir, ".trajectories", "index.json");
    await writeFile(indexPath, "{not valid json at all", "utf-8");

    await storage.initialize();

    expect(existsSync(indexPath)).toBe(false);
  });
});
