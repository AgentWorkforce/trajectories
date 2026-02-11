/**
 * Tests for git trailer utilities
 */

import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRAJECTORY_TRAILER_KEY,
  detectExistingHook,
  formatTrailer,
  generateHookScript,
  getCommitsBetween,
  getFilesChangedBetween,
  getTrajectoryFromCommit,
  parseTrajectoryFromMessage,
} from "../../src/core/trailers.js";

// Mock child_process for controlled testing
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process");
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

const mockExecSync = vi.mocked(execSync);

describe("Git Trailers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatTrailer", () => {
    it("should format a trajectory trailer", () => {
      const trailer = formatTrailer("traj_abc123def456");
      expect(trailer).toBe("Trajectory: traj_abc123def456");
    });

    it("should use the correct trailer key", () => {
      expect(TRAJECTORY_TRAILER_KEY).toBe("Trajectory");
    });
  });

  describe("parseTrajectoryFromMessage", () => {
    it("should parse trajectory ID from a commit message with trailer", () => {
      const message = `Fix authentication bug

Added JWT validation to middleware.

Trajectory: traj_abc123def456`;

      expect(parseTrajectoryFromMessage(message)).toBe("traj_abc123def456");
    });

    it("should return null when no trailer exists", () => {
      const message = "Simple commit message\n\nNo trailers here.";
      expect(parseTrajectoryFromMessage(message)).toBeNull();
    });

    it("should return null for malformed trailer", () => {
      const message = "Commit\n\nTrajectory: not-a-valid-id";
      expect(parseTrajectoryFromMessage(message)).toBeNull();
    });

    it("should handle message with multiple trailers", () => {
      const message = `Implement feature

Co-authored-by: Bot <bot@example.com>
Trajectory: traj_xyz789abc012
Signed-off-by: Dev <dev@example.com>`;

      expect(parseTrajectoryFromMessage(message)).toBe("traj_xyz789abc012");
    });

    it("should handle message with only trailer line", () => {
      const message = "Trajectory: traj_simple123456";
      expect(parseTrajectoryFromMessage(message)).toBe("traj_simple123456");
    });
  });

  describe("getTrajectoryFromCommit", () => {
    it("should extract trajectory ID from a commit", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("git log -1 --format=%B")) {
          return "Fix bug\n\nTrajectory: traj_abc123def456\n";
        }
        return "";
      });

      expect(getTrajectoryFromCommit("abc123")).toBe("traj_abc123def456");
    });

    it("should return null for commit without trailer", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("git log -1 --format=%B")) {
          return "Plain commit message\n";
        }
        return "";
      });

      expect(getTrajectoryFromCommit("abc123")).toBeNull();
    });

    it("should return null when not in git repo", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(getTrajectoryFromCommit("abc123")).toBeNull();
    });

    it("should reject invalid git refs", () => {
      mockExecSync.mockReturnValue("true\n"); // isGitRepo
      expect(getTrajectoryFromCommit("$(whoami)")).toBeNull();
    });
  });

  describe("getCommitsBetween", () => {
    it("should return commits between two refs", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("git log")) {
          return [
            "abc123def456abc123def456abc123def456abc1",
            "abc123d",
            "Fix auth bug",
            "Alice",
            "2026-01-15T10:00:00-05:00",
            "---",
            "def456abc123def456abc123def456abc123def4",
            "def456a",
            "Add login page",
            "Bob",
            "2026-01-14T09:00:00-05:00",
          ].join("\n");
        }
        return "";
      });

      const commits = getCommitsBetween("start123", "end456");
      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe("abc123d");
      expect(commits[0].subject).toBe("Fix auth bug");
      expect(commits[0].author).toBe("Alice");
      expect(commits[1].hash).toBe("def456a");
      expect(commits[1].subject).toBe("Add login page");
    });

    it("should return empty array when no commits exist", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("git log")) {
          return "\n";
        }
        return "";
      });

      expect(getCommitsBetween("start123", "end456")).toEqual([]);
    });

    it("should return empty array when not in git repo", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(getCommitsBetween("start", "end")).toEqual([]);
    });

    it("should reject invalid git refs", () => {
      mockExecSync.mockReturnValue("true\n"); // isGitRepo
      expect(getCommitsBetween("$(whoami)", "HEAD")).toEqual([]);
      expect(getCommitsBetween("abc123", "; rm -rf /")).toEqual([]);
    });

    it("should default endRef to HEAD", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("git log")) {
          expect(cmd).toContain("start123..HEAD");
          return "";
        }
        return "";
      });

      getCommitsBetween("start123");
    });
  });

  describe("getFilesChangedBetween", () => {
    it("should return changed file paths", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("git diff --name-only")) {
          return "src/auth.ts\nsrc/login.ts\ntests/auth.test.ts\n";
        }
        return "";
      });

      const files = getFilesChangedBetween("start123", "end456");
      expect(files).toEqual([
        "src/auth.ts",
        "src/login.ts",
        "tests/auth.test.ts",
      ]);
    });

    it("should return empty array when no files changed", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("git diff --name-only")) {
          return "\n";
        }
        return "";
      });

      expect(getFilesChangedBetween("start123", "end456")).toEqual([]);
    });

    it("should return empty array for invalid refs", () => {
      mockExecSync.mockReturnValue("true\n");
      expect(getFilesChangedBetween("$(whoami)", "HEAD")).toEqual([]);
    });
  });

  describe("generateHookScript", () => {
    it("should generate a valid shell script", () => {
      const script = generateHookScript();
      expect(script).toContain("#!/bin/sh");
      expect(script).toContain("agent-trajectories");
      expect(script).toContain("Trajectory:");
    });

    it("should skip merge and squash commits", () => {
      const script = generateHookScript();
      expect(script).toContain('"merge"');
      expect(script).toContain('"squash"');
    });

    it("should check for existing trailer before appending", () => {
      const script = generateHookScript();
      expect(script).toContain('grep -q "^Trajectory: "');
    });

    it("should use TRAJECTORIES_DATA_DIR env var", () => {
      const script = generateHookScript();
      expect(script).toContain("TRAJECTORIES_DATA_DIR");
    });
  });

  describe("detectExistingHook", () => {
    it("should return 'none' when not in git repo", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      expect(detectExistingHook()).toBe("none");
    });

    it("should return 'ours' when our hook is installed", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("rev-parse --git-dir")) {
          return ".git\n";
        }
        if (cmd.includes("cat")) {
          return "#!/bin/sh\n# Added by agent-trajectories\n";
        }
        return "";
      });

      expect(detectExistingHook()).toBe("ours");
    });

    it("should return 'other' when a different hook exists", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("rev-parse --git-dir")) {
          return ".git\n";
        }
        if (cmd.includes("cat")) {
          return "#!/bin/sh\n# Some other hook\n";
        }
        return "";
      });

      expect(detectExistingHook()).toBe("other");
    });

    it("should return 'none' when no hook file exists", () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("rev-parse --git-dir")) {
          return ".git\n";
        }
        if (cmd.includes("cat")) {
          throw new Error("No such file");
        }
        return "";
      });

      expect(detectExistingHook()).toBe("none");
    });
  });
});
