/**
 * compact-on-workflow-run.ts
 *
 * Template workflow that demonstrates the auto-compaction pattern:
 *
 *   1. Assign one TRAJECTORIES_WORKFLOW_ID at the top of the workflow file,
 *      before `.run()` is called. Every child process (agents + deterministic
 *      steps) inherits it through process.env, so any `trail start` call or
 *      SDK `TrajectoryClient.start(...)` during the run gets tagged with this
 *      workflow id automatically.
 *
 *   2. Agents do their real work. Anywhere they record a trajectory — via the
 *      `trail` CLI or the SDK — the trajectory is stamped. No explicit ID
 *      plumbing per step.
 *
 *   3. A deterministic step at the very end runs
 *      `trail compact --workflow <id> --markdown`. That filters to just this
 *      run's trajectories (via the `workflowId` field) and produces one tight
 *      .json + .md in `.agentworkforce/trajectories/compacted/workflow-<id>.{json,md}`.
 *
 *   4. No API key is ever required — compaction auto-selects a local CLI
 *      provider (claude, codex, gemini, or opencode) in auto mode. If no LLM
 *      provider is available, add `--mechanical` to the compact command to
 *      fall back to keyword-based compaction.
 *
 * To use this pattern in your own workflow: copy the top-level `WORKFLOW_ID`
 * assignment and the `verify-trajectory` + `compact` + `print-artifact` steps.
 * Swap the `summarize` agent step for whatever your workflow actually does.
 *
 * Run: agent-relay run workflows/compact-on-workflow-run.ts
 */

import { randomUUID } from "node:crypto";
import { workflow } from "@agent-relay/sdk/workflows";

// Assigned once, at module load time. This runs before any steps execute,
// so subsequent agent + deterministic processes inherit the env var.
const WORKFLOW_ID = `compact-demo-${randomUUID().slice(0, 8)}`;
process.env.TRAJECTORIES_WORKFLOW_ID = WORKFLOW_ID;

const TRAJ_ROOT = process.cwd();

async function runWorkflow() {
  const result = await workflow("compact-on-workflow-run")
    .description(
      `Template: agents record trajectories tagged with workflow id ${WORKFLOW_ID}; the final step compacts them via trail compact --workflow.`,
    )
    .pattern("dag")
    .channel("wf-compact-demo")
    .maxConcurrency(4)
    .timeout(1_200_000)

    .agent("summarizer", {
      cli: "codex",
      preset: "worker",
      role: "Records a trajectory summarizing a small piece of the project",
      retries: 1,
    })

    // ── Phase 1: Surface a tiny piece of real project context ────────
    .step("read-readme", {
      type: "deterministic",
      command: `sed -n '1,60p' ${TRAJ_ROOT}/README.md 2>/dev/null || echo "(no README)"`,
      captureOutput: true,
      failOnError: false,
    })

    // ── Phase 2: Agent does work, recording a trajectory via trail CLI
    // The agent inherits TRAJECTORIES_WORKFLOW_ID=${WORKFLOW_ID} from env,
    // so `trail start` tags the new trajectory automatically.
    .step("summarize", {
      agent: "summarizer",
      dependsOn: ["read-readme"],
      task: `Summarize the README excerpt below by recording a small trajectory with the \`trail\` CLI. Do NOT use any other tools — only the five trail commands listed.

README excerpt:
{{steps.read-readme.output}}

Exact sequence:

1. Abandon any leftover active trajectory from a previous run (safe no-op if none):
     trail abandon 2>/dev/null || true

2. Start the new trajectory. Run exactly:
     trail start "Summarize README" --quiet
   This prints the new trajectory id on stdout. The trajectory is auto-tagged
   with TRAJECTORIES_WORKFLOW_ID (inherited from this workflow's env). You do
   not need to pass --workflow — the env var handles it.

3. Record two decisions about the README. Run exactly twice:
     trail decision "<your 1-line summary of the project's main purpose>" --reasoning "<why you think so>"
     trail decision "<your 1-line summary of who the primary user is>" --reasoning "<why you think so>"

4. Record a 3-5 sentence synthesis:
     trail reflect "<3-5 sentences summarizing the README — purpose, audience, key capabilities>"

5. Complete the trajectory:
     trail complete --summary "Summarized README from workflow run ${WORKFLOW_ID}" --confidence 0.9

Exit cleanly once step 5 returns successfully. Do not run any other commands.`,
      verification: { type: "exit_code", value: "0" },
    })

    // ── Phase 3: Verify the trajectory was tagged with our workflow id
    .step("verify-trajectory", {
      type: "deterministic",
      dependsOn: ["summarize"],
      command: `cd ${TRAJ_ROOT} && node -e '
const { readdirSync, readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const completed = ".agentworkforce/trajectories/completed";
if (!existsSync(completed)) {
  console.error("NO_COMPLETED_DIR");
  process.exit(1);
}
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
};
const tagged = walk(completed).filter((f) => {
  try {
    const t = JSON.parse(readFileSync(f, "utf-8"));
    return t.workflowId === "${WORKFLOW_ID}";
  } catch {
    return false;
  }
});
if (tagged.length === 0) {
  console.error("NO_TRAJECTORY_TAGGED_WITH_${WORKFLOW_ID}");
  console.error("The summarizer agent did not create a workflow-tagged trajectory.");
  process.exit(1);
}
console.log("tagged=" + tagged.length);
for (const f of tagged) console.log("  " + f);
'`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 4: Compact this workflow's trajectories into one artifact
    // Default provider resolution selects the local CLI automatically — no
    // API key, no flags. Add --mechanical at the end if you want to skip
    // the LLM entirely.
    .step("compact", {
      type: "deterministic",
      dependsOn: ["verify-trajectory"],
      command: `cd ${TRAJ_ROOT} && npx tsx src/cli/index.ts compact --workflow ${WORKFLOW_ID} --markdown --all 2>&1 | tail -40`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 5: Print the compacted artifact path + a few sanity checks
    .step("print-artifact", {
      type: "deterministic",
      dependsOn: ["compact"],
      command: `cd ${TRAJ_ROOT} && node -e '
const { readdirSync, readFileSync, statSync, existsSync } = require("node:fs");
const path = require("node:path");
const dir = ".agentworkforce/trajectories/compacted";
if (!existsSync(dir)) { console.error("NO_COMPACTED_DIR"); process.exit(1); }
const files = readdirSync(dir).filter((f) => f.startsWith("workflow-${WORKFLOW_ID}"));
if (files.length === 0) { console.error("NO_COMPACTED_ARTIFACT"); process.exit(1); }
for (const f of files) {
  const p = path.join(dir, f);
  const size = statSync(p).size;
  console.log(p + " (" + size + " bytes)");
}
const jsonFile = files.find((f) => f.endsWith(".json"));
if (jsonFile) {
  const data = JSON.parse(readFileSync(path.join(dir, jsonFile), "utf-8"));
  console.log("narrative length: " + (data.narrative?.length ?? 0));
  console.log("decisions: " + (Array.isArray(data.decisions) ? data.decisions.length : "n/a"));
  console.log("sourceTrajectories: " + JSON.stringify(data.sourceTrajectories ?? []));
}
'`,
      captureOutput: true,
      failOnError: false,
    })

    .onError("fail-fast")
    .run({ cwd: process.cwd() });

  console.log("Workflow status:", result.status);
  console.log("Workflow id:", WORKFLOW_ID);
  console.log(
    `Compacted artifact: .agentworkforce/trajectories/compacted/workflow-${WORKFLOW_ID}.{json,md}`,
  );
}

runWorkflow().catch((error) => {
  console.error(error);
  process.exit(1);
});
