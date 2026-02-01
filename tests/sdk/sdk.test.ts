import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * SDK Tests
 *
 * Tests for the high-level SDK API including TrajectoryClient and TrajectoryBuilder.
 */

describe("TrajectoryBuilder", () => {
  describe("create", () => {
    it("should create a trajectory with title", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const builder = TrajectoryBuilder.create("Test task");
      const trajectory = builder.build();

      expect(trajectory.task.title).toBe("Test task");
      expect(trajectory.status).toBe("active");
      expect(trajectory.id).toMatch(/^traj_[a-z0-9]+$/);
    });

    it("should support fluent API for building", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Feature X")
        .withDescription("Add new feature X")
        .withProject("my-project")
        .withTags("feature", "v2")
        .build();

      expect(trajectory.task.title).toBe("Feature X");
      expect(trajectory.task.description).toBe("Add new feature X");
      expect(trajectory.projectId).toBe("my-project");
      expect(trajectory.tags).toContain("feature");
      expect(trajectory.tags).toContain("v2");
    });

    it("should support external task source", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Fix bug")
        .withSource({
          system: "github",
          id: "GH#123",
          url: "https://github.com/org/repo/issues/123",
        })
        .build();

      expect(trajectory.task.source?.system).toBe("github");
      expect(trajectory.task.source?.id).toBe("GH#123");
    });
  });

  describe("chapters and events", () => {
    it("should add chapters with events", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Research", "claude")
        .note("Found relevant documentation")
        .finding("Existing pattern discovered")
        .chapter("Implementation", "claude")
        .note("Implementing solution")
        .build();

      expect(trajectory.chapters).toHaveLength(2);
      expect(trajectory.chapters[0].title).toBe("Research");
      expect(trajectory.chapters[0].events).toHaveLength(2);
      expect(trajectory.chapters[1].title).toBe("Implementation");
    });

    it("should record different event types", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Work", "agent")
        .thinking("Considering approaches")
        .toolCall("Read file src/index.ts")
        .toolResult("File contents: ...")
        .error("Compilation error")
        .build();

      const events = trajectory.chapters[0].events;
      expect(events.map((e) => e.type)).toEqual([
        "thinking",
        "tool_call",
        "tool_result",
        "error",
      ]);
    });
  });

  describe("decisions", () => {
    it("should record structured decisions", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Planning", "claude")
        .decision({
          question: "Which library to use?",
          chosen: "Library A",
          reasoning: "Better TypeScript support",
          alternatives: [
            { option: "Library B", reason: "Less maintained" },
            { option: "Library C", reason: "Missing features" },
          ],
        })
        .build();

      const event = trajectory.chapters[0].events[0];
      expect(event.type).toBe("decision");
      expect(event.significance).toBe("high");
      expect(event.raw).toBeDefined();
    });

    it("should support quick decide helper", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Work", "agent")
        .decide("Use TypeScript?", "Yes", "Better type safety")
        .build();

      const event = trajectory.chapters[0].events[0];
      expect(event.type).toBe("decision");
      expect(event.content).toContain("Use TypeScript?");
      expect(event.content).toContain("Yes");
    });
  });

  describe("completion", () => {
    it("should complete with retrospective", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Work", "agent")
        .note("Did the work")
        .complete({
          summary: "Task completed successfully",
          approach: "Standard approach",
          confidence: 0.95,
          challenges: ["Initial setup was tricky"],
          learnings: ["Learned about X"],
        });

      expect(trajectory.status).toBe("completed");
      expect(trajectory.completedAt).toBeDefined();
      expect(trajectory.retrospective?.summary).toBe(
        "Task completed successfully"
      );
      expect(trajectory.retrospective?.confidence).toBe(0.95);
    });

    it("should support quick done helper", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Work", "agent")
        .done("Finished the task", 0.9);

      expect(trajectory.status).toBe("completed");
      expect(trajectory.retrospective?.summary).toBe("Finished the task");
      expect(trajectory.retrospective?.confidence).toBe(0.9);
    });

    it("should support abandonment", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Work", "agent")
        .abandon("Requirements changed");

      expect(trajectory.status).toBe("abandoned");
      expect(trajectory.completedAt).toBeDefined();
    });
  });

  describe("exports", () => {
    it("should export to markdown", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      // Build the trajectory first, then complete and export
      const builder = TrajectoryBuilder.create("Test task")
        .chapter("Work", "agent")
        .note("Did the work");

      // toMarkdown works on the builder before completing
      const markdown = builder.toMarkdown();

      expect(markdown).toContain("Test task");
    });

    it("should export completed trajectory to markdown", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");
      const { exportToMarkdown } = await import("../../src/export/markdown.js");

      const trajectory = TrajectoryBuilder.create("Test task")
        .chapter("Work", "agent")
        .note("Did the work")
        .done("Completed", 0.9);

      const markdown = exportToMarkdown(trajectory);
      expect(markdown).toContain("Test task");
      expect(markdown).toContain("Completed");
    });

    it("should export to JSON", async () => {
      const { TrajectoryBuilder } = await import("../../src/sdk/builder.js");

      const json = TrajectoryBuilder.create("Test task").toJSON();

      const parsed = JSON.parse(json);
      expect(parsed.task.title).toBe("Test task");
    });
  });

  describe("trajectory shorthand", () => {
    it("should create builder with shorthand function", async () => {
      const { trajectory } = await import("../../src/sdk/builder.js");

      const result = trajectory("Quick task")
        .chapter("Work", "agent")
        .done("Done", 0.8);

      expect(result.task.title).toBe("Quick task");
      expect(result.status).toBe("completed");
    });
  });
});

