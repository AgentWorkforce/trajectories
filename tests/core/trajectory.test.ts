import { describe, it, expect } from "vitest";

/**
 * Test stubs for core Trajectory functionality
 *
 * These tests define the expected behavior of the trajectory system.
 * All tests should FAIL until implementation is complete.
 *
 * Coverage: happy path, edge cases, error scenarios
 * Structure: Arrange-Act-Assert
 */

describe("Trajectory", () => {
  describe("createTrajectory", () => {
    it("should create a trajectory with required fields", async () => {
      // Arrange
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const input = {
        title: "Implement user authentication",
      };

      // Act
      const trajectory = createTrajectory(input);

      // Assert
      expect(trajectory.id).toMatch(/^traj_[a-z0-9]+$/);
      expect(trajectory.version).toBe(1);
      expect(trajectory.task.title).toBe("Implement user authentication");
      expect(trajectory.status).toBe("active");
      expect(trajectory.startedAt).toBeDefined();
      expect(trajectory.agents).toEqual([]);
      expect(trajectory.chapters).toEqual([]);
    });

    it("should create a trajectory with external task reference", async () => {
      // Arrange
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const input = {
        title: "Fix auth bug",
        source: {
          system: "github" as const,
          id: "GH#123",
          url: "https://github.com/org/repo/issues/123",
        },
      };

      // Act
      const trajectory = createTrajectory(input);

      // Assert
      expect(trajectory.task.source).toEqual(input.source);
    });

    it("should generate unique IDs for each trajectory", async () => {
      // Arrange
      const { createTrajectory } = await import("../../src/core/trajectory.js");

      // Act
      const traj1 = createTrajectory({ title: "Task 1" });
      const traj2 = createTrajectory({ title: "Task 2" });

      // Assert
      expect(traj1.id).not.toBe(traj2.id);
    });

    it("should throw error for empty title", async () => {
      // Arrange
      const { createTrajectory } = await import("../../src/core/trajectory.js");

      // Act & Assert
      expect(() => createTrajectory({ title: "" })).toThrow(
        "Trajectory title is required"
      );
    });

    it("should throw error for title exceeding max length", async () => {
      // Arrange
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const longTitle = "a".repeat(501);

      // Act & Assert
      expect(() => createTrajectory({ title: longTitle })).toThrow(
        "Trajectory title must be 500 characters or less"
      );
    });
  });

  describe("addChapter", () => {
    it("should add a chapter to an active trajectory", async () => {
      // Arrange
      const { createTrajectory, addChapter } = await import(
        "../../src/core/trajectory.js"
      );
      const trajectory = createTrajectory({ title: "Test task" });
      const chapterInput = {
        title: "Initial exploration",
        agentName: "Alice",
      };

      // Act
      const updated = addChapter(trajectory, chapterInput);

      // Assert
      expect(updated.chapters).toHaveLength(1);
      expect(updated.chapters[0].title).toBe("Initial exploration");
      expect(updated.chapters[0].agentName).toBe("Alice");
      expect(updated.chapters[0].startedAt).toBeDefined();
      expect(updated.chapters[0].events).toEqual([]);
    });

    it("should end the previous chapter when adding a new one", async () => {
      // Arrange
      const { createTrajectory, addChapter } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = addChapter(trajectory, {
        title: "Chapter 1",
        agentName: "Alice",
      });

      // Act
      const updated = addChapter(trajectory, {
        title: "Chapter 2",
        agentName: "Bob",
      });

      // Assert
      expect(updated.chapters).toHaveLength(2);
      expect(updated.chapters[0].endedAt).toBeDefined();
      expect(updated.chapters[1].endedAt).toBeUndefined();
    });

    it("should throw error when adding chapter to completed trajectory", async () => {
      // Arrange
      const { createTrajectory, completeTrajectory, addChapter } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test approach",
        confidence: 0.9,
      });

      // Act & Assert
      expect(() =>
        addChapter(trajectory, { title: "New chapter", agentName: "Alice" })
      ).toThrow("Cannot add chapter to completed trajectory");
    });
  });

  describe("addEvent", () => {
    it("should add an event to the current chapter", async () => {
      // Arrange
      const { createTrajectory, addChapter, addEvent } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = addChapter(trajectory, {
        title: "Working",
        agentName: "Alice",
      });
      const event = {
        type: "decision" as const,
        content: "Chose JWT over sessions",
      };

      // Act
      const updated = addEvent(trajectory, event);

      // Assert
      const currentChapter = updated.chapters[updated.chapters.length - 1];
      expect(currentChapter.events).toHaveLength(1);
      expect(currentChapter.events[0].type).toBe("decision");
      expect(currentChapter.events[0].content).toBe("Chose JWT over sessions");
      expect(currentChapter.events[0].ts).toBeDefined();
    });

    it("should auto-create a chapter if none exists", async () => {
      // Arrange
      const { createTrajectory, addEvent } = await import(
        "../../src/core/trajectory.js"
      );
      const trajectory = createTrajectory({ title: "Test task" });
      const event = {
        type: "tool_call" as const,
        content: "Read file src/auth.ts",
      };

      // Act
      const updated = addEvent(trajectory, event);

      // Assert
      expect(updated.chapters).toHaveLength(1);
      expect(updated.chapters[0].title).toBe("Work");
      expect(updated.chapters[0].events).toHaveLength(1);
    });

    it("should support event significance levels", async () => {
      // Arrange
      const { createTrajectory, addChapter, addEvent } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = addChapter(trajectory, {
        title: "Working",
        agentName: "Alice",
      });

      // Act
      const updated = addEvent(trajectory, {
        type: "decision" as const,
        content: "Critical architectural choice",
        significance: "critical" as const,
      });

      // Assert
      const event = updated.chapters[0].events[0];
      expect(event.significance).toBe("critical");
    });
  });

  describe("addDecision", () => {
    it("should add a structured decision event", async () => {
      // Arrange
      const { createTrajectory, addChapter, addDecision } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = addChapter(trajectory, {
        title: "Working",
        agentName: "Alice",
      });
      const decision = {
        question: "Which auth strategy?",
        chosen: "JWT with refresh tokens",
        alternatives: ["Sessions", "OAuth only"],
        reasoning: "Stateless for horizontal scaling",
      };

      // Act
      const updated = addDecision(trajectory, decision);

      // Assert
      const event = updated.chapters[0].events[0];
      expect(event.type).toBe("decision");
      expect(event.significance).toBe("high");
      expect(event.raw).toEqual(decision);
    });
  });

  describe("completeTrajectory", () => {
    it("should mark trajectory as completed with retrospective", async () => {
      // Arrange
      const { createTrajectory, addChapter, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = addChapter(trajectory, {
        title: "Working",
        agentName: "Alice",
      });
      const retrospective = {
        summary: "Implemented JWT auth",
        approach: "Used existing patterns",
        decisions: [
          {
            question: "Auth strategy",
            chosen: "JWT",
            alternatives: ["Sessions"],
            reasoning: "Stateless",
          },
        ],
        challenges: ["Type definitions were wrong"],
        learnings: ["Check types early"],
        suggestions: ["Add more tests"],
        confidence: 0.85,
      };

      // Act
      const completed = completeTrajectory(trajectory, retrospective);

      // Assert
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeDefined();
      expect(completed.retrospective).toEqual(retrospective);
      expect(completed.chapters[0].endedAt).toBeDefined();
    });

    it("should require summary and confidence for retrospective", async () => {
      // Arrange
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const trajectory = createTrajectory({ title: "Test task" });

      // Act & Assert
      expect(() =>
        completeTrajectory(trajectory, {
          summary: "",
          approach: "Test",
          confidence: 0.5,
        })
      ).toThrow("Retrospective summary is required");
    });

    it("should validate confidence is between 0 and 1", async () => {
      // Arrange
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const trajectory = createTrajectory({ title: "Test task" });

      // Act & Assert
      expect(() =>
        completeTrajectory(trajectory, {
          summary: "Done",
          approach: "Test",
          confidence: 1.5,
        })
      ).toThrow("Confidence must be between 0 and 1");
    });

    it("should not allow completing an already completed trajectory", async () => {
      // Arrange
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });

      // Act & Assert
      expect(() =>
        completeTrajectory(trajectory, {
          summary: "Done again",
          approach: "Test",
          confidence: 0.9,
        })
      ).toThrow("Trajectory is already completed");
    });
  });

  describe("abandonTrajectory", () => {
    it("should mark trajectory as abandoned", async () => {
      // Arrange
      const { createTrajectory, abandonTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      const trajectory = createTrajectory({ title: "Test task" });

      // Act
      const abandoned = abandonTrajectory(trajectory, "Requirements changed");

      // Assert
      expect(abandoned.status).toBe("abandoned");
      expect(abandoned.completedAt).toBeDefined();
    });
  });
});

describe("TrajectorySchema", () => {
  describe("validation", () => {
    it("should validate a complete trajectory", async () => {
      // Arrange
      const { validateTrajectory } = await import("../../src/core/schema.js");
      const validTrajectory = {
        id: "traj_abc123",
        version: 1,
        task: { title: "Test task" },
        status: "active",
        startedAt: new Date().toISOString(),
        agents: [],
        chapters: [],
        commits: [],
        filesChanged: [],
        projectId: "proj_123",
        tags: [],
      };

      // Act
      const result = validateTrajectory(validTrajectory);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject trajectory with invalid status", async () => {
      // Arrange
      const { validateTrajectory } = await import("../../src/core/schema.js");
      const invalidTrajectory = {
        id: "traj_abc123",
        version: 1,
        task: { title: "Test" },
        status: "invalid_status",
        startedAt: new Date().toISOString(),
        agents: [],
        chapters: [],
      };

      // Act
      const result = validateTrajectory(invalidTrajectory);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject trajectory without required fields", async () => {
      // Arrange
      const { validateTrajectory } = await import("../../src/core/schema.js");
      const incompleteTrajectory = {
        id: "traj_abc123",
      };

      // Act
      const result = validateTrajectory(incompleteTrajectory);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
