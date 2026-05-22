import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Test stubs for Storage functionality
 *
 * These tests define the expected behavior of the storage adapters.
 * All tests should FAIL until implementation is complete.
 *
 * Coverage: happy path, edge cases, error scenarios
 * Structure: Arrange-Act-Assert
 */

describe("FileStorage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trail-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialization", () => {
    it("should create .trajectories directory if it does not exist", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage(tempDir);

      // Act
      await storage.initialize();

      // Assert
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tempDir, ".trajectories"))).toBe(true);
      expect(existsSync(join(tempDir, ".trajectories", "active"))).toBe(true);
      expect(existsSync(join(tempDir, ".trajectories", "completed"))).toBe(
        true,
      );
      expect(existsSync(join(tempDir, ".trajectories", "index.json"))).toBe(
        false,
      );
    });

    it("should not fail if directory already exists", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      // Act & Assert - should not throw
      await expect(storage.initialize()).resolves.not.toThrow();
    });

    it("should remove a legacy index.json file", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { mkdir, writeFile } = await import("node:fs/promises");
      const storage = new FileStorage(tempDir);
      await mkdir(join(tempDir, ".trajectories"), { recursive: true });
      const indexPath = join(tempDir, ".trajectories", "index.json");
      await writeFile(indexPath, "{}", "utf-8");

      // Act
      await storage.initialize();

      // Assert
      const { existsSync } = await import("node:fs");
      expect(existsSync(indexPath)).toBe(false);
    });
  });

  describe("save", () => {
    it("should save active trajectory to its own active directory", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Test task" });

      // Act
      await storage.save(trajectory);

      // Assert
      const { existsSync, readFileSync } = await import("node:fs");
      const filePath = join(
        tempDir,
        ".trajectories",
        "active",
        trajectory.id,
        "trajectory.json",
      );
      expect(existsSync(filePath)).toBe(true);
      const saved = JSON.parse(readFileSync(filePath, "utf-8"));
      expect(saved.id).toBe(trajectory.id);
    });

    it("should move trajectory to completed directory when completed", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      let trajectory = createTrajectory({ title: "Test task" });
      await storage.save(trajectory);

      // Act
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });
      await storage.save(trajectory);

      // Assert
      const { existsSync } = await import("node:fs");
      const activeFile = join(
        tempDir,
        ".trajectories",
        "active",
        trajectory.id,
        "trajectory.json",
      );
      const completedDir = join(tempDir, ".trajectories", "completed");
      const date = new Date(trajectory.completedAt ?? trajectory.startedAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const completedFile = join(
        completedDir,
        month,
        trajectory.id,
        "trajectory.json",
      );
      expect(existsSync(activeFile)).toBe(false);
      expect(existsSync(completedFile)).toBe(true);
    });

    it("should also generate markdown summary for completed trajectory", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });

      // Act
      await storage.save(trajectory);

      // Assert
      const files = await import("node:fs/promises").then((fs) =>
        fs.readdir(join(tempDir, ".trajectories", "completed"), {
          recursive: true,
        }),
      );
      expect(files.some((f) => f.endsWith("summary.md"))).toBe(true);
    });
  });

  describe("get", () => {
    it("should retrieve a trajectory by ID", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Test task" });
      await storage.save(trajectory);

      // Act
      const retrieved = await storage.get(trajectory.id);

      // Assert
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(trajectory.id);
      expect(retrieved?.task.title).toBe("Test task");
    });

    it("should return null for non-existent trajectory", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      // Act
      const retrieved = await storage.get("traj_nonexistent");

      // Assert
      expect(retrieved).toBeNull();
    });

    it("should find trajectory in both active and completed directories", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });
      await storage.save(trajectory);

      // Act
      const retrieved = await storage.get(trajectory.id);

      // Assert
      expect(retrieved).not.toBeNull();
      expect(retrieved?.status).toBe("completed");
    });

    it("should retrieve a legacy flat trajectory file", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const { mkdir, writeFile } = await import("node:fs/promises");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Legacy task" });
      await mkdir(join(tempDir, ".trajectories", "active"), {
        recursive: true,
      });
      await writeFile(
        join(tempDir, ".trajectories", "active", `${trajectory.id}.json`),
        JSON.stringify(trajectory, null, 2),
        "utf-8",
      );

      // Act
      const retrieved = await storage.get(trajectory.id);

      // Assert
      expect(retrieved?.id).toBe(trajectory.id);
      expect(retrieved?.task.title).toBe("Legacy task");
    });
  });

  describe("getActive", () => {
    it("should return the currently active trajectory", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Active task" });
      await storage.save(trajectory);

      // Act
      const active = await storage.getActive();

      // Assert
      expect(active).not.toBeNull();
      expect(active?.id).toBe(trajectory.id);
    });

    it("should return null when no active trajectory", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      // Act
      const active = await storage.getActive();

      // Assert
      expect(active).toBeNull();
    });

    it("should return most recently started trajectory if multiple exist", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const first = createTrajectory({ title: "First" });
      await storage.save(first);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      const second = createTrajectory({ title: "Second" });
      await storage.save(second);

      // Act
      const active = await storage.getActive();

      // Assert
      expect(active?.id).toBe(second.id);
    });
  });

  describe("list", () => {
    it("should list all trajectories", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      const active = createTrajectory({ title: "Active" });
      await storage.save(active);

      let completed = createTrajectory({ title: "Completed" });
      completed = completeTrajectory(completed, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });
      await storage.save(completed);

      // Act
      const list = await storage.list({});

      // Assert
      expect(list).toHaveLength(2);
    });

    it("should filter by status", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      const active = createTrajectory({ title: "Active" });
      await storage.save(active);

      let completed = createTrajectory({ title: "Completed" });
      completed = completeTrajectory(completed, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });
      await storage.save(completed);

      // Act
      const activeList = await storage.list({ status: "active" });
      const completedList = await storage.list({ status: "completed" });

      // Assert
      expect(activeList).toHaveLength(1);
      expect(completedList).toHaveLength(1);
    });

    it("should limit results", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      for (let i = 0; i < 5; i++) {
        await storage.save(createTrajectory({ title: `Task ${i}` }));
      }

      // Act
      const list = await storage.list({ limit: 3 });

      // Assert
      expect(list).toHaveLength(3);
    });

    it("should sort by startedAt descending by default", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      const first = createTrajectory({ title: "First" });
      await storage.save(first);
      await new Promise((r) => setTimeout(r, 10));
      const second = createTrajectory({ title: "Second" });
      await storage.save(second);

      // Act
      const list = await storage.list({});

      // Assert
      expect(list[0].id).toBe(second.id);
      expect(list[1].id).toBe(first.id);
    });
  });

  describe("delete", () => {
    it("should delete a trajectory", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "To delete" });
      await storage.save(trajectory);

      // Act
      await storage.delete(trajectory.id);

      // Assert
      const retrieved = await storage.get(trajectory.id);
      expect(retrieved).toBeNull();
    });

    it("should not throw when deleting non-existent trajectory", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();

      // Act & Assert - should not throw
      await expect(storage.delete("traj_nonexistent")).resolves.not.toThrow();
    });
  });

  describe("git-friendly layout", () => {
    it("should not create a shared index.json file", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Test" });

      // Act
      await storage.save(trajectory);

      // Assert
      const { existsSync } = await import("node:fs");
      const indexPath = join(tempDir, ".trajectories", "index.json");
      expect(existsSync(indexPath)).toBe(false);
      expect(
        existsSync(
          join(
            tempDir,
            ".trajectories",
            "active",
            trajectory.id,
            "trajectory.json",
          ),
        ),
      ).toBe(true);
    });
  });

  describe("reconcileIndex", () => {
    it("picks up completed trajectories dropped in the flat completed/ root", async () => {
      // Arrange: write a trajectory file directly into completed/ without
      // touching index.json — mimics a stale index produced by an older
      // writer or an out-of-band process.
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const { mkdir, writeFile } = await import("node:fs/promises");

      const bootstrap = new FileStorage(tempDir);
      await bootstrap.initialize();

      const completedDir = join(tempDir, ".trajectories", "completed");
      await mkdir(completedDir, { recursive: true });
      const trajectory = {
        ...createTrajectory({ title: "Stale flat file" }),
        status: "completed" as const,
        completedAt: new Date().toISOString(),
      };
      await writeFile(
        join(completedDir, `${trajectory.id}.json`),
        JSON.stringify(trajectory, null, 2),
        "utf-8",
      );

      // Act: initialize a fresh FileStorage; reconcile runs inside initialize().
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const summaries = await storage.list({ status: "completed" });

      // Assert
      expect(summaries.map((s) => s.id)).toContain(trajectory.id);
    });

    it("picks up completed trajectories inside YYYY-MM subdirectories", async () => {
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const { mkdir, writeFile } = await import("node:fs/promises");

      const bootstrap = new FileStorage(tempDir);
      await bootstrap.initialize();

      const monthDir = join(tempDir, ".trajectories", "completed", "2026-04");
      await mkdir(monthDir, { recursive: true });
      const trajectory = {
        ...createTrajectory({ title: "Stale month file" }),
        status: "completed" as const,
        completedAt: "2026-04-01T00:00:00.000Z",
      };
      await writeFile(
        join(monthDir, `${trajectory.id}.json`),
        JSON.stringify(trajectory, null, 2),
        "utf-8",
      );

      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const summaries = await storage.list({ status: "completed" });

      expect(summaries.map((s) => s.id)).toContain(trajectory.id);
    });

    it("does not create a shared index when scanning existing files", async () => {
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");

      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Originally saved" });
      await storage.save(trajectory);

      // Running reconcile again should be a no-op for this entry.
      await storage.reconcileIndex();

      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tempDir, ".trajectories", "index.json"))).toBe(
        false,
      );
      const summaries = await storage.list({});
      expect(summaries.map((summary) => summary.id)).toContain(trajectory.id);
    });
  });
});

