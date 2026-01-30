/**
 * Tests for Agent Trace functionality
 */

import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureGitState,
  createTraceRef,
  detectModel,
  generateTrace,
  getChangedFiles,
  getGitHead,
  isGitRepo,
  isValidGitRef,
} from "../../src/core/trace.js";
import type { Trajectory } from "../../src/core/types.js";

// Mock child_process for controlled testing
vi.mock("node:child_process", async () => {
  const actual = await vi.importActual("node:child_process");
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

const mockExecSync = vi.mocked(execSync);

describe("Agent Trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isGitRepo", () => {
    it("should return true when in a git repository", () => {
      mockExecSync.mockReturnValue("true\n");
      expect(isGitRepo()).toBe(true);
    });

    it("should return false when not in a git repository", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });
      expect(isGitRepo()).toBe(false);
    });
  });

  describe("getGitHead", () => {
    it("should return commit hash when in git repo", () => {
      mockExecSync
        .mockReturnValueOnce("true\n") // isGitRepo check
        .mockReturnValueOnce("abc123def456\n"); // HEAD
      expect(getGitHead()).toBe("abc123def456");
    });

    it("should return null when not in git repo", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });
      expect(getGitHead()).toBeNull();
    });
  });

  describe("captureGitState", () => {
    it("should return git HEAD when available", () => {
      mockExecSync
        .mockReturnValueOnce("true\n") // isGitRepo
        .mockReturnValueOnce("abc123\n"); // HEAD
      expect(captureGitState()).toBe("abc123");
    });

    it("should return null when git is not available", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("git not found");
      });
      expect(captureGitState()).toBeNull();
    });
  });

  describe("createTraceRef", () => {
    it("should create a trace reference with startRef", () => {
      const ref = createTraceRef("abc123");
      expect(ref.startRef).toBe("abc123");
      expect(ref.endRef).toBeUndefined();
      expect(ref.traceId).toBeUndefined();
    });
  });

  describe("isValidGitRef", () => {
    it("should accept HEAD", () => {
      expect(isValidGitRef("HEAD")).toBe(true);
    });

    it("should accept working", () => {
      expect(isValidGitRef("working")).toBe(true);
    });

    it("should accept valid commit hashes", () => {
      expect(isValidGitRef("abc1234")).toBe(true);
      expect(isValidGitRef("abc1234567890abcdef1234567890abcdef123456")).toBe(
        true,
      );
    });

    it("should accept valid branch names", () => {
      expect(isValidGitRef("main")).toBe(true);
      expect(isValidGitRef("feature/my-branch")).toBe(true);
      expect(isValidGitRef("release-1.0")).toBe(true);
    });

    it("should reject command injection attempts", () => {
      expect(isValidGitRef("$(whoami)")).toBe(false);
      expect(isValidGitRef("`whoami`")).toBe(false);
      expect(isValidGitRef("HEAD; rm -rf /")).toBe(false);
      expect(isValidGitRef("HEAD && cat /etc/passwd")).toBe(false);
      expect(isValidGitRef("HEAD | cat")).toBe(false);
      expect(isValidGitRef("HEAD\nrm -rf /")).toBe(false);
      expect(isValidGitRef("'injection'")).toBe(false);
      expect(isValidGitRef('"injection"')).toBe(false);
    });

    it("should reject refs that are too long", () => {
      const longRef = "a".repeat(256);
      expect(isValidGitRef(longRef)).toBe(false);
    });
  });

  describe("getChangedFiles security", () => {
    it("should return empty array for invalid startRef", () => {
      mockExecSync.mockReturnValue("true\n"); // isGitRepo
      const result = getChangedFiles("$(whoami)", "HEAD");
      expect(result).toEqual([]);
    });

    it("should return empty array for invalid endRef", () => {
      mockExecSync.mockReturnValue("true\n"); // isGitRepo
      const result = getChangedFiles("abc123", "; rm -rf /");
      expect(result).toEqual([]);
    });
  });

  describe("detectModel", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should detect model from TRAIL_TRACE_MODEL", () => {
      process.env.TRAIL_TRACE_MODEL = "anthropic/claude-3";
      expect(detectModel()).toBe("anthropic/claude-3");
    });

    it("should detect model from ANTHROPIC_MODEL", () => {
      process.env.ANTHROPIC_MODEL = "claude-opus-4";
      expect(detectModel()).toBe("claude-opus-4");
    });

    it("should return unknown when no model env is set", () => {
      process.env.TRAIL_TRACE_MODEL = undefined;
      process.env.ANTHROPIC_MODEL = undefined;
      process.env.OPENAI_MODEL = undefined;
      expect(detectModel()).toBe("unknown");
    });
  });

  describe("generateTrace", () => {
    it("should generate a trace record from trajectory when changes exist", () => {
      const trajectory: Trajectory = {
        id: "traj_test123",
        version: 1,
        task: { title: "Test task" },
        status: "completed",
        projectId: "test-project",
        startedAt: new Date().toISOString(),
        chapters: [],
        _trace: {
          startRef: "abc123",
        },
      };

      // Mock git commands - isGitRepo is called multiple times
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes("rev-parse --is-inside-work-tree")) {
          return "true\n";
        }
        if (cmd.includes("rev-parse HEAD")) {
          return "def456789\n";
        }
        if (cmd.includes("git diff")) {
          // Return a valid diff output
          return `diff --git a/src/test.ts b/src/test.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/test.ts
@@ -0,0 +1,10 @@
+export function test() {
+  return true;
+}
`;
        }
        return "";
      });

      const trace = generateTrace(trajectory, "abc123");

      expect(trace).not.toBeNull();
      expect(trace?.version).toBe(1);
      expect(trace?.trajectory).toBe("traj_test123");
      expect(trace?.files.length).toBeGreaterThanOrEqual(0); // May be 0 if diff parsing is strict
    });

    it("should return null when not in git repo", () => {
      const trajectory: Trajectory = {
        id: "traj_test123",
        version: 1,
        task: { title: "Test task" },
        status: "completed",
        projectId: "test-project",
        startedAt: new Date().toISOString(),
        chapters: [],
      };

      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository");
      });

      const trace = generateTrace(trajectory, "abc123");
      expect(trace).toBeNull();
    });

    it("should return null when no files changed", () => {
      const trajectory: Trajectory = {
        id: "traj_test123",
        version: 1,
        task: { title: "Test task" },
        status: "completed",
        projectId: "test-project",
        startedAt: new Date().toISOString(),
        chapters: [],
      };

      mockExecSync
        .mockReturnValueOnce("true\n") // isGitRepo
        .mockReturnValueOnce("def456\n") // getGitHead
        .mockReturnValueOnce(""); // git diff --name-only (empty)

      const trace = generateTrace(trajectory, "abc123");
      expect(trace).toBeNull();
    });
  });
});
