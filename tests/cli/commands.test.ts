import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Test stubs for CLI commands
 *
 * These tests define the expected behavior of the CLI.
 * All tests should FAIL until implementation is complete.
 *
 * Coverage: happy path, edge cases, error scenarios
 * Structure: Arrange-Act-Assert
 */

describe("CLI Commands", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "traj-cli-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("traj start", () => {
    it("should create a new trajectory", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");

      // Act
      const result = await runCommand(["start", "Implement auth"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Trajectory started");
      expect(result.output).toMatch(/traj_[a-z0-9]+/);
    });

    it("should fail if a trajectory is already active", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "First task"]);

      // Act
      const result = await runCommand(["start", "Second task"]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("already active");
    });

    it("should support --task flag for external reference", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");

      // Act
      const result = await runCommand([
        "start",
        "Fix bug",
        "--task",
        "GH#123",
        "--source",
        "github",
      ]);

      // Assert
      expect(result.success).toBe(true);

      // Verify the trajectory has the task reference
      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const active = await storage.getActive();
      expect(active?.task.source?.id).toBe("GH#123");
    });
  });

  describe("traj status", () => {
    it("should show active trajectory details", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Act
      const result = await runCommand(["status"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Test task");
      expect(result.output).toContain("active");
    });

    it("should indicate when no trajectory is active", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");

      // Act
      const result = await runCommand(["status"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("No active trajectory");
    });

    it("should show chapter and event counts", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);
      await runCommand(["chapter", "Phase 1"]);
      await runCommand(["decision", "Choice A", "--reasoning", "Because"]);

      // Act
      const result = await runCommand(["status"]);

      // Assert
      expect(result.output).toMatch(/Chapters:\s+1/);
      expect(result.output).toMatch(/Events:\s+1/);
    });
  });

  describe("traj decision", () => {
    it("should record a decision in the active trajectory", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Act
      const result = await runCommand([
        "decision",
        "Chose JWT",
        "--reasoning",
        "Stateless scaling",
        "--alternatives",
        "Sessions,OAuth",
      ]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Decision recorded");
    });

    it("should fail without an active trajectory", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");

      // Act
      const result = await runCommand([
        "decision",
        "Choice",
        "--reasoning",
        "Why",
      ]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("No active trajectory");
    });

    it("should require reasoning", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Act
      const result = await runCommand(["decision", "Choice"]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("reasoning");
    });
  });

  describe("traj chapter", () => {
    it("should start a new chapter", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Act
      const result = await runCommand(["chapter", "Implementation phase"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Chapter started");
    });

    it("should accept optional agent name", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Act
      const result = await runCommand([
        "chapter",
        "Review",
        "--agent",
        "Bob",
      ]);

      // Assert
      expect(result.success).toBe(true);

      const { FileStorage } = await import("../../src/storage/file.js");
      const storage = new FileStorage(tempDir);
      await storage.initialize();
      const active = await storage.getActive();
      expect(active?.chapters[0].agentName).toBe("Bob");
    });
  });

  describe("traj note", () => {
    it("should add a note event", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Act
      const result = await runCommand(["note", "Found an interesting pattern"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Note added");
    });
  });

  describe("traj complete", () => {
    it("should complete the trajectory with retrospective", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Mock the interactive prompt
      vi.mock("@clack/prompts", () => ({
        text: vi.fn().mockResolvedValue("Summary of work"),
        confirm: vi.fn().mockResolvedValue(true),
      }));

      // Act
      const result = await runCommand([
        "complete",
        "--summary",
        "Implemented feature",
        "--confidence",
        "0.85",
      ]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Trajectory completed");
    });

    it("should fail without an active trajectory", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");

      // Act
      const result = await runCommand([
        "complete",
        "--summary",
        "Done",
        "--confidence",
        "0.9",
      ]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("No active trajectory");
    });
  });

  describe("traj abandon", () => {
    it("should abandon the active trajectory", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);

      // Act
      const result = await runCommand(["abandon", "--reason", "Requirements changed"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Trajectory abandoned");
    });
  });

  describe("traj list", () => {
    it("should list trajectories", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Task 1"]);
      await runCommand([
        "complete",
        "--summary",
        "Done",
        "--confidence",
        "0.9",
      ]);
      await runCommand(["start", "Task 2"]);

      // Act
      const result = await runCommand(["list"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Task 1");
      expect(result.output).toContain("Task 2");
    });

    it("should filter by status", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Task 1"]);
      await runCommand([
        "complete",
        "--summary",
        "Done",
        "--confidence",
        "0.9",
      ]);
      await runCommand(["start", "Task 2"]);

      // Act
      const result = await runCommand(["list", "--status", "completed"]);

      // Assert
      expect(result.output).toContain("Task 1");
      expect(result.output).not.toContain("Task 2");
    });

    it("should limit results", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      for (let i = 1; i <= 5; i++) {
        await runCommand(["start", `Task ${i}`]);
        await runCommand([
          "complete",
          "--summary",
          "Done",
          "--confidence",
          "0.9",
        ]);
      }

      // Act
      const result = await runCommand(["list", "--limit", "3"]);

      // Assert
      const lines = result.output.split("\n").filter((l) => l.includes("Task"));
      expect(lines.length).toBeLessThanOrEqual(3);
    });
  });

  describe("traj show", () => {
    it("should show trajectory details", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      const startResult = await runCommand(["start", "Test task"]);
      const idMatch = startResult.output.match(/traj_[a-z0-9]+/);
      const id = idMatch?.[0];

      // Act
      const result = await runCommand(["show", id!]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("Test task");
    });

    it("should show decisions with --decisions flag", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);
      await runCommand([
        "decision",
        "Chose A",
        "--reasoning",
        "Because",
        "--alternatives",
        "B,C",
      ]);
      const status = await runCommand(["status"]);
      const idMatch = status.output.match(/traj_[a-z0-9]+/);
      const id = idMatch?.[0];

      // Act
      const result = await runCommand(["show", id!, "--decisions"]);

      // Assert
      expect(result.output).toContain("Chose A");
      expect(result.output).toContain("Because");
    });

    it("should fail for non-existent trajectory", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");

      // Act
      const result = await runCommand(["show", "traj_nonexistent"]);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("traj search", () => {
    it("should search trajectories by text", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Implement authentication"]);
      await runCommand([
        "complete",
        "--summary",
        "Added JWT auth",
        "--confidence",
        "0.9",
      ]);
      await runCommand(["start", "Fix database bug"]);
      await runCommand([
        "complete",
        "--summary",
        "Fixed query",
        "--confidence",
        "0.9",
      ]);

      // Act
      const result = await runCommand(["search", "auth"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("authentication");
      expect(result.output).not.toContain("database");
    });
  });

  describe("traj export", () => {
    it("should export trajectory as markdown", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);
      await runCommand([
        "decision",
        "Chose A",
        "--reasoning",
        "Because",
      ]);
      await runCommand([
        "complete",
        "--summary",
        "Done",
        "--confidence",
        "0.9",
      ]);
      const list = await runCommand(["list"]);
      const idMatch = list.output.match(/traj_[a-z0-9]+/);
      const id = idMatch?.[0];

      // Act
      const result = await runCommand(["export", id!, "--format", "md"]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.output).toContain("# Trajectory:");
      expect(result.output).toContain("## Summary");
    });

    it("should export trajectory as JSON", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);
      await runCommand([
        "complete",
        "--summary",
        "Done",
        "--confidence",
        "0.9",
      ]);
      const list = await runCommand(["list"]);
      const idMatch = list.output.match(/traj_[a-z0-9]+/);
      const id = idMatch?.[0];

      // Act
      const result = await runCommand(["export", id!, "--format", "json"]);

      // Assert
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output);
      expect(parsed.id).toBe(id);
    });

    it("should write to file with --output flag", async () => {
      // Arrange
      const { runCommand } = await import("../../src/cli/runner.js");
      await runCommand(["start", "Test task"]);
      await runCommand([
        "complete",
        "--summary",
        "Done",
        "--confidence",
        "0.9",
      ]);
      const list = await runCommand(["list"]);
      const idMatch = list.output.match(/traj_[a-z0-9]+/);
      const id = idMatch?.[0];
      const outputPath = join(tempDir, "export.md");

      // Act
      const result = await runCommand([
        "export",
        id!,
        "--format",
        "md",
        "--output",
        outputPath,
      ]);

      // Assert
      expect(result.success).toBe(true);
      const { readFileSync } = await import("node:fs");
      const content = readFileSync(outputPath, "utf-8");
      expect(content).toContain("# Trajectory:");
    });
  });
});