describe("StorageAdapter Interface", () => {
  it("should define required methods", async () => {
    // Arrange
    const { StorageAdapter } = await import("../../src/storage/interface.js");

    // Assert - these should be defined in the interface
    expect(StorageAdapter).toBeDefined();
  });
});

describe("Environment Variable Support", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trail-env-test-"));
    originalEnv = { ...process.env };
  });

  afterEach(async () => {
    // Restore original env
    process.env = originalEnv;
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("TRAJECTORIES_DATA_DIR", () => {
    it("should use TRAJECTORIES_DATA_DIR when set", async () => {
      // Arrange
      process.env.TRAJECTORIES_DATA_DIR = tempDir;
      // Re-import to pick up new env var
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage();
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Test" });

      // Act
      await storage.save(trajectory);

      // Assert - file should be at tempDir/active, not tempDir/.trajectories/active
      const { existsSync } = await import("node:fs");
      expect(
        existsSync(join(tempDir, "active", trajectory.id, "trajectory.json")),
      ).toBe(true);
      expect(existsSync(join(tempDir, ".trajectories"))).toBe(false);
      expect(existsSync(join(tempDir, "index.json"))).toBe(false);
    });

    it("should not create index.json when TRAJECTORIES_DATA_DIR is set", async () => {
      // Arrange
      process.env.TRAJECTORIES_DATA_DIR = tempDir;
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage();

      // Act
      await storage.initialize();

      // Assert
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tempDir, "index.json"))).toBe(false);
      expect(existsSync(join(tempDir, "active"))).toBe(true);
      expect(existsSync(join(tempDir, "completed"))).toBe(true);
    });

    it("should migrate legacy compacted index entries to per-trajectory markers", async () => {
      // Arrange
      process.env.TRAJECTORIES_DATA_DIR = tempDir;
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const { writeFile } = await import("node:fs/promises");
      const storage = new FileStorage();
      await storage.initialize();
      const completed = completeTrajectory(
        createTrajectory({ title: "Done" }),
        {
          summary: "Done",
          approach: "Test",
          confidence: 0.9,
        },
      );
      await storage.save(completed);
      const date = new Date(completed.completedAt ?? completed.startedAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const path = join(
        tempDir,
        "completed",
        month,
        completed.id,
        "trajectory.json",
      );
      await writeFile(
        join(tempDir, "index.json"),
        JSON.stringify(
          {
            version: 1,
            lastUpdated: new Date().toISOString(),
            trajectories: {
              [completed.id]: {
                title: completed.task.title,
                status: completed.status,
                startedAt: completed.startedAt,
                completedAt: completed.completedAt,
                path,
                compactedInto: "compact_test",
              },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      // Act
      await storage.initialize();

      // Assert
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(tempDir, "index.json"))).toBe(false);
      expect(
        existsSync(
          join(tempDir, "completed", month, completed.id, "compaction.json"),
        ),
      ).toBe(true);
      expect(await storage.getCompactedTrajectoryIds()).toEqual(
        new Set([completed.id]),
      );
    });

    it("should not add .trajectories suffix when TRAJECTORIES_DATA_DIR is set", async () => {
      // Arrange
      const customDir = join(tempDir, "custom-path");
      process.env.TRAJECTORIES_DATA_DIR = customDir;
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage();

      // Act
      await storage.initialize();

      // Assert
      const { existsSync } = await import("node:fs");
      expect(existsSync(join(customDir, "active"))).toBe(true);
      expect(existsSync(join(customDir, ".trajectories"))).toBe(false);
    });

    it("should expand ~ in TRAJECTORIES_DATA_DIR", async () => {
      // Arrange - we can't easily test ~ expansion without mocking HOME
      // but we can test that a path starting with ~ doesn't throw
      const originalHome = process.env.HOME;
      process.env.HOME = tempDir;
      process.env.TRAJECTORIES_DATA_DIR = "~/trajectories";
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage();

      // Act & Assert - should not throw
      await expect(storage.initialize()).resolves.not.toThrow();

      // Cleanup
      process.env.HOME = originalHome;
    });
  });

  describe("getSearchPaths", () => {
    it("should return TRAJECTORIES_SEARCH_PATHS when set", async () => {
      // Arrange
      const path1 = join(tempDir, "path1");
      const path2 = join(tempDir, "path2");
      process.env.TRAJECTORIES_SEARCH_PATHS = `${path1}:${path2}`;
      process.env.TRAJECTORIES_DATA_DIR = undefined;

      // Re-import to pick up new env var
      const { getSearchPaths } = await import("../../src/storage/file.js");

      // Act
      const paths = getSearchPaths();

      // Assert
      expect(paths).toEqual([path1, path2]);
    });

    it("should fall back to TRAJECTORIES_DATA_DIR when SEARCH_PATHS not set", async () => {
      // Arrange
      process.env.TRAJECTORIES_SEARCH_PATHS = undefined;
      process.env.TRAJECTORIES_DATA_DIR = tempDir;
      const { getSearchPaths } = await import("../../src/storage/file.js");

      // Act
      const paths = getSearchPaths();

      // Assert
      expect(paths).toEqual([tempDir]);
    });

    it("should fall back to .trajectories when no env vars set", async () => {
      // Arrange
      process.env.TRAJECTORIES_SEARCH_PATHS = undefined;
      process.env.TRAJECTORIES_DATA_DIR = undefined;
      const { getSearchPaths } = await import("../../src/storage/file.js");

      // Act
      const paths = getSearchPaths();

      // Assert
      expect(paths[0]).toContain(".trajectories");
    });

    it("should filter empty paths from TRAJECTORIES_SEARCH_PATHS", async () => {
      // Arrange
      const path1 = join(tempDir, "path1");
      process.env.TRAJECTORIES_SEARCH_PATHS = `${path1}::  :`;
      process.env.TRAJECTORIES_DATA_DIR = undefined;
      const { getSearchPaths } = await import("../../src/storage/file.js");

      // Act
      const paths = getSearchPaths();

      // Assert
      expect(paths).toEqual([path1]);
    });
  });
});
