/**
 * Fixture-based reconcile tests.
 *
 * Every test in this file uses REAL-SHAPE trajectory data (hand-redacted
 * from workforce) committed under tests/fixtures/workforce-trajectories/.
 * The point is to lock down the legacy data contract: the reader must
 * accept real-world role values, id shapes, and layouts without
 * rejecting the data, and reconcileIndex must discover both flat-root
 * and YYYY-MM subdir layouts without a shared index.
 *
 * If a future refactor breaks reconcile for legacy data, these tests
 * fail in ~50ms — long before any E2E gate fires.
 */

import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_ROOT = join(
  __dirname,
  "..",
  "fixtures",
  "workforce-trajectories",
);

async function seedFixtureInto(tempDir: string): Promise<void> {
  const trajRoot = join(tempDir, ".agentworkforce", "trajectories");
  await mkdir(join(trajRoot, "active"), { recursive: true });
  await mkdir(join(trajRoot, "completed"), { recursive: true });
  await cp(join(FIXTURE_ROOT, "completed"), join(trajRoot, "completed"), {
    recursive: true,
  });
}

describe("FileStorage reconcile — real workforce fixtures", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trail-fixture-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reconciles the legacy flat-root layout without rejecting it", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    const summaries = await storage.list({ status: "completed" });
    const ids = summaries.map((s) => s.id);
    expect(ids).toContain("traj_1775734701264_ba65c69b");
    expect(ids).toContain("traj_1775832005024_c2cf5052");
  });

  it("accepts legacy role values like 'workflow-runner' and 'specialist'", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();
    const trajectory = await storage.get("traj_1775734701264_ba65c69b");

    expect(trajectory).not.toBeNull();
    const roles = trajectory?.agents.map((a) => a.role) ?? [];
    expect(roles).toContain("workflow-runner");
    expect(roles).toContain("specialist");
  });

  it("accepts legacy timestamp-hex trajectory ids", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();
    const trajectory = await storage.get("traj_1775734701264_ba65c69b");

    expect(trajectory?.id).toBe("traj_1775734701264_ba65c69b");
  });

  it("defaults missing commits/filesChanged/tags arrays on read", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();
    const trajectory = await storage.get("traj_1775734701264_ba65c69b");

    expect(trajectory?.commits).toEqual([]);
    expect(trajectory?.filesChanged).toEqual([]);
    expect(trajectory?.tags).toEqual([]);
    expect(trajectory?.projectId).toBeUndefined();
  });

  it("does not create index.json after reconciling fixtures", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    expect(
      existsSync(
        join(tempDir, ".agentworkforce", "trajectories", "index.json"),
      ),
    ).toBe(false);
    const summaries = await storage.list({ status: "completed" });
    expect(summaries.map((summary) => summary.id).sort()).toEqual([
      "traj_1775734701264_ba65c69b",
      "traj_1775832005024_c2cf5052",
    ]);
  });

  it("reconcileIndex reports a structured summary", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    // A second reconcile should scan the same 2 files and report both as
    // valid without writing a shared index.
    const summary = await storage.reconcileIndex();
    expect(summary.scanned).toBe(2);
    expect(summary.added).toBe(2);
    expect(summary.alreadyIndexed).toBe(0);
    expect(summary.skippedMalformedJson).toBe(0);
    expect(summary.skippedSchemaViolation).toBe(0);
  });

  it("counts malformed JSON fixtures under skippedMalformedJson", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    const { writeFile } = await import("node:fs/promises");

    const trajRoot = join(tempDir, ".agentworkforce", "trajectories");
    await mkdir(join(trajRoot, "completed"), { recursive: true });
    await writeFile(
      join(trajRoot, "completed", "traj_broken0000_deadbeef.json"),
      "{ not valid json",
      "utf-8",
    );

    const storage = new FileStorage(tempDir);
    const summary = await storage.reconcileIndex();

    expect(summary.scanned).toBe(1);
    expect(summary.added).toBe(0);
    expect(summary.skippedMalformedJson).toBe(1);
    expect(summary.skippedSchemaViolation).toBe(0);
  });

  it("counts schema-violating fixtures under skippedSchemaViolation", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    const { writeFile } = await import("node:fs/promises");

    const trajRoot = join(tempDir, ".agentworkforce", "trajectories");
    await mkdir(join(trajRoot, "completed"), { recursive: true });
    await writeFile(
      join(trajRoot, "completed", "traj_nothing0000_0000.json"),
      JSON.stringify({ id: "traj_nothing0000_0000", version: 1 }),
      "utf-8",
    );

    const storage = new FileStorage(tempDir);
    const summary = await storage.reconcileIndex();

    expect(summary.scanned).toBe(1);
    expect(summary.added).toBe(0);
    expect(summary.skippedMalformedJson).toBe(0);
    expect(summary.skippedSchemaViolation).toBe(1);
  });

  it("quarantineInvalid preserves both files when basenames collide across dirs", async () => {
    // Regression: an earlier version of quarantineInvalid used basename(),
    // so two invalid files at active/foo.json and completed/.../foo.json
    // collapsed onto the same destination and one was silently lost.
    const { FileStorage } = await import("../../src/storage/file.js");
    const { writeFile, readdir } = await import("node:fs/promises");

    const trajRoot = join(tempDir, ".agentworkforce", "trajectories");
    await mkdir(join(trajRoot, "active"), { recursive: true });
    await mkdir(join(trajRoot, "completed", "2026-04"), { recursive: true });

    // Same basename, different parent dirs, both schema-invalid.
    const invalidPayload = JSON.stringify({
      id: "traj_dup00000_0000",
      version: 1,
    });
    await writeFile(
      join(trajRoot, "active", "traj_dup00000_0000.json"),
      invalidPayload,
      "utf-8",
    );
    await writeFile(
      join(trajRoot, "completed", "2026-04", "traj_dup00000_0000.json"),
      invalidPayload,
      "utf-8",
    );

    const storage = new FileStorage(tempDir);
    const result = await storage.quarantineInvalid();

    expect(result.moved).toHaveLength(2);

    // Both files should now live under invalid/, with the relative path
    // preserved so neither overwrites the other.
    const activeQuarantined = join(
      trajRoot,
      "invalid",
      "active",
      "traj_dup00000_0000.json",
    );
    const completedQuarantined = join(
      trajRoot,
      "invalid",
      "completed",
      "2026-04",
      "traj_dup00000_0000.json",
    );
    const activeContent = await readFile(activeQuarantined, "utf-8");
    const completedContent = await readFile(completedQuarantined, "utf-8");
    expect(activeContent).toBe(invalidPayload);
    expect(completedContent).toBe(invalidPayload);

    // And the originals must be gone from active/ and completed/.
    const activeAfter = await readdir(join(trajRoot, "active"));
    expect(activeAfter).not.toContain("traj_dup00000_0000.json");
  });
});
