import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    tempDir = await mkdtemp(join(tmpdir(), "traj-test-"));
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
        true
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
  });

  describe("save", () => {
    it("should save active trajectory to active directory", async () => {
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
        `${trajectory.id}.json`
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
        `${trajectory.id}.json`
      );
      const completedDir = join(tempDir, ".trajectories", "completed");
      expect(existsSync(activeFile)).toBe(false);
      // Should be in a date-based subdirectory
      const files = await import("node:fs/promises").then((fs) =>
        fs.readdir(completedDir, { recursive: true })
      );
      expect(files.some((f) => f.includes(trajectory.id))).toBe(true);
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
        })
      );
      expect(files.some((f) => f.endsWith(".md"))).toBe(true);
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

  describe("updateIndex", () => {
    it("should maintain an index.json file", async () => {
      // Arrange
      const { FileStorage } = await import("../../src/storage/file.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const trajectory = createTrajectory({ title: "Test" });

      // Act
      await storage.save(trajectory);

      // Assert
      const { readFileSync } = await import("node:fs");
      const indexPath = join(tempDir, ".trajectories", "index.json");
      const index = JSON.parse(readFileSync(indexPath, "utf-8"));
      expect(index.trajectories).toBeDefined();
      expect(index.trajectories[trajectory.id]).toBeDefined();
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
