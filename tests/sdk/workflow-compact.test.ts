import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolvePath(__dirname, "../..");
const cliSourceEntry = join(repoRoot, "src/cli/index.ts");
const cliDistEntry = join(repoRoot, "dist/cli/index.js");

interface EnvSnapshot {
  TRAJECTORIES_WORKFLOW_ID?: string;
  TRAJECTORIES_DATA_DIR?: string;
  TRAJECTORIES_SEARCH_PATHS?: string;
  TRAJECTORIES_CLI?: string;
  TRAJECTORIES_PROJECT?: string;
}

function snapshotEnv(): EnvSnapshot {
  return {
    TRAJECTORIES_WORKFLOW_ID: process.env.TRAJECTORIES_WORKFLOW_ID,
    TRAJECTORIES_DATA_DIR: process.env.TRAJECTORIES_DATA_DIR,
    TRAJECTORIES_SEARCH_PATHS: process.env.TRAJECTORIES_SEARCH_PATHS,
    TRAJECTORIES_CLI: process.env.TRAJECTORIES_CLI,
    TRAJECTORIES_PROJECT: process.env.TRAJECTORIES_PROJECT,
  };
}

function clearEnv(key: string): void {
  Reflect.deleteProperty(process.env, key);
}

function restoreEnv(snapshot: EnvSnapshot): void {
  for (const key of Object.keys(snapshot) as (keyof EnvSnapshot)[]) {
    const value = snapshot[key];
    if (value === undefined) {
      clearEnv(key);
    } else {
      process.env[key] = value;
    }
  }
}

interface CompactCliInvocationRecord {
  argv: string[];
  cwd: string;
}

function writeRecordingCompactCli(
  wrapperPath: string,
  realCliPath: string,
  recordPath: string,
): void {
  writeFileSync(
    wrapperPath,
    `import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const recordPath = ${JSON.stringify(recordPath)};
const realCliPath = ${JSON.stringify(realCliPath)};

mkdirSync(dirname(recordPath), { recursive: true });
writeFileSync(
  recordPath,
  JSON.stringify(
    {
      argv: process.argv.slice(2),
      cwd: process.cwd(),
    },
    null,
    2,
  ),
  "utf-8",
);

const result = spawnSync(process.execPath, [realCliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
`,
    "utf-8",
  );
}

