/**
 * Tests for git trailer utilities
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

// Mock node:fs for readFileSync
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

const mockExecSync = vi.mocked(execSync);
const mockReadFileSync = vi.mocked(readFileSync);

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

    it("should parse legacy timestamp-hex ids with internal underscores", () => {
      // Legacy `traj_<timestamp>_<hex>` format emitted by the workforce
      // workflow runner via @agent-relay/sdk. The parser must return the
      // FULL id, not a truncated prefix.
      const message = "Commit\n\nTrajectory: traj_1775734701264_ba65c69b";
      expect(parseTrajectoryFromMessage(message)).toBe(
        "traj_1775734701264_ba65c69b",
      );
    });

    it("should parse legacy id even when other trailers follow", () => {
      const message = `Fix thing

Trajectory: traj_1775832005024_c2cf5052
Co-authored-by: Someone <x@y.z>`;
      expect(parseTrajectoryFromMessage(message)).toBe(
        "traj_1775832005024_c2cf5052",
      );
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

    it("should use an id character class that accepts legacy underscores", () => {
      // Regression lock: if someone relaxes the id regex in schema.ts/id.ts
      // but forgets to propagate here, `grep -o` silently truncates legacy
      // `traj_<timestamp>_<hex>` ids at the first internal underscore. This
      // keeps the hook script's character class aligned with the schema.
      const script = generateHookScript();
      expect(script).toContain("traj_[a-z0-9_]*");
      expect(script).not.toMatch(/traj_\[a-z0-9\]\*/);
    });

    it("should extract the full legacy id from a trajectory file via real grep", async () => {
      // Behavioral regression test: runs the exact extraction command from
      // the hook script against a fixture file and asserts it returns the
      // full legacy id, not a truncated prefix.
      const { spawnSync } =
        await vi.importActual<typeof import("node:child_process")>(
          "node:child_process",
        );
      const { mkdtempSync, writeFileSync, rmSync } =
        await vi.importActual<typeof import("node:fs")>("node:fs");
      const { join } =
        await vi.importActual<typeof import("node:path")>("node:path");
      const { tmpdir } =
        await vi.importActual<typeof import("node:os")>("node:os");

      const dir = mkdtempSync(join(tmpdir(), "trail-hook-legacy-"));
      const fixtureFile = join(dir, "traj_1775734701264_ba65c69b.json");
      writeFileSync(
        fixtureFile,
        '{\n  "id": "traj_1775734701264_ba65c69b",\n  "version": 1\n}\n',
        "utf-8",
      );

      try {
        // Mirrors the hook's extraction pipeline exactly.
        const cmd = `grep -o '"id"[[:space:]]*:[[:space:]]*"traj_[a-z0-9_]*"' "${fixtureFile}" | head -1 | grep -o 'traj_[a-z0-9_]*'`;
        const result = spawnSync("sh", ["-c", cmd], { encoding: "utf-8" });
        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe("traj_1775734701264_ba65c69b");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
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
        return "";
      });
      mockReadFileSync.mockReturnValue(
        "#!/bin/sh\n# Added by agent-trajectories\n",
      );

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
        return "";
      });
      mockReadFileSync.mockReturnValue("#!/bin/sh\n# Some other hook\n");

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
        return "";
      });
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      expect(detectExistingHook()).toBe("none");
    });
  });
});
