/**
 * sdk-workflow-autocompact.ts
 *
 * Adds workflow-aware auto-compaction to the trajectories SDK + trail CLI.
 *
 * Feature:
 *   - Trajectory type gains an optional workflowId field
 *   - TrajectoryClient reads TRAJECTORIES_WORKFLOW_ID from env and stamps
 *     every trajectory it creates with that id
 *   - New SDK helper: compactWorkflow(workflowId) — spawns the local `trail`
 *     CLI so compaction logic stays in one place (the local CLI)
 *   - `trail compact --workflow <id>` filter selects all trajectories for a
 *     given workflow run and produces a single compacted JSON + markdown
 *
 * Validation strategy (80 → 100):
 *   1. BEFORE: run a reproducible benchmark script with the current SDK and
 *      capture raw size / event counts. The new workflowId field is absent.
 *   2. Implement the feature (codex).
 *   3. Tests (claude) — unit tests for env-var tagging + real CLI invocation
 *      through compactWorkflow().
 *   4. AFTER: run the same benchmark with TRAJECTORIES_WORKFLOW_ID set, then
 *      invoke `trail compact --workflow <id> --markdown`. Compaction uses the
 *      locally-installed claude or codex CLI — no API key ever required.
 *   5. Hard gate: compacted bytes meaningfully smaller than raw, markdown
 *      present, narrative + decisions fields populated.
 *
 * LLM provider strategy (user never sets an API key):
 *   - Default provider order is reordered so "auto" tries the CLI provider
 *     FIRST. Supported CLIs: claude, codex, gemini, opencode (declaration
 *     order = preference). All reuse existing CLI auth — no keys needed.
 *   - TRAJECTORIES_LLM_CLI=claude|codex|gemini|opencode pins the CLI when
 *     multiple are installed.
 *   - OpenAI / Anthropic API providers remain available but only kick in if
 *     explicitly selected via TRAJECTORIES_LLM_PROVIDER=openai|anthropic.
 *   - Unit tests use --mechanical for determinism, speed, no LLM subprocess.
 *   - The supported-CLI list is kept inline (not imported from agent-relay)
 *     because that dep was removed in 7e9783c. See provider.ts JSDoc.
 *   6. Self-review (codex) + peer review (claude) with diff as input.
 *   7. Address review feedback; re-run tests + regression; commit.
 *   8. Push to origin (updates the open PR on this branch) and comment the
 *      before/after stats on the PR via `gh pr comment`.
 *
 * Team split (per relay-80-100 skill):
 *   - Codex implements SDK + CLI edits (impl)
 *   - Claude writes tests and runs before/after comparison (tester)
 *   - Claude peer-reviews the diff (reviewer)
 *   - Codex self-reviews its own diff (self-reviewer)
 *
 * Run: agent-relay run workflows/sdk-workflow-autocompact.ts
 */

import { workflow } from "@agent-relay/sdk/workflows";

const TRAJ_ROOT = process.cwd();

