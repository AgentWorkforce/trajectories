import { describe, expect, it } from "vitest";

/**
 * Test stubs for Export functionality
 *
 * These tests define the expected behavior of the export system.
 * All tests should FAIL until implementation is complete.
 *
 * Coverage: happy path, edge cases, error scenarios
 * Structure: Arrange-Act-Assert
 */

describe("Markdown Export", () => {
  describe("exportToMarkdown", () => {
    it("should generate markdown with trajectory title", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Implement user auth" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Added JWT authentication",
        approach: "Used existing patterns",
        confidence: 0.85,
      });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("# Trajectory: Implement user auth");
    });

    it("should include status and metadata", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.85,
      });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("**Status:** ✅ Completed");
      expect(markdown).toContain("**Confidence:** 85%");
    });

    it("should include external task reference if present", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const trajectory = createTrajectory({
        title: "Fix bug",
        source: {
          system: "github",
          id: "GH#123",
          url: "https://github.com/org/repo/issues/123",
        },
      });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("[GH#123]");
      expect(markdown).toContain("https://github.com/org/repo/issues/123");
    });

    it("should include retrospective summary", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Implemented JWT-based authentication with refresh tokens",
        approach: "Followed existing auth patterns in codebase",
        confidence: 0.85,
      });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("## Summary");
      expect(markdown).toContain("JWT-based authentication");
    });

    it("should include decisions section", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory, addChapter, addDecision, completeTrajectory } =
        await import("../../src/core/trajectory.js");
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = addChapter(trajectory, {
        title: "Work",
        agentName: "Alice",
      });
      trajectory = addDecision(trajectory, {
        question: "Auth strategy",
        chosen: "JWT with refresh tokens",
        alternatives: ["Sessions", "OAuth only"],
        reasoning: "Stateless for horizontal scaling",
      });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("## Key Decisions");
      expect(markdown).toContain("### Auth strategy");
      expect(markdown).toContain("**Chose:** JWT with refresh tokens");
      expect(markdown).toContain("**Rejected:** Sessions, OAuth only");
      expect(markdown).toContain(
        "**Reasoning:** Stateless for horizontal scaling",
      );
    });

    it("should include chapters section", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory, addChapter } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = addChapter(trajectory, {
        title: "Initial exploration",
        agentName: "Alice",
      });
      trajectory = addChapter(trajectory, {
        title: "Implementation",
        agentName: "Alice",
      });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("## Chapters");
      expect(markdown).toContain("### 1. Initial exploration");
      expect(markdown).toContain("### 2. Implementation");
    });

    it("should include challenges and learnings", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        challenges: ["Type definitions were wrong", "Tests were flaky"],
        learnings: ["Check types early", "Mock external services"],
        confidence: 0.85,
      });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("## Challenges");
      expect(markdown).toContain("Type definitions were wrong");
      expect(markdown).toContain("## Learnings");
      expect(markdown).toContain("Check types early");
    });

    it("should handle trajectory without retrospective", async () => {
      // Arrange
      const { exportToMarkdown } = await import("../../src/export/markdown.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const trajectory = createTrajectory({ title: "Active task" });

      // Act
      const markdown = exportToMarkdown(trajectory);

      // Assert
      expect(markdown).toContain("**Status:** 🔄 Active");
      expect(markdown).not.toContain("## Summary");
    });
  });
});

