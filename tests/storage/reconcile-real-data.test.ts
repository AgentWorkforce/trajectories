/**
 * Fixture-based reconcile tests.
 *
 * Every test in this file uses REAL-SHAPE trajectory data (hand-redacted
 * from workforce) committed under tests/fixtures/workforce-trajectories/.
 * The point is to lock down the legacy data contract: the reader must
 * accept real-world role values, id shapes, and layouts without
 * rejecting the data, and reconcileIndex must populate the index from
 * both flat-root and YYYY-MM subdir layouts.
 *
 * If a future refactor breaks reconcile for legacy data, these tests
 * fail in ~50ms — long before any E2E gate fires.
 */

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
  const trajRoot = join(tempDir, ".trajectories");
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

  it("populates index.json with both fixtures after reconcile", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    const indexRaw = await readFile(
      join(tempDir, ".trajectories", "index.json"),
      "utf-8",
    );
    const index = JSON.parse(indexRaw);
    expect(Object.keys(index.trajectories ?? {}).sort()).toEqual([
      "traj_1775734701264_ba65c69b",
      "traj_1775832005024_c2cf5052",
    ]);
    expect(index.trajectories.traj_1775734701264_ba65c69b.path).toContain(
      "completed/traj_1775734701264_ba65c69b.json",
    );
    expect(index.trajectories.traj_1775832005024_c2cf5052.path).toContain(
      "completed/2026-04/traj_1775832005024_c2cf5052.json",
    );
  });

  it("reconcileIndex reports a structured summary", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    await seedFixtureInto(tempDir);

    const storage = new FileStorage(tempDir);
    await storage.initialize();

    // A second reconcile on an already-reconciled index should scan 2
    // files, count them as already indexed, and add nothing.
    const summary = await storage.reconcileIndex();
    expect(summary.scanned).toBe(2);
    expect(summary.added).toBe(0);
    expect(summary.alreadyIndexed).toBe(2);
    expect(summary.skippedMalformedJson).toBe(0);
    expect(summary.skippedSchemaViolation).toBe(0);
  });

  it("counts malformed JSON fixtures under skippedMalformedJson", async () => {
    const { FileStorage } = await import("../../src/storage/file.js");
    const { writeFile } = await import("node:fs/promises");

    const trajRoot = join(tempDir, ".trajectories");
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

    const trajRoot = join(tempDir, ".trajectories");
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
});
