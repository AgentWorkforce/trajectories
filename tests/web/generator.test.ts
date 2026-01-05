import { describe, it, expect } from "vitest";
import {
  generateTrajectoryHtml,
  generateIndexHtml,
} from "../../src/web/generator.js";
import type { Trajectory } from "../../src/core/types.js";

describe("Web Generator", () => {
  const mockTrajectory: Trajectory = {
    id: "traj_test123",
    version: 1,
    task: {
      title: "Implement authentication",
      description: "Add JWT-based auth",
      source: {
        system: "github",
        id: "GH#123",
      },
    },
    status: "completed",
    startedAt: "2024-01-15T10:00:00Z",
    completedAt: "2024-01-15T12:30:00Z",
    agents: [{ name: "Claude", role: "lead", joinedAt: "2024-01-15T10:00:00Z" }],
    chapters: [
      {
        id: "ch_1",
        title: "Research",
        agentName: "Claude",
        startedAt: "2024-01-15T10:00:00Z",
        events: [
          {
            ts: new Date("2024-01-15T10:15:00Z").getTime(),
            type: "decision",
            content: "Use JWT over sessions",
            raw: {
              question: "Auth strategy",
              chosen: "JWT",
              reasoning: "Stateless scaling requirement",
              alternatives: ["Sessions", "OAuth"],
            },
          },
          {
            ts: new Date("2024-01-15T10:20:00Z").getTime(),
            type: "note",
            content: "Found existing auth middleware",
          },
        ],
      },
      {
        id: "ch_2",
        title: "Implementation",
        agentName: "Claude",
        startedAt: "2024-01-15T11:00:00Z",
        events: [],
      },
    ],
    retrospective: {
      summary: "Successfully implemented JWT auth",
      approach: "Used existing middleware patterns",
      confidence: 0.85,
      learnings: ["Clean implementation", "Good test coverage"],
      challenges: ["Token refresh logic was tricky"],
      suggestions: ["Start with integration tests"],
    },
    commits: ["abc123", "def456"],
    filesChanged: ["src/auth/jwt.ts", "src/middleware/auth.ts"],
    projectId: "test-project",
    tags: ["auth", "security"],
  };

  describe("generateTrajectoryHtml", () => {
    it("should generate valid HTML", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("should include trajectory title", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("Implement authentication");
    });

    it("should include trajectory ID", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("traj_test123");
    });

    it("should include status", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("completed");
      expect(html).toContain("status-completed");
    });

    it("should include decisions", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("Auth strategy");
      expect(html).toContain("JWT");
      expect(html).toContain("Stateless scaling requirement");
      expect(html).toContain("Sessions");
    });

    it("should include chapters", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("Research");
      expect(html).toContain("Implementation");
      expect(html).toContain("Chapters (2)");
    });

    it("should include retrospective", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("Retrospective");
      expect(html).toContain("Successfully implemented JWT auth");
      expect(html).toContain("85%");
      expect(html).toContain("Clean implementation");
    });

    it("should include files changed", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("src/auth/jwt.ts");
      expect(html).toContain("src/middleware/auth.ts");
    });

    it("should include commits", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("abc123");
      expect(html).toContain("def456");
    });

    it("should include source reference", () => {
      const html = generateTrajectoryHtml(mockTrajectory);

      expect(html).toContain("github");
      expect(html).toContain("GH#123");
    });

    it("should escape HTML in content", () => {
      const trajWithHtml: Trajectory = {
        ...mockTrajectory,
        task: {
          title: "<script>alert('xss')</script>",
        },
      };

      const html = generateTrajectoryHtml(trajWithHtml);

      expect(html).not.toContain("<script>alert");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("generateIndexHtml", () => {
    it("should generate valid HTML", () => {
      const html = generateIndexHtml([mockTrajectory]);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
    });

    it("should list trajectories", () => {
      const html = generateIndexHtml([mockTrajectory]);

      expect(html).toContain("Implement authentication");
      expect(html).toContain("traj_test123.html");
    });

    it("should group by status", () => {
      const active: Trajectory = { ...mockTrajectory, id: "traj_active", status: "active" };
      const completed: Trajectory = { ...mockTrajectory, id: "traj_done", status: "completed" };

      const html = generateIndexHtml([active, completed]);

      expect(html).toContain("Active (1)");
      expect(html).toContain("Completed (1)");
    });

    it("should show empty state", () => {
      const html = generateIndexHtml([]);

      expect(html).toContain("No trajectories yet");
      expect(html).toContain("trail start");
    });

    it("should show total count", () => {
      const html = generateIndexHtml([mockTrajectory, mockTrajectory]);

      expect(html).toContain("2 total trajectories");
    });
  });
});