describe("TrajectoryClient", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "traj-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialization", () => {
    it("should initialize client with default options", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({ dataDir: tempDir });
      await client.init();

      // Should not throw
      await client.close();
    });

    it("should throw error if not initialized", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({ dataDir: tempDir });

      await expect(client.start("Test")).rejects.toThrow("not initialized");
    });
  });

  describe("trajectory lifecycle", () => {
    it("should start a new trajectory", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({ dataDir: tempDir });
      await client.init();

      const session = await client.start("New task");

      expect(session.id).toMatch(/^traj_[a-z0-9]+$/);
      expect(session.data.task.title).toBe("New task");
      expect(session.data.status).toBe("active");

      await client.close();
    });

    it("should prevent multiple active trajectories", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({ dataDir: tempDir });
      await client.init();

      await client.start("First task");

      await expect(client.start("Second task")).rejects.toThrow(
        "Active trajectory already exists"
      );

      await client.close();
    });

    it("should resume active trajectory", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({ dataDir: tempDir });
      await client.init();

      const session1 = await client.start("Test task");
      const id = session1.id;

      // Close and reopen client
      await client.close();

      const client2 = new TrajectoryClient({ dataDir: tempDir });
      await client2.init();

      const session2 = await client2.resume();

      expect(session2).not.toBeNull();
      expect(session2!.id).toBe(id);

      await client2.close();
    });
  });

  describe("session operations", () => {
    it("should add chapters and events", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({
        dataDir: tempDir,
        defaultAgent: "test-agent",
      });
      await client.init();

      const session = await client.start("Test task");
      await session.chapter("Research");
      await session.note("Found documentation");
      await session.finding("Existing pattern");

      expect(session.data.chapters).toHaveLength(1);
      expect(session.data.chapters[0].events).toHaveLength(2);

      await client.close();
    });

    it("should record decisions", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({
        dataDir: tempDir,
        defaultAgent: "agent",
      });
      await client.init();

      const session = await client.start("Test");
      await session.chapter("Planning");
      await session.decide("Use X or Y?", "X", "Better performance");

      const event = session.data.chapters[0].events[0];
      expect(event.type).toBe("decision");

      await client.close();
    });

    it("should complete trajectory", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({
        dataDir: tempDir,
        defaultAgent: "agent",
      });
      await client.init();

      const session = await client.start("Test task");
      await session.chapter("Work");
      await session.note("Did the work");

      const completed = await session.done("Task completed", 0.9);

      expect(completed.status).toBe("completed");
      expect(completed.retrospective?.summary).toBe("Task completed");

      // Should be able to start new trajectory now
      const newSession = await client.start("New task");
      expect(newSession.id).toBeDefined();

      await client.close();
    });

    it("should abandon trajectory", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({
        dataDir: tempDir,
        defaultAgent: "agent",
      });
      await client.init();

      const session = await client.start("Test task");
      const abandoned = await session.abandon("No longer needed");

      expect(abandoned.status).toBe("abandoned");

      await client.close();
    });
  });

  describe("listing and search", () => {
    it("should list trajectories", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({
        dataDir: tempDir,
        defaultAgent: "agent",
      });
      await client.init();

      // Create and complete a trajectory
      const session = await client.start("First task");
      await session.chapter("Work");
      await session.done("Done", 0.9);

      // Create another
      const session2 = await client.start("Second task");
      await session2.chapter("Work");
      await session2.done("Also done", 0.8);

      const list = await client.list();

      expect(list).toHaveLength(2);

      await client.close();
    });

    it("should filter by status", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({
        dataDir: tempDir,
        defaultAgent: "agent",
      });
      await client.init();

      const session = await client.start("Test");
      await session.chapter("Work");
      await session.done("Done", 0.9);

      const completed = await client.list({ status: "completed" });
      const active = await client.list({ status: "active" });

      expect(completed).toHaveLength(1);
      expect(active).toHaveLength(0);

      await client.close();
    });
  });

  describe("export methods", () => {
    it("should export to various formats", async () => {
      const { TrajectoryClient } = await import("../../src/sdk/client.js");

      const client = new TrajectoryClient({
        dataDir: tempDir,
        defaultAgent: "agent",
      });
      await client.init();

      const session = await client.start("Export test");
      await session.chapter("Work");
      await session.note("Test note");
      await session.done("Completed", 0.9);

      const markdown = await client.exportMarkdown(session.id);
      const json = await client.exportJSON(session.id);
      const timeline = await client.exportTimeline(session.id);

      expect(markdown).toContain("Export test");
      expect(json).toContain("Export test");
      expect(timeline).toBeDefined();

      await client.close();
    });
  });
});

describe("SDK exports", () => {
  it("should export all SDK components from main index", async () => {
    const sdk = await import("../../src/index.js");

    expect(sdk.TrajectoryClient).toBeDefined();
    expect(sdk.TrajectorySession).toBeDefined();
    expect(sdk.TrajectoryBuilder).toBeDefined();
    expect(sdk.trajectory).toBeDefined();
  });

  it("should export from sdk subpath", async () => {
    const sdk = await import("../../src/sdk/index.js");

    expect(sdk.TrajectoryClient).toBeDefined();
    expect(sdk.TrajectoryBuilder).toBeDefined();
    expect(sdk.trajectory).toBeDefined();
    expect(sdk.TrajectoryError).toBeDefined();
    expect(sdk.FileStorage).toBeDefined();
    expect(sdk.validateTrajectory).toBeDefined();
  });
});