describe("JSON Export", () => {
  describe("exportToJSON", () => {
    it("should export full trajectory as formatted JSON", async () => {
      // Arrange
      const { exportToJSON } = await import("../../src/export/json.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const trajectory = createTrajectory({ title: "Test task" });

      // Act
      const json = exportToJSON(trajectory);

      // Assert
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(trajectory.id);
      expect(parsed.task.title).toBe("Test task");
    });

    it("should pretty-print by default", async () => {
      // Arrange
      const { exportToJSON } = await import("../../src/export/json.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const trajectory = createTrajectory({ title: "Test task" });

      // Act
      const json = exportToJSON(trajectory);

      // Assert
      expect(json).toContain("\n"); // Pretty printed has newlines
    });

    it("should support compact mode", async () => {
      // Arrange
      const { exportToJSON } = await import("../../src/export/json.js");
      const { createTrajectory } = await import("../../src/core/trajectory.js");
      const trajectory = createTrajectory({ title: "Test task" });

      // Act
      const json = exportToJSON(trajectory, { compact: true });

      // Assert
      expect(json).not.toContain("\n");
    });
  });
});

describe("Timeline Export", () => {
  describe("exportToTimeline", () => {
    it("should generate chronological timeline", async () => {
      // Arrange
      const { exportToTimeline } = await import("../../src/export/timeline.js");
      const { createTrajectory, addChapter, addEvent, completeTrajectory } =
        await import("../../src/core/trajectory.js");
      let trajectory = createTrajectory({ title: "Test task" });
      trajectory = addChapter(trajectory, {
        title: "Work",
        agentName: "Alice",
      });
      trajectory = addEvent(trajectory, {
        type: "tool_call",
        content: "Read file",
      });
      trajectory = addEvent(trajectory, {
        type: "decision",
        content: "Chose approach A",
      });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });

      // Act
      const timeline = exportToTimeline(trajectory);

      // Assert
      expect(timeline).toContain("●");
      expect(timeline).toContain("Started:");
      expect(timeline).toContain("├─");
      expect(timeline).toContain("Chose approach A");
      expect(timeline).toContain("○");
      expect(timeline).toContain("Completed");
    });

    it("should show chapter markers", async () => {
      // Arrange
      const { exportToTimeline } = await import("../../src/export/timeline.js");
      const { createTrajectory, addChapter } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = addChapter(trajectory, {
        title: "Phase 1",
        agentName: "Alice",
      });
      trajectory = addChapter(trajectory, {
        title: "Phase 2",
        agentName: "Bob",
      });

      // Act
      const timeline = exportToTimeline(trajectory);

      // Assert
      expect(timeline).toContain("Chapter: Phase 1");
      expect(timeline).toContain("Chapter: Phase 2");
    });

    it("should highlight decisions", async () => {
      // Arrange
      const { exportToTimeline } = await import("../../src/export/timeline.js");
      const { createTrajectory, addChapter, addDecision } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = addChapter(trajectory, {
        title: "Work",
        agentName: "Alice",
      });
      trajectory = addDecision(trajectory, {
        question: "Auth strategy",
        chosen: "JWT",
        alternatives: ["Sessions"],
        reasoning: "Stateless",
      });

      // Act
      const timeline = exportToTimeline(trajectory);

      // Assert
      expect(timeline).toContain("Decision:");
      expect(timeline).toContain("JWT");
    });
  });
});

describe("PR Summary Export", () => {
  describe("exportToPRSummary", () => {
    it("should generate concise PR-friendly summary", async () => {
      // Arrange
      const { exportToPRSummary } = await import(
        "../../src/export/pr-summary.js"
      );
      const { createTrajectory, addChapter, addDecision, completeTrajectory } =
        await import("../../src/core/trajectory.js");
      let trajectory = createTrajectory({ title: "Add user authentication" });
      trajectory = addChapter(trajectory, {
        title: "Work",
        agentName: "Alice",
      });
      trajectory = addDecision(trajectory, {
        question: "Auth strategy",
        chosen: "JWT",
        alternatives: ["Sessions"],
        reasoning: "Stateless",
      });
      trajectory = completeTrajectory(trajectory, {
        summary: "Implemented JWT-based auth",
        approach: "Used existing patterns",
        confidence: 0.85,
      });

      // Act
      const summary = exportToPRSummary(trajectory);

      // Assert
      expect(summary).toContain("## Trajectory Summary");
      expect(summary).toContain("JWT-based auth");
      expect(summary).toContain("**Confidence:** 85%");
      expect(summary).toContain("**Key decisions:** 1");
    });

    it("should include link to full trajectory", async () => {
      // Arrange
      const { exportToPRSummary } = await import(
        "../../src/export/pr-summary.js"
      );
      const { createTrajectory, completeTrajectory } = await import(
        "../../src/core/trajectory.js"
      );
      let trajectory = createTrajectory({ title: "Test" });
      trajectory = completeTrajectory(trajectory, {
        summary: "Done",
        approach: "Test",
        confidence: 0.9,
      });

      // Act
      const summary = exportToPRSummary(trajectory, {
        trajectoryPath: ".trajectories/traj_abc.md",
      });

      // Assert
      expect(summary).toContain("[Full trajectory](.trajectories/traj_abc.md)");
    });
  });
});