async function runWorkflow() {
  const result = await workflow("sdk-workflow-autocompact")
    .description(
      "Add workflow-aware auto-compaction to the trajectories SDK and trail CLI, with end-to-end before/after validation",
    )
    .pattern("dag")
    .channel("wf-autocompact")
    .maxConcurrency(6)
    .timeout(3_600_000)

    .agent("impl", {
      cli: "codex",
      preset: "worker",
      role: "Implements SDK + CLI edits one file at a time",
      retries: 2,
    })
    .agent("tester", {
      cli: "claude",
      preset: "worker",
      role: "Writes tests and runs the before/after E2E comparison",
      retries: 2,
    })
    .agent("reviewer", {
      cli: "claude",
      preset: "worker",
      role: "Peer-reviews the implementation diff",
      retries: 1,
    })
    .agent("self-reviewer", {
      cli: "codex",
      preset: "worker",
      role: "Self-reviews the implementation it wrote",
      retries: 1,
    })

    // ── Phase 0: Clean workspace ─────────────────────────────────────
    .step("clean-workspace", {
      type: "deterministic",
      command: `rm -rf ${TRAJ_ROOT}/.trajectories-test && mkdir -p ${TRAJ_ROOT}/.trajectories-test/before ${TRAJ_ROOT}/.trajectories-test/after && echo OK`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 1: Read context for downstream edits ───────────────────
    .step("read-types", {
      type: "deterministic",
      dependsOn: ["clean-workspace"],
      command: `cat ${TRAJ_ROOT}/src/core/types.ts`,
      captureOutput: true,
    })
    .step("read-client", {
      type: "deterministic",
      dependsOn: ["clean-workspace"],
      command: `cat ${TRAJ_ROOT}/src/sdk/client.ts`,
      captureOutput: true,
    })
    .step("read-compact-cmd", {
      type: "deterministic",
      dependsOn: ["clean-workspace"],
      command: `sed -n '1,400p' ${TRAJ_ROOT}/src/cli/commands/compact.ts`,
      captureOutput: true,
    })
    .step("read-sdk-index", {
      type: "deterministic",
      dependsOn: ["clean-workspace"],
      command: `cat ${TRAJ_ROOT}/src/sdk/index.ts 2>/dev/null || echo "(no sdk/index.ts)"`,
      captureOutput: true,
    })
    .step("read-provider", {
      type: "deterministic",
      dependsOn: ["clean-workspace"],
      command: `sed -n '1,500p' ${TRAJ_ROOT}/src/compact/provider.ts`,
      captureOutput: true,
    })
    .step("read-schema", {
      type: "deterministic",
      dependsOn: ["clean-workspace"],
      command: `sed -n '1,120p' ${TRAJ_ROOT}/src/core/schema.ts`,
      captureOutput: true,
    })

    // ── Phase 2: Create the reusable benchmark sample script ─────────
    .step("create-benchmark-script", {
      agent: "tester",
      dependsOn: ["read-client", "read-sdk-index"],
      task: `Create ${TRAJ_ROOT}/scripts/benchmark-compaction.ts — a reproducible benchmark that uses the CURRENT trajectories SDK to record a deliberately noisy sample trajectory.

Storage convention — IMPORTANT:
- The script must use the default TrajectoryClient storage: it always writes into \`<cwd>/.agentworkforce/trajectories/\`. Do NOT read TRAJECTORIES_DIR or any custom env var for the base directory. The CALLER cd's into the right directory before invoking this script; that is how isolation works.
- The script MUST read TRAJECTORIES_WORKFLOW_ID from process.env and pass it through to the trajectory (via whatever option TrajectoryClient.start accepts, or the env var will naturally be picked up by the SDK once the feature is implemented — on the BEFORE run this is a no-op and that is expected).

Content (deliberately noisy so the compaction ratio is meaningful):
- One session with 5 chapters, at least 8 decisions, 15 findings, and 45+ low-significance tool_call / tool_result / thinking events (this is the noise the compactor strips — small fixtures produce weak ratios, so keep the noise volume high)
- Call session.complete(...) with a full retrospective
- Print to stdout exactly once: \`TRAJECTORY_ID=<id>\`

Use only APIs that already exist in src/sdk/client.ts today:
{{steps.read-client.output}}

And the current sdk/index exports:
{{steps.read-sdk-index.output}}

Write the file to disk. Do NOT log to stdout instead of writing. Keep under 120 lines.`,
      verification: {
        type: "file_exists",
        value: "scripts/benchmark-compaction.ts",
      },
    })
    .step("verify-benchmark-script", {
      type: "deterministic",
      dependsOn: ["create-benchmark-script"],
      command: `test -f ${TRAJ_ROOT}/scripts/benchmark-compaction.ts && wc -l ${TRAJ_ROOT}/scripts/benchmark-compaction.ts | awk '{ if ($1 < 20) { print "TOO_SHORT"; exit 1 } else { print "OK " $1 " lines" } }'`,
      failOnError: true,
      captureOutput: true,
    })

    // ── Phase 3: BEFORE capture ─────────────────────────────────────
    .step("before-run", {
      type: "deterministic",
      dependsOn: ["verify-benchmark-script"],
      command: `cd ${TRAJ_ROOT}/.trajectories-test/before && npx tsx ${TRAJ_ROOT}/scripts/benchmark-compaction.ts 2>&1 | tee run.log`,
      captureOutput: true,
      failOnError: true,
    })
    .step("before-stats", {
      type: "deterministic",
      dependsOn: ["before-run"],
      command: `cd ${TRAJ_ROOT} && node -e '
const fs = require("fs");
const path = require("path");
const root = ".trajectories-test/before";
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".json") && !p.includes("/compacted/")) out.push(p);
  }
  return out;
}
const files = walk(root);
if (files.length === 0) { console.error("NO_RAW_TRAJECTORY"); process.exit(1); }
const raw = files[0];
const bytes = fs.statSync(raw).size;
const data = JSON.parse(fs.readFileSync(raw, "utf8"));
let events = 0;
for (const c of data.chapters || []) events += (c.events || []).length;
const stats = {
  raw_file: raw,
  raw_bytes: bytes,
  event_count: events,
  has_workflow_id: Object.prototype.hasOwnProperty.call(data, "workflowId") ? 1 : 0,
};
fs.writeFileSync(".trajectories-test/before/stats.json", JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats));
'`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 4: Implementation — one file per step ─────────────────
    .step("edit-types", {
      agent: "impl",
      dependsOn: ["before-stats", "read-types"],
      task: `Edit ${TRAJ_ROOT}/src/core/types.ts.

Current contents:
{{steps.read-types.output}}

Add an OPTIONAL field \`workflowId?: string\` to the Trajectory interface with a one-line JSDoc: "Opaque id set by the workflow runner via TRAJECTORIES_WORKFLOW_ID env var. Lets trail compact --workflow <id> collate all trajectories from a single workflow run." If CreateTrajectoryInput (or the equivalent constructor input type) exists in this file, add workflowId there too.

Only edit this one file.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-edit-types", {
      type: "deterministic",
      dependsOn: ["edit-types"],
      command: `cd ${TRAJ_ROOT} && if git diff --quiet src/core/types.ts; then echo NOT_MODIFIED; exit 1; fi && grep -q "workflowId" src/core/types.ts && echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    .step("edit-client", {
      agent: "impl",
      dependsOn: ["verify-edit-types", "read-client"],
      task: `Edit ${TRAJ_ROOT}/src/sdk/client.ts.

Current contents:
{{steps.read-client.output}}

Two changes:

1. In TrajectoryClient.start() (or wherever a new Trajectory is minted), read process.env.TRAJECTORIES_WORKFLOW_ID. If non-empty, stamp the trajectory's workflowId field. If unset/empty, leave workflowId undefined. Also accept an explicit workflowId option on start() that takes precedence over the env var.

2. Export a new top-level helper from this file:
   export async function compactWorkflow(
     workflowId: string,
     options?: { markdown?: boolean; mechanical?: boolean; cwd?: string }
   ): Promise<{ compactedPath: string; markdownPath?: string }>

   Behavior:
   - Spawn the trail CLI via child_process.spawn. Resolve the binary by:
     a. process.env.TRAJECTORIES_CLI if set
     b. otherwise require.resolve("agent-trajectories/package.json") + bin lookup → dist/cli/index.js invoked with process.execPath
     c. fallback: "trail" on PATH
   - Args: ["compact", "--workflow", workflowId, "--all"] plus "--markdown" and/or "--mechanical" when options set
   - Pipe stderr through to the caller's stderr
   - On non-zero exit: throw Error("compactWorkflow failed: " + stderr)
   - Parse stdout for the compacted file paths (the CLI already logs them)
   - DO NOT re-implement compaction logic in the SDK. Shelling out is the entire point.

Only edit src/sdk/client.ts. If sdk/index.ts needs re-exporting compactWorkflow, that will be a separate step.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-edit-client", {
      type: "deterministic",
      dependsOn: ["edit-client"],
      command: `cd ${TRAJ_ROOT} && if git diff --quiet src/sdk/client.ts; then echo NOT_MODIFIED; exit 1; fi && grep -Eq "TRAJECTORIES_WORKFLOW_ID" src/sdk/client.ts && grep -q "compactWorkflow" src/sdk/client.ts && echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    .step("edit-sdk-index", {
      agent: "impl",
      dependsOn: ["verify-edit-client", "read-sdk-index"],
      task: `Edit ${TRAJ_ROOT}/src/sdk/index.ts.

Current contents:
{{steps.read-sdk-index.output}}

Add a re-export for compactWorkflow so users can \`import { compactWorkflow } from "agent-trajectories/sdk"\`. If src/sdk/index.ts does not exist, create it and re-export the same symbols the existing entrypoint exports plus compactWorkflow.

Only edit this one file.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-edit-sdk-index", {
      type: "deterministic",
      dependsOn: ["edit-sdk-index"],
      command: `cd ${TRAJ_ROOT} && test -f src/sdk/index.ts && grep -q "compactWorkflow" src/sdk/index.ts && echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    .step("edit-provider", {
      agent: "impl",
      dependsOn: ["verify-edit-sdk-index", "read-provider"],
      task: `Edit ${TRAJ_ROOT}/src/compact/provider.ts. Two coupled changes — make the CLI provider the preferred default AND expand the set of supported CLIs so users with gemini or opencode (not just claude/codex) also get zero-config compaction.

Current contents:
{{steps.read-provider.output}}

Change 1 — provider resolution order (no API key required):
- In resolveProvider() (the entry point that reads TRAJECTORIES_LLM_PROVIDER and handles the "auto" default):
  * When the effective provider is "auto" (unset or explicitly "auto"), TRY resolveCLIProvider() FIRST.
  * If a CLI is found, return it immediately — do NOT check OPENAI_API_KEY / ANTHROPIC_API_KEY.
  * Only fall back to API-key providers (OpenAI / Anthropic) when no supported CLI is installed.
  * Keep explicit "openai" / "anthropic" / "cli" selections working unchanged.

Change 2 — expand SUPPORTED_CLIS and honor TRAJECTORIES_LLM_CLI:
- Update the SUPPORTED_CLIS constant from ["claude", "codex"] to ["claude", "codex", "gemini", "opencode"]. Preference order = array order. Update the SupportedCli type alias accordingly.
- Extend buildCliArgs(cli) to return correct one-shot invocation args for each CLI:
    claude   → ["-p", "--output-format", "text"]  (keep existing)
    codex    → ["exec", "--no-color"]              (keep existing)
    gemini   → ["-p"]                              (gemini CLI one-shot prompt flag)
    opencode → ["run", "--no-color"]               (opencode one-shot run subcommand)
  If the existing claude/codex args differ from the above, keep the existing ones — do not change what already works.
- In resolveCLIProvider(), honor a new env var TRAJECTORIES_LLM_CLI:
  * If set to one of the supported values, only try that CLI (skip others).
  * If unset, iterate SUPPORTED_CLIS in declaration order.
  * If set to an unsupported value, log a warning to stderr and fall through to auto-detect.
- Add a JSDoc comment above SUPPORTED_CLIS: "Kept inline (not imported from @agent-relay/sdk) because that dep was removed in 7e9783c. When agent-relay ships new compaction-capable CLIs, add them here manually."

Do NOT change the CLIProvider class, findBinary(), or CLI_SEARCH_PATHS. Only touch resolveProvider + resolveCLIProvider + SUPPORTED_CLIS + SupportedCli + buildCliArgs.

Only edit this one file.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-edit-provider", {
      type: "deterministic",
      dependsOn: ["edit-provider"],
      command: `cd ${TRAJ_ROOT} && if git diff --quiet src/compact/provider.ts; then echo NOT_MODIFIED; exit 1; fi && \
grep -q "TRAJECTORIES_LLM_CLI" src/compact/provider.ts && \
grep -q '"gemini"' src/compact/provider.ts && \
grep -q '"opencode"' src/compact/provider.ts && \
echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    .step("edit-schema-lenient", {
      agent: "impl",
      dependsOn: ["verify-edit-provider", "read-schema"],
      task: `Edit ${TRAJ_ROOT}/src/core/schema.ts to make TrajectoryEventTypeSchema permissive so trajectories emitted by other tools (notably agent-relay, which adds event types like "completion-evidence" and "completion-marker") can be loaded by trail compact without being entirely rejected.

Current contents:
{{steps.read-schema.output}}

Change: update TrajectoryEventTypeSchema from a strict z.enum([...]) to a permissive union matching the pattern already used by TaskSourceSystemSchema at the top of this file:

  export const TrajectoryEventTypeSchema = z.union([
    z.literal("prompt"),
    z.literal("thinking"),
    z.literal("tool_call"),
    z.literal("tool_result"),
    z.literal("message_sent"),
    z.literal("message_received"),
    z.literal("decision"),
    z.literal("finding"),
    z.literal("reflection"),
    z.literal("note"),
    z.literal("error"),
    z.string(), // Allow event types emitted by other tools (e.g. agent-relay's completion-evidence / completion-marker). Downstream code filters to known types.
  ]);

Keep TrajectoryEvent TypeScript type in src/core/types.ts unchanged — new code continues to use the strict union. This change only affects what validateTrajectory() will ACCEPT from disk, not what we write.

Add a one-line JSDoc above the schema explaining the permissive design.

Only edit this one file.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-edit-schema-lenient", {
      type: "deterministic",
      dependsOn: ["edit-schema-lenient"],
      command: `cd ${TRAJ_ROOT} && if git diff --quiet src/core/schema.ts; then echo NOT_MODIFIED; exit 1; fi && grep -q "TrajectoryEventTypeSchema" src/core/schema.ts && grep -A 20 "TrajectoryEventTypeSchema" src/core/schema.ts | grep -q "z.string()" && echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    .step("edit-compact-cmd", {
      agent: "impl",
      dependsOn: ["verify-edit-schema-lenient", "read-compact-cmd"],
      task: `Edit ${TRAJ_ROOT}/src/cli/commands/compact.ts.

Current contents (first 400 lines):
{{steps.read-compact-cmd.output}}

Add a new selector flag \`--workflow <id>\` alongside the existing --ids / --pr / --branch / --commits filters. When present:
- loadTrajectories() must filter to trajectories whose \`workflowId === id\`
- The output file name must be \`workflow-<id>.json\` (and \`.md\` when --markdown). Place under .agentworkforce/trajectories/compacted/ per existing convention.
- Surface the workflow id in any printed summary
- All other flags continue to work as before

Only edit this one file. Keep existing behavior intact when --workflow is not used.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-edit-compact-cmd", {
      type: "deterministic",
      dependsOn: ["edit-compact-cmd"],
      command: `cd ${TRAJ_ROOT} && if git diff --quiet src/cli/commands/compact.ts; then echo NOT_MODIFIED; exit 1; fi && grep -q -- "--workflow" src/cli/commands/compact.ts && echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    // ── Phase 5: Typecheck ──────────────────────────────────────────
    .step("typecheck", {
      type: "deterministic",
      dependsOn: ["verify-edit-compact-cmd"],
      command: `cd ${TRAJ_ROOT} && npm run typecheck 2>&1 | tail -60; echo "EXIT: $?"`,
      captureOutput: true,
      failOnError: false,
    })
    .step("fix-typecheck", {
      agent: "impl",
      dependsOn: ["typecheck"],
      task: `If the typecheck output below shows errors (non-zero EXIT), fix them. If it shows EXIT: 0 and no errors, do nothing.

Output:
{{steps.typecheck.output}}

Only edit files you previously touched: src/core/types.ts, src/core/schema.ts, src/sdk/client.ts, src/sdk/index.ts, src/compact/provider.ts, src/cli/commands/compact.ts. Re-run \`npm run typecheck\` until it passes.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("typecheck-final", {
      type: "deterministic",
      dependsOn: ["fix-typecheck"],
      command: `cd ${TRAJ_ROOT} && npm run typecheck 2>&1 | tail -20`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 6: Tests (Claude writes, vitest runs) ──────────────────
    .step("create-tests", {
      agent: "tester",
      dependsOn: ["typecheck-final"],
      task: `Create ${TRAJ_ROOT}/tests/sdk/workflow-compact.test.ts using vitest (this project uses vitest — see package.json scripts).

IMPORTANT — isolation strategy:
- The trajectories SDK writes to \`<cwd>/.agentworkforce/trajectories/\` by default. For isolation, each test must EITHER (a) process.chdir() into a tmp dir and restore the cwd in afterEach, OR (b) pass an explicit baseDir to TrajectoryClient if that option exists. Do NOT rely on an env var like TRAJECTORIES_DIR — the CLI and storage honor TRAJECTORIES_DATA_DIR / TRAJECTORIES_SEARCH_PATHS, not TRAJECTORIES_DIR.

Cover five cases:

1. TRAJECTORIES_WORKFLOW_ID env var stamps workflowId on trajectories created via TrajectoryClient.start(). Save + restore process.env.

2. Without TRAJECTORIES_WORKFLOW_ID set, the created trajectory has workflowId === undefined.

3. CLI filter end-to-end: cd into a tmp dir, create two trajectories, one with workflowId "wf-a", one without. Spawn the CLI via child_process.spawnSync from that cwd: \`npx tsx \${absoluteRepoRoot}/src/cli/index.ts compact --workflow wf-a --mechanical --all\`. Assert the compacted JSON file exists under \`<tmp>/.agentworkforce/trajectories/compacted/workflow-wf-a.json\` and its sourceTrajectories array contains only the tagged trajectory id.

4. compactWorkflow() SDK helper end-to-end: cd into a tmp dir containing one tagged trajectory, call await compactWorkflow("wf-a", { mechanical: true, markdown: true }), assert the returned compactedPath exists on disk.

5. Schema leniency: in a tmp cwd, write a raw trajectory JSON that includes an event with type "completion-evidence" (not one of the canonical event types) plus one normal "decision" event. Run trail compact via spawnSync. Assert the command exits 0 and produces a compacted file — i.e. the unknown event type does NOT cause the whole trajectory to be dropped.

Write the file. Use absolute paths for the CLI entrypoint. Always cd back and clean up tmp dirs in afterEach/finally.`,
      verification: {
        type: "file_exists",
        value: "tests/sdk/workflow-compact.test.ts",
      },
    })
    .step("run-tests", {
      type: "deterministic",
      dependsOn: ["create-tests"],
      command: `cd ${TRAJ_ROOT} && npx vitest run tests/sdk/workflow-compact.test.ts 2>&1 | tail -100; echo "EXIT: $?"`,
      captureOutput: true,
      failOnError: false,
    })
    .step("fix-tests", {
      agent: "tester",
      dependsOn: ["run-tests"],
      task: `If the test output below shows failures (non-zero EXIT or FAIL lines), fix them — could be a test bug or a source bug. If all passed, do nothing.

Test output:
{{steps.run-tests.output}}

Re-run \`npx vitest run tests/sdk/workflow-compact.test.ts\` until green. You may edit tests/sdk/workflow-compact.test.ts OR the impl files (src/sdk/client.ts, src/cli/commands/compact.ts, src/sdk/index.ts, src/compact/provider.ts, src/core/schema.ts, src/core/types.ts).`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("run-tests-final", {
      type: "deterministic",
      dependsOn: ["fix-tests"],
      command: `cd ${TRAJ_ROOT} && npx vitest run tests/sdk/workflow-compact.test.ts 2>&1 | tail -80`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 7: AFTER capture ─────────────────────────────────────
    .step("after-run", {
      type: "deterministic",
      dependsOn: ["run-tests-final"],
      command: `cd ${TRAJ_ROOT}/.trajectories-test/after && TRAJECTORIES_WORKFLOW_ID=bench-after npx tsx ${TRAJ_ROOT}/scripts/benchmark-compaction.ts 2>&1 | tee run.log`,
      captureOutput: true,
      failOnError: true,
    })
    .step("after-compact", {
      type: "deterministic",
      dependsOn: ["after-run"],
      command: `cd ${TRAJ_ROOT}/.trajectories-test/after && npx tsx ${TRAJ_ROOT}/src/cli/index.ts compact --workflow bench-after --markdown --all 2>&1 | tee -a run.log && find .agentworkforce/trajectories -type d -name compacted -exec ls -la {} \\; 2>&1 || true`,
      captureOutput: true,
      failOnError: true,
    })
    .step("after-stats", {
      type: "deterministic",
      dependsOn: ["after-compact"],
      command: `cd ${TRAJ_ROOT} && node -e '
const fs = require("fs");
const path = require("path");
const root = ".trajectories-test/after";
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".json") || e.name.endsWith(".md")) out.push(p);
  }
  return out;
}
const files = walk(root);
const raw = files.find(f => f.endsWith(".json") && !f.includes("/compacted/"));
const compacted = files.find(f => f.includes("/compacted/") && f.endsWith(".json") && /workflow-bench-after/.test(f));
const md = files.find(f => f.includes("/compacted/") && f.endsWith(".md") && /workflow-bench-after/.test(f));
if (!raw) { console.error("NO_RAW"); process.exit(1); }
if (!compacted) { console.error("NO_COMPACTED"); process.exit(1); }
if (!md) { console.error("NO_MARKDOWN"); process.exit(1); }
const rawData = JSON.parse(fs.readFileSync(raw, "utf8"));
const compactedData = JSON.parse(fs.readFileSync(compacted, "utf8"));
let events = 0;
for (const c of rawData.chapters || []) events += (c.events || []).length;
const stats = {
  raw_file: raw,
  compacted_file: compacted,
  md_file: md,
  raw_bytes: fs.statSync(raw).size,
  compacted_bytes: fs.statSync(compacted).size,
  md_bytes: fs.statSync(md).size,
  raw_event_count: events,
  raw_workflow_id: rawData.workflowId || null,
  has_narrative: typeof compactedData.narrative === "string" && compactedData.narrative.length > 0 ? 1 : 0,
  has_decisions: Array.isArray(compactedData.decisions) && compactedData.decisions.length > 0 ? 1 : 0,
  source_trajectory_count: Array.isArray(compactedData.sourceTrajectories) ? compactedData.sourceTrajectories.length : 0,
};
fs.writeFileSync(".trajectories-test/after/stats.json", JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));
'`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 8: BEFORE/AFTER comparison gate ────────────────────────
    .step("before-after-gate", {
      type: "deterministic",
      dependsOn: ["after-stats", "before-stats"],
      command: `cd ${TRAJ_ROOT} && node -e '
const fs = require("fs");
const before = JSON.parse(fs.readFileSync(".trajectories-test/before/stats.json", "utf8"));
const after = JSON.parse(fs.readFileSync(".trajectories-test/after/stats.json", "utf8"));
const failures = [];
if (before.has_workflow_id !== 0) failures.push("BEFORE trajectory already had workflowId — sample script was not using the pre-feature SDK");
if (after.raw_workflow_id !== "bench-after") failures.push("AFTER raw trajectory missing workflowId=\\"bench-after\\", got " + JSON.stringify(after.raw_workflow_id));
if (after.source_trajectory_count < 1) failures.push("AFTER compacted sourceTrajectories empty — --workflow filter selected nothing");
if (after.compacted_bytes >= after.raw_bytes) failures.push("AFTER compacted (" + after.compacted_bytes + "B) not smaller than raw (" + after.raw_bytes + "B)");
if (after.compacted_bytes > after.raw_bytes * 0.95) failures.push("AFTER compaction ratio too weak: " + (after.compacted_bytes / after.raw_bytes).toFixed(2) + " (want <= 0.95). Fixture may be too small — real trajectories with 200+ events compress much better.");
if (after.has_narrative < 1) failures.push("AFTER compacted missing narrative field");
if (after.has_decisions < 1) failures.push("AFTER compacted missing decisions field");
if (after.md_bytes < 200) failures.push("AFTER markdown too short: " + after.md_bytes + " bytes");
console.log("BEFORE:", JSON.stringify(before));
console.log("AFTER:", JSON.stringify(after));
if (failures.length) {
  console.error("\\nBEFORE/AFTER GATE FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
const ratio = (100 * after.compacted_bytes / after.raw_bytes).toFixed(0);
console.log("\\nBEFORE/AFTER GATE PASSED");
console.log("raw: " + after.raw_bytes + "B, compacted: " + after.compacted_bytes + "B (" + ratio + "% of raw), markdown: " + after.md_bytes + "B");
'`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 9: Self-review + Peer review ──────────────────────────
    .step("capture-diff", {
      type: "deterministic",
      dependsOn: ["before-after-gate"],
      command: `cd ${TRAJ_ROOT} && git diff src/core/types.ts src/core/schema.ts src/sdk/client.ts src/sdk/index.ts src/compact/provider.ts src/cli/commands/compact.ts tests/sdk/workflow-compact.test.ts scripts/benchmark-compaction.ts 2>&1 | head -900`,
      captureOutput: true,
      failOnError: false,
    })
    .step("self-review", {
      agent: "self-reviewer",
      dependsOn: ["capture-diff"],
      task: `You wrote this implementation. Self-review the diff for correctness, edge cases, and adherence to the brief.

Diff:
{{steps.capture-diff.output}}

Checklist:
- TrajectoryClient actually reads process.env.TRAJECTORIES_WORKFLOW_ID
- compactWorkflow() shells out to the local CLI, never re-implementing compaction
- trail compact --workflow <id> filters by workflowId and produces workflow-<id>.{json,md}
- Obvious bugs, missing null checks, hardcoded paths, dropped errors?

Write findings to ${TRAJ_ROOT}/.trajectories-test/self-review.md. If all clear, the file must contain the single line "SELF_REVIEW_CLEAR" on its own line. Otherwise list concrete issues.`,
      verification: {
        type: "file_exists",
        value: ".trajectories-test/self-review.md",
      },
    })
    .step("peer-review", {
      agent: "reviewer",
      dependsOn: ["capture-diff"],
      task: `Peer-review the implementation diff below. You did NOT write it.

Diff:
{{steps.capture-diff.output}}

Focus on:
1. Single source of truth: SDK MUST shell out to trail compact, never duplicate compaction logic inline
2. Env-var semantics: TRAJECTORIES_WORKFLOW_ID is the implicit tagging mechanism; explicit option on start() takes precedence
3. Backwards compatibility: existing trail compact calls without --workflow still work unchanged
4. Test coverage: do the tests hit the REAL CLI via spawnSync, not a mock?
5. Binary resolution: does compactWorkflow() find the trail binary robustly (env var, bin lookup, PATH fallback)?
6. No API key required: with "auto" provider and NO OPENAI/ANTHROPIC env vars set, does compaction still succeed by picking any installed CLI?
7. SUPPORTED_CLIS covers claude, codex, gemini, opencode — and buildCliArgs() has a case for each that is a valid one-shot invocation, not a stub?
8. TRAJECTORIES_LLM_CLI override honored when set to any of the four supported values; unsupported values log a warning and fall through?
9. TrajectoryEventTypeSchema is now a permissive union: trajectories containing unknown event types (e.g. completion-evidence) parse successfully; the whole trajectory is NOT dropped on validation. Test #5 covers this.

Write findings to ${TRAJ_ROOT}/.trajectories-test/peer-review.md. End with "PEER_REVIEW_APPROVED" on its own line if acceptable. Otherwise list blocking issues (one per line) before any approval line.`,
      verification: {
        type: "file_exists",
        value: ".trajectories-test/peer-review.md",
      },
    })

    .step("address-review", {
      agent: "impl",
      dependsOn: ["self-review", "peer-review"],
      task: `Read both review files. Address any blocking issues. If both end with SELF_REVIEW_CLEAR / PEER_REVIEW_APPROVED and no blocking items, do nothing.

Self-review: ${TRAJ_ROOT}/.trajectories-test/self-review.md
Peer-review: ${TRAJ_ROOT}/.trajectories-test/peer-review.md

Only edit: src/core/types.ts, src/core/schema.ts, src/sdk/client.ts, src/sdk/index.ts, src/compact/provider.ts, src/cli/commands/compact.ts, tests/sdk/workflow-compact.test.ts, scripts/benchmark-compaction.ts.

After your edits, re-run both:
  npm run typecheck
  npx vitest run tests/sdk/workflow-compact.test.ts
until both pass.`,
      verification: { type: "exit_code", value: "0" },
    })

    // ── Phase 10: Final gates ──────────────────────────────────────
    .step("tests-after-review", {
      type: "deterministic",
      dependsOn: ["address-review"],
      command: `cd ${TRAJ_ROOT} && npx vitest run tests/sdk/workflow-compact.test.ts 2>&1 | tail -80`,
      captureOutput: true,
      failOnError: true,
    })
    .step("typecheck-after-review", {
      type: "deterministic",
      dependsOn: ["address-review"],
      command: `cd ${TRAJ_ROOT} && npm run typecheck 2>&1 | tail -20`,
      captureOutput: true,
      failOnError: true,
    })
    .step("regression-tests", {
      type: "deterministic",
      dependsOn: ["tests-after-review", "typecheck-after-review"],
      command: `cd ${TRAJ_ROOT} && npm run test:run 2>&1 | tail -80; echo "REG_EXIT: $?"`,
      captureOutput: true,
      failOnError: false,
    })
    .step("fix-regressions", {
      agent: "impl",
      dependsOn: ["regression-tests"],
      task: `If existing tests broke (non-zero REG_EXIT or FAIL lines), fix only the regressions caused by our changes. If all passed, do nothing.

Regression output:
{{steps.regression-tests.output}}

Re-run \`npm run test:run\` until green.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("regression-final", {
      type: "deterministic",
      dependsOn: ["fix-regressions"],
      command: `cd ${TRAJ_ROOT} && npm run test:run 2>&1 | tail -40`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 11: Commit (deterministic) ────────────────────────────
    .step("commit", {
      type: "deterministic",
      dependsOn: ["regression-final"],
      command: `cd ${TRAJ_ROOT} && git add src/core/types.ts src/core/schema.ts src/sdk/client.ts src/sdk/index.ts src/compact/provider.ts src/cli/commands/compact.ts tests/sdk/workflow-compact.test.ts scripts/benchmark-compaction.ts workflows/sdk-workflow-autocompact.ts && git commit -m "feat: workflow-aware auto-compaction (SDK tag + trail compact --workflow)

Compaction stays in one place — the local trail CLI. The SDK only
tags trajectories and shells out. No API key is ever required: the
CLI provider (claude or codex, already installed and authenticated)
is the default, with API providers only used on explicit opt-in.

- Trajectory gains an optional workflowId field
- TrajectoryClient stamps workflowId from TRAJECTORIES_WORKFLOW_ID env
- New SDK helper compactWorkflow() spawns trail compact --workflow <id>
- trail compact --workflow <id> filter selects trajectories by run
- Output: .agentworkforce/trajectories/compacted/workflow-<id>.{json,md}
- resolveProvider() now prefers the CLI provider in auto mode
- SUPPORTED_CLIS expanded to claude, codex, gemini, opencode
- buildCliArgs() extended with one-shot invocations for gemini + opencode
- TRAJECTORIES_LLM_CLI env var pins which CLI to use when multiple installed
- TrajectoryEventTypeSchema made permissive: accepts unknown event types
  from other tools (e.g. agent-relay's completion-evidence) instead of
  dropping the whole trajectory on validation failure
- E2E before/after benchmark script + vitest coverage

When invoked under a relay workflow that sets TRAJECTORIES_WORKFLOW_ID,
the produced trajectory for the workflow run is collated and compacted
into a single tight artifact with narrative + decisions + lessons." 2>&1`,
      captureOutput: true,
      failOnError: true,
    })
    .step("push", {
      type: "deterministic",
      dependsOn: ["commit"],
      command: `cd ${TRAJ_ROOT} && branch=$(git rev-parse --abbrev-ref HEAD) && echo "Pushing $branch to origin..." && git push origin "$branch" 2>&1`,
      captureOutput: true,
      failOnError: true,
    })
    .step("comment-pr", {
      type: "deterministic",
      dependsOn: ["push"],
      command: `cd ${TRAJ_ROOT} && branch=$(git rev-parse --abbrev-ref HEAD) && pr_number=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null) && if [ -n "$pr_number" ]; then
  before=$(cat .trajectories-test/before/stats.json)
  after=$(cat .trajectories-test/after/stats.json)
  raw_bytes=$(node -e "console.log(require('./.trajectories-test/after/stats.json').raw_bytes)")
  compacted_bytes=$(node -e "console.log(require('./.trajectories-test/after/stats.json').compacted_bytes)")
  ratio=$(node -e "const s=require('./.trajectories-test/after/stats.json'); console.log(((100*s.compacted_bytes)/s.raw_bytes).toFixed(0))")
  gh pr comment "$pr_number" --body "## sdk-workflow-autocompact — before/after

Workflow ran end-to-end and passed the hard gate.

**Before** (raw trajectory, pre-feature SDK):
\\\`\\\`\\\`json
$before
\\\`\\\`\\\`

**After** (same benchmark with TRAJECTORIES_WORKFLOW_ID=bench-after, compacted via \\\`trail compact --workflow\\\`):
\\\`\\\`\\\`json
$after
\\\`\\\`\\\`

**Result**: raw $raw_bytes B → compacted $compacted_bytes B ($ratio% of raw), markdown generated, narrative + decisions populated.

No API key was required — compaction used the local CLI provider (claude/codex/gemini/opencode).
" 2>&1
else
  echo "No open PR for branch $branch — skipping comment"
fi`,
      captureOutput: true,
      failOnError: false,
    })
    .step("print-summary", {
      type: "deterministic",
      dependsOn: ["comment-pr"],
      command: `cd ${TRAJ_ROOT} && echo "=== COMMIT ===" && git log -1 --oneline && echo "=== PR ===" && (gh pr list --head "$(git rev-parse --abbrev-ref HEAD)" --json number,url --jq '.[0]' || true) && echo "=== BEFORE STATS ===" && cat .trajectories-test/before/stats.json && echo "=== AFTER STATS ===" && cat .trajectories-test/after/stats.json`,
      captureOutput: true,
      failOnError: false,
    })

    .onError("retry", { maxRetries: 1, retryDelayMs: 10_000 })
    .run({ cwd: process.cwd() });

  console.log("Workflow status:", result.status);
}

runWorkflow().catch((error) => {
  console.error(error);
  process.exit(1);
});