describe("workflow compaction", () => {
  let tempDir: string;
  let originalCwd: string;
  let envSnapshot: EnvSnapshot;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trail-wf-compact-"));
    originalCwd = process.cwd();
    envSnapshot = snapshotEnv();
    // Ensure tests start with a clean trajectory env so storage paths
    // resolve relative to the tmp cwd.
    clearEnv("TRAJECTORIES_WORKFLOW_ID");
    clearEnv("TRAJECTORIES_DATA_DIR");
    clearEnv("TRAJECTORIES_SEARCH_PATHS");
    clearEnv("TRAJECTORIES_CLI");
    clearEnv("TRAJECTORIES_PROJECT");
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    restoreEnv(envSnapshot);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("stamps workflowId from TRAJECTORIES_WORKFLOW_ID onto new trajectories", async () => {
    const { TrajectoryClient } = await import("../../src/sdk/client.js");
    process.env.TRAJECTORIES_WORKFLOW_ID = "wf-env-stamp";

    const client = new TrajectoryClient();
    await client.init();
    const session = await client.start("Env stamped task");

    expect(session.data.workflowId).toBe("wf-env-stamp");

    await client.close();
  });

  it("trail start CLI stamps workflowId from TRAJECTORIES_WORKFLOW_ID env var", async () => {
    const envForCli = {
      ...process.env,
      TRAJECTORIES_WORKFLOW_ID: "wf-cli-env",
    };
    const startResult = spawnSync(
      "npx",
      ["tsx", cliSourceEntry, "start", "CLI env stamped task", "--quiet"],
      { cwd: tempDir, encoding: "utf-8", env: envForCli },
    );
    expect(startResult.status).toBe(0);
    const trajectoryId = startResult.stdout.trim();
    expect(trajectoryId).toMatch(/^traj_/);

    const activePath = join(
      tempDir,
      ".trajectories",
      "active",
      `${trajectoryId}.json`,
    );
    expect(existsSync(activePath)).toBe(true);
    const raw = JSON.parse(await readFile(activePath, "utf-8")) as {
      workflowId?: string;
    };
    expect(raw.workflowId).toBe("wf-cli-env");
  });

  it("trail start CLI honors --workflow flag even when env var is unset", async () => {
    const startResult = spawnSync(
      "npx",
      [
        "tsx",
        cliSourceEntry,
        "start",
        "CLI flag stamped task",
        "--workflow",
        "wf-cli-flag",
        "--quiet",
      ],
      { cwd: tempDir, encoding: "utf-8", env: process.env },
    );
    expect(startResult.status).toBe(0);
    const trajectoryId = startResult.stdout.trim();
    const activePath = join(
      tempDir,
      ".trajectories",
      "active",
      `${trajectoryId}.json`,
    );
    const raw = JSON.parse(await readFile(activePath, "utf-8")) as {
      workflowId?: string;
    };
    expect(raw.workflowId).toBe("wf-cli-flag");
  });

  it("leaves workflowId undefined when TRAJECTORIES_WORKFLOW_ID is unset", async () => {
    const { TrajectoryClient } = await import("../../src/sdk/client.js");
    expect(process.env.TRAJECTORIES_WORKFLOW_ID).toBeUndefined();

    const client = new TrajectoryClient();
    await client.init();
    const session = await client.start("Unstamped task");

    expect(session.data.workflowId).toBeUndefined();

    await client.close();
  });

  it("compacts only trajectories matching --workflow via the CLI", async () => {
    const { TrajectoryClient } = await import("../../src/sdk/client.js");
    const client = new TrajectoryClient();
    await client.init();

    process.env.TRAJECTORIES_WORKFLOW_ID = "wf-a";
    const taggedSession = await client.start("Tagged work");
    const taggedId = taggedSession.id;
    await taggedSession.done("tagged done", 0.9);

    clearEnv("TRAJECTORIES_WORKFLOW_ID");
    const untaggedSession = await client.start("Untagged work");
    await untaggedSession.done("untagged done", 0.9);

    await client.close();

    const spawnResult = spawnSync(
      "npx",
      [
        "tsx",
        cliSourceEntry,
        "compact",
        "--workflow",
        "wf-a",
        "--mechanical",
        "--all",
      ],
      {
        cwd: tempDir,
        encoding: "utf-8",
        env: process.env,
      },
    );

    expect(spawnResult.status).toBe(0);

    const compactedPath = join(
      tempDir,
      ".trajectories/compacted/workflow-wf-a.json",
    );
    expect(existsSync(compactedPath)).toBe(true);

    const compacted = JSON.parse(await readFile(compactedPath, "utf-8")) as {
      sourceTrajectories: string[];
      workflowId?: string;
    };

    expect(compacted.sourceTrajectories).toEqual([taggedId]);
    expect(compacted.workflowId).toBe("wf-a");
  }, 60_000);

  it("compactWorkflow SDK helper runs the CLI and returns the output paths", async () => {
    // The SDK helper spawns the CLI via resolveTrajectoryCliInvocation(),
    // which looks up `agent-trajectories/package.json`. That lookup is not
    // guaranteed to succeed inside the repo under test, so point the helper
    // at the built CLI explicitly.
    if (!existsSync(cliDistEntry)) {
      throw new Error(
        `dist CLI missing at ${cliDistEntry}. Run \`npm run build\` before executing this test.`,
      );
    }
    process.env.TRAJECTORIES_CLI = cliDistEntry;

    const { TrajectoryClient, compactWorkflow } = await import(
      "../../src/sdk/client.js"
    );

    const client = new TrajectoryClient();
    await client.init();

    process.env.TRAJECTORIES_WORKFLOW_ID = "wf-a";
    const session = await client.start("SDK helper task");
    await session.decide("Which approach?", "Option A", "Cleaner abstraction");
    await session.done("sdk helper done", 0.85);
    clearEnv("TRAJECTORIES_WORKFLOW_ID");

    await client.close();

    const result = await compactWorkflow("wf-a", {
      mechanical: true,
      markdown: true,
      cwd: tempDir,
    });

    expect(result.compactedPath).toBeTruthy();
    expect(existsSync(result.compactedPath)).toBe(true);

    if (result.markdownPath) {
      expect(existsSync(result.markdownPath)).toBe(true);
    }

    const compacted = JSON.parse(
      await readFile(result.compactedPath, "utf-8"),
    ) as { workflowId?: string; sourceTrajectories: string[] };
    expect(compacted.workflowId).toBe("wf-a");
    expect(compacted.sourceTrajectories).toHaveLength(1);
  }, 60_000);

  it("does not drop trajectories that contain unknown event types", async () => {
    // Write a raw trajectory JSON with an event whose `type` is not one of
    // the canonical TrajectoryEventType values. The schema must be lenient
    // enough to still load the file so `trail compact` emits a compacted
    // summary that includes it.
    const dataDir = join(tempDir, ".trajectories");
    const monthDir = join(dataDir, "completed", "2026-04");
    mkdirSync(monthDir, { recursive: true });

    const trajId = "traj_schemalenient01";
    const timestamp = "2026-04-12T10:00:00.000Z";
    const rawTrajectory = {
      id: trajId,
      version: 1,
      task: { title: "Schema leniency" },
      status: "completed",
      startedAt: timestamp,
      completedAt: timestamp,
      agents: [
        {
          name: "tester",
          role: "lead",
          joinedAt: timestamp,
        },
      ],
      workflowId: "wf-lenient",
      chapters: [
        {
          id: "ch_lenient_1",
          title: "Work",
          agentName: "tester",
          startedAt: timestamp,
          events: [
            {
              ts: Date.parse(timestamp),
              type: "decision",
              content: "Chose Option A",
              raw: {
                question: "Which option?",
                chosen: "Option A",
                alternatives: [],
                reasoning: "Simpler",
              },
            },
            {
              ts: Date.parse(timestamp) + 1,
              type: "completion-evidence",
              content: "Evidence collected from external tool",
            },
          ],
        },
      ],
      retrospective: {
        summary: "All done",
        approach: "Just did the thing",
        confidence: 0.9,
      },
      commits: [],
      filesChanged: [],
      projectId: tempDir,
      tags: [],
    };

    const trajFilePath = join(monthDir, `${trajId}.json`);
    writeFileSync(trajFilePath, JSON.stringify(rawTrajectory, null, 2));

    // Index entry is how FileStorage.list() finds completed trajectories.
    const indexPath = join(dataDir, "index.json");
    const index = {
      version: 1,
      lastUpdated: timestamp,
      trajectories: {
        [trajId]: {
          title: "Schema leniency",
          status: "completed",
          startedAt: timestamp,
          completedAt: timestamp,
          path: trajFilePath,
        },
      },
    };
    writeFileSync(indexPath, JSON.stringify(index, null, 2));

    const spawnResult = spawnSync(
      "npx",
      [
        "tsx",
        cliSourceEntry,
        "compact",
        "--workflow",
        "wf-lenient",
        "--mechanical",
        "--all",
      ],
      {
        cwd: tempDir,
        encoding: "utf-8",
        env: process.env,
      },
    );

    expect(spawnResult.status).toBe(0);

    const compactedPath = join(
      tempDir,
      ".trajectories/compacted/workflow-wf-lenient.json",
    );
    expect(existsSync(compactedPath)).toBe(true);

    const compacted = JSON.parse(await readFile(compactedPath, "utf-8")) as {
      sourceTrajectories: string[];
    };

    // The presence of the unknown event type must NOT cause the trajectory
    // to be silently dropped at load time.
    expect(compacted.sourceTrajectories).toContain(trajId);
  }, 60_000);

  describe("autoCompact option", () => {
    it("autoCompact: true + workflowId set => complete() compacts from the configured dataDir with the expected CLI flags", async () => {
      if (!existsSync(cliDistEntry)) {
        throw new Error(
          `dist CLI missing at ${cliDistEntry}. Run \`npm run build\` before executing this test.`,
        );
      }
      const workspaceDir = join(tempDir, "sdk-workspace");
      const recordingCliPath = join(tempDir, "recording-compact-cli.mjs");
      const recordPath = join(tempDir, "recorded-compact-invocation.json");
      writeRecordingCompactCli(recordingCliPath, cliDistEntry, recordPath);

      process.env.TRAJECTORIES_CLI = recordingCliPath;
      process.env.TRAJECTORIES_WORKFLOW_ID = "wf-auto-on";

      const { TrajectoryClient } = await import("../../src/sdk/client.js");
      const client = new TrajectoryClient({
        dataDir: workspaceDir,
        autoCompact: { mechanical: true, markdown: true },
      });
      await client.init();

      const session = await client.start("Auto-compact task");
      const sessionId = session.id;
      const result = await session.complete({
        summary: "auto-compact done",
        approach: "Exercise complete() directly",
        confidence: 0.9,
      });

      await client.close();

      expect(result.status).toBe("completed");
      expect(result.id).toBe(sessionId);

      const recordedInvocation = JSON.parse(
        await readFile(recordPath, "utf-8"),
      ) as CompactCliInvocationRecord;
      expect(await realpath(recordedInvocation.cwd)).toBe(
        await realpath(workspaceDir),
      );
      expect(recordedInvocation.argv).toEqual([
        "compact",
        "--workflow",
        "wf-auto-on",
        "--all",
        "--markdown",
        "--mechanical",
      ]);

      const compactedPath = join(
        workspaceDir,
        ".trajectories/compacted/workflow-wf-auto-on.json",
      );
      expect(existsSync(compactedPath)).toBe(true);

      const compacted = JSON.parse(await readFile(compactedPath, "utf-8")) as {
        sourceTrajectories: string[];
        workflowId?: string;
      };
      expect(compacted.sourceTrajectories).toContain(sessionId);
      expect(compacted.workflowId).toBe("wf-auto-on");
    }, 60_000);

    it("autoCompact: true + no workflowId => complete() succeeds without compacting", async () => {
      expect(process.env.TRAJECTORIES_WORKFLOW_ID).toBeUndefined();

      const { TrajectoryClient } = await import("../../src/sdk/client.js");
      const client = new TrajectoryClient({
        autoCompact: { mechanical: true },
      });
      await client.init();

      const session = await client.start("No-workflow auto-compact task");
      const result = await session.done("completed without workflow", 0.85);

      await client.close();

      expect(result.status).toBe("completed");

      const compactedDir = join(tempDir, ".trajectories", "compacted");
      if (existsSync(compactedDir)) {
        const files = readdirSync(compactedDir);
        const workflowFiles = files.filter((f) => f.startsWith("workflow-"));
        expect(workflowFiles).toHaveLength(0);
      }
    }, 60_000);

    it("autoCompact: false (default) + workflowId set => complete() does NOT compact", async () => {
      process.env.TRAJECTORIES_WORKFLOW_ID = "wf-default-off";

      const { TrajectoryClient } = await import("../../src/sdk/client.js");
      const client = new TrajectoryClient();
      await client.init();

      const session = await client.start("Default no-compact task");
      await session.done("done without compaction", 0.9);

      await client.close();

      const compactedPath = join(
        tempDir,
        ".trajectories/compacted/workflow-wf-default-off.json",
      );
      expect(existsSync(compactedPath)).toBe(false);
    }, 60_000);

    it("autoCompact degrades gracefully if compaction fails", async () => {
      process.env.TRAJECTORIES_CLI = "/nonexistent/trail";
      process.env.TRAJECTORIES_WORKFLOW_ID = "wf-fail";

      const { TrajectoryClient } = await import("../../src/sdk/client.js");
      const client = new TrajectoryClient({
        autoCompact: { mechanical: true },
      });
      await client.init();

      const session = await client.start("Graceful degradation task");
      const sessionId = session.id;
      const result = await session.done("should still complete", 0.8);

      await client.close();

      expect(result.status).toBe("completed");
      expect(result.id).toBe(sessionId);

      const completedDir = join(tempDir, ".trajectories", "completed");
      expect(existsSync(completedDir)).toBe(true);
      const monthDirs = readdirSync(completedDir);
      expect(monthDirs.length).toBeGreaterThan(0);

      let found = false;
      for (const monthDir of monthDirs) {
        const files = readdirSync(join(completedDir, monthDir));
        if (files.some((f) => f.includes(sessionId))) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    }, 60_000);
  });
});
