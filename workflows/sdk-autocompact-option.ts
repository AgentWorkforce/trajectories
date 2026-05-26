/**
 * sdk-autocompact-option.ts
 *
 * Adds an `autoCompact` option to TrajectoryClient so that
 * session.complete() / session.done() automatically runs compactWorkflow()
 * when the trajectory has a workflowId. This removes the need for a
 * separate compact step in any relay workflow that uses the SDK — users
 * just call complete() and the compacted artifact appears at
 * .agentworkforce/trajectories/compacted/workflow-<id>.{json,md}.
 *
 * Validation strategy (80 -> 100):
 *   1. BEFORE: deterministic tsx probe creates a trajectory with
 *      TRAJECTORIES_WORKFLOW_ID set, calls complete(), and asserts NO
 *      compacted file was produced. Proves autoCompact doesn't silently
 *      exist today.
 *   2. Implement: codex edits src/sdk/client.ts to add the option and
 *      wire it through TrajectorySession.complete() + done().
 *   3. Tests: claude adds vitest cases covering the 4 autoCompact
 *      permutations (true/false x workflowId present/absent), plus a
 *      graceful-failure case.
 *   4. AFTER: deterministic tsx probe with autoCompact: true asserts
 *      the compacted file DOES exist and has narrative + decisions.
 *   5. Hard gate: the BEFORE file must not exist, the AFTER file must
 *      exist and be non-trivial.
 *   6. Self-review (codex) + peer-review (claude) with diff as input.
 *   7. Full regression + typecheck + commit + push to PR.
 *
 * Team split (per relay-80-100 + writing-agent-relay-workflows skills):
 *   - impl (codex, worker preset): edits client.ts
 *   - tester (claude, worker preset): writes vitest cases, runs
 *     before/after probes, iterates on failures
 *   - reviewer (claude, worker preset): peer-reviews the diff
 *   - self-reviewer (codex, worker preset): self-reviews its own diff
 *
 * All agents use `preset: 'worker'` to avoid the interactive-claude PTY
 * hang we hit in the last implementation workflow.
 *
 * Run: agent-relay run workflows/sdk-autocompact-option.ts
 */

import { workflow } from "@agent-relay/sdk/workflows";

const TRAJ_ROOT = process.cwd();

async function runWorkflow() {
  const result = await workflow("sdk-autocompact-option")
    .description(
      "Add autoCompact option to TrajectoryClient so session.complete() auto-runs compactWorkflow() when a workflowId is present",
    )
    .pattern("dag")
    .channel("wf-autocompact-option")
    .maxConcurrency(5)
    .timeout(2_400_000)

    .agent("impl", {
      cli: "codex",
      preset: "worker",
      role: "Implements the autoCompact option in TrajectoryClient",
      retries: 2,
    })
    .agent("tester", {
      cli: "claude",
      preset: "worker",
      role: "Writes tests and runs the before/after probes",
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
      role: "Self-reviews the implementation diff",
      retries: 1,
    })

    // ── Phase 0: Clean workspace + build dist ───────────────────────
    .step("clean-workspace", {
      type: "deterministic",
      command: `rm -rf ${TRAJ_ROOT}/.trajectories-test/autocompact && mkdir -p ${TRAJ_ROOT}/.trajectories-test/autocompact/before ${TRAJ_ROOT}/.trajectories-test/autocompact/after && echo OK`,
      captureOutput: true,
      failOnError: true,
    })
    // Build dist/cli/index.js so the SDK's compactWorkflow() can resolve
    // the trail binary. Without this the probe spawns "trail" on PATH,
    // which is not installed in a dev checkout — compaction then fails
    // silently (graceful degradation kicks in), and autoCompact looks
    // like a no-op when it's actually the harness that's broken.
    .step("build-dist", {
      type: "deterministic",
      dependsOn: ["clean-workspace"],
      command: `cd ${TRAJ_ROOT} && npm run build 2>&1 | tail -10 && test -f dist/cli/index.js && echo "BUILD_OK"`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 1: Read context files ─────────────────────────────────
    .step("read-client", {
      type: "deterministic",
      dependsOn: ["build-dist"],
      command: `cat ${TRAJ_ROOT}/src/sdk/client.ts`,
      captureOutput: true,
    })
    .step("read-tests", {
      type: "deterministic",
      dependsOn: ["build-dist"],
      command: `cat ${TRAJ_ROOT}/tests/sdk/workflow-compact.test.ts`,
      captureOutput: true,
    })

    // ── Phase 2: BEFORE probe — prove autoCompact doesn't exist yet ─
    // The probe creates a trajectory with a workflowId, calls complete(),
    // and asserts no compacted file was produced. On the clean tree this
    // MUST succeed (there is no autoCompact today, so nothing happens on
    // complete). This locks in the "before" baseline.
    .step("before-probe", {
      type: "deterministic",
      dependsOn: ["read-client"],
      command: `cd ${TRAJ_ROOT}/.trajectories-test/autocompact/before && TRAJECTORIES_WORKFLOW_ID=wf-before TRAJECTORIES_CLI=${TRAJ_ROOT}/dist/cli/index.js npx tsx ${TRAJ_ROOT}/scripts/autocompact-probe.mts 2>&1 && node -e '
const { existsSync, readdirSync } = require("node:fs");
const compactedDir = ".agentworkforce/trajectories/compacted";
const files = existsSync(compactedDir) ? readdirSync(compactedDir) : [];
const matches = files.filter((f) => f.includes("workflow-wf-before"));
if (matches.length > 0) {
  console.error("BEFORE_FAILED: expected no compacted file, found " + matches.join(", "));
  process.exit(1);
}
console.log("BEFORE_OK: no compacted artifact produced (as expected pre-feature / opt-in off)");
'`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 3: Implementation ─────────────────────────────────────
    .step("edit-client", {
      agent: "impl",
      dependsOn: ["before-probe", "read-client"],
      task: `Edit ${TRAJ_ROOT}/src/sdk/client.ts to add an \`autoCompact\` option on TrajectoryClient so that session.complete() / session.done() automatically invoke compactWorkflow() when the trajectory has a workflowId.

Current contents:
{{steps.read-client.output}}

Required changes:

1. Extend \`TrajectoryClientOptions\` with an OPTIONAL field:
     autoCompact?: boolean | { mechanical?: boolean; markdown?: boolean };
   Document it with a JSDoc comment: "When set, session.complete() and session.done() automatically run compactWorkflow() against the trajectory's workflowId. Default false. Pass an object to control the flags passed to the CLI — e.g. { mechanical: true } skips the LLM for deterministic compaction, { markdown: false } skips the .md companion."

2. Store the option on TrajectoryClient:
     - Add a \`private readonly autoCompact: false | { mechanical: boolean; markdown: boolean }\` field.
     - In the constructor, normalize: \`false\` when unset/false, otherwise \`{ mechanical: ..., markdown: ... }\` with defaults \`mechanical: false, markdown: true\`.
     - Expose a getter or method on TrajectoryClient that TrajectorySession can read (e.g. \`getAutoCompactOptions(): false | { mechanical: boolean; markdown: boolean }\`).

3. Update TrajectorySession so that after complete() saves the trajectory, if the stored autoCompact is not false AND this.trajectory.workflowId is set, call:
     await compactWorkflow(this.trajectory.workflowId, autoCompactOptions);
   Wrap the call in try/catch — on failure, log a warning to console.error but do NOT throw. complete() must still return the completed trajectory cleanly. Failure here is a degradation, not a hard error (the raw trajectory is already saved).

4. Do the same in session.done() by routing through complete() (or by calling compactWorkflow directly if done() has its own path). Make sure both entry points trigger autoCompact.

5. Do NOT change the signature of complete() / done(). Do NOT move compactWorkflow into the core path. Keep the SDK's role as "tag + shell out" intact.

6. autoCompact is purely opt-in. When \`new TrajectoryClient()\` is called with no options, behavior must be unchanged — no compaction fires on complete().

Only edit src/sdk/client.ts. No other files.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-edit-client", {
      type: "deterministic",
      dependsOn: ["edit-client"],
      command: `cd ${TRAJ_ROOT} && if git diff --quiet src/sdk/client.ts; then echo NOT_MODIFIED; exit 1; fi && grep -q "autoCompact" src/sdk/client.ts && echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    // ── Phase 4: Typecheck ──────────────────────────────────────────
    .step("typecheck", {
      type: "deterministic",
      dependsOn: ["verify-edit-client"],
      command: `cd ${TRAJ_ROOT} && npm run typecheck 2>&1 | tail -40; echo "EXIT: $?"`,
      captureOutput: true,
      failOnError: false,
    })
    .step("fix-typecheck", {
      agent: "impl",
      dependsOn: ["typecheck"],
      task: `If the typecheck output below shows errors (non-zero EXIT), fix them. If EXIT: 0 and no errors, do nothing.

Output:
{{steps.typecheck.output}}

Only edit src/sdk/client.ts. Re-run \`npm run typecheck\` until it passes.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("typecheck-final", {
      type: "deterministic",
      dependsOn: ["fix-typecheck"],
      command: `cd ${TRAJ_ROOT} && npm run typecheck 2>&1 | tail -20`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 5: Tests ──────────────────────────────────────────────
    .step("add-tests", {
      agent: "tester",
      dependsOn: ["typecheck-final", "read-tests"],
      task: `Extend ${TRAJ_ROOT}/tests/sdk/workflow-compact.test.ts with new vitest cases covering the autoCompact option. Do NOT touch existing tests.

Current file:
{{steps.read-tests.output}}

Add these four cases inside the existing \`describe("workflow compaction", ...)\` block (or a nested describe — your call):

1. "autoCompact: true + workflowId set => complete() produces a compacted file"
   - process.env.TRAJECTORIES_WORKFLOW_ID = "wf-auto-on"
   - const client = new TrajectoryClient({ autoCompact: { mechanical: true, markdown: true } })
   - await client.init(); start a session; call session.done("...", 0.9)
   - Assert .agentworkforce/trajectories/compacted/workflow-wf-auto-on.json exists and its sourceTrajectories contains the session id

2. "autoCompact: true + no workflowId => complete() succeeds without compacting"
   - TRAJECTORIES_WORKFLOW_ID unset
   - Same client config
   - Assert complete() returns normally AND .agentworkforce/trajectories/compacted has no workflow-* files

3. "autoCompact: false (default) + workflowId set => complete() does NOT compact (backwards compat)"
   - process.env.TRAJECTORIES_WORKFLOW_ID = "wf-default-off"
   - const client = new TrajectoryClient() (no autoCompact option)
   - Assert no compacted file exists after complete()

4. "autoCompact degrades gracefully if compaction fails"
   - Point TRAJECTORIES_CLI at a path that doesn't exist: process.env.TRAJECTORIES_CLI = "/nonexistent/trail"
   - process.env.TRAJECTORIES_WORKFLOW_ID = "wf-fail"
   - autoCompact: true
   - Assert session.done() still resolves to a completed Trajectory (does NOT throw)
   - Assert the raw trajectory is saved to disk

Use the existing helpers (clearEnv, snapshotEnv, restoreEnv, tempDir cwd). Use \`{ mechanical: true }\` in autoCompact so tests don't hit a real LLM.

Only edit tests/sdk/workflow-compact.test.ts.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("verify-add-tests", {
      type: "deterministic",
      dependsOn: ["add-tests"],
      command: `cd ${TRAJ_ROOT} && if git diff --quiet tests/sdk/workflow-compact.test.ts; then echo NOT_MODIFIED; exit 1; fi && grep -qc "autoCompact" tests/sdk/workflow-compact.test.ts && echo OK`,
      failOnError: true,
      captureOutput: true,
    })

    .step("run-tests", {
      type: "deterministic",
      dependsOn: ["verify-add-tests"],
      command: `cd ${TRAJ_ROOT} && npx vitest run tests/sdk/workflow-compact.test.ts 2>&1 | tail -80; echo "EXIT: $?"`,
      captureOutput: true,
      failOnError: false,
    })
    .step("fix-tests", {
      agent: "tester",
      dependsOn: ["run-tests"],
      task: `If the test output below shows failures (non-zero EXIT or FAIL lines), fix them. If all passed, do nothing.

Test output:
{{steps.run-tests.output}}

You may edit tests/sdk/workflow-compact.test.ts OR src/sdk/client.ts to fix real bugs. Re-run \`npx vitest run tests/sdk/workflow-compact.test.ts\` until green.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("run-tests-final", {
      type: "deterministic",
      dependsOn: ["fix-tests"],
      command: `cd ${TRAJ_ROOT} && npx vitest run tests/sdk/workflow-compact.test.ts 2>&1 | tail -60`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 6: AFTER probe — prove autoCompact now works ──────────
    .step("after-probe", {
      type: "deterministic",
      dependsOn: ["run-tests-final"],
      command: `cd ${TRAJ_ROOT}/.trajectories-test/autocompact/after && TRAJECTORIES_WORKFLOW_ID=wf-after PROBE_AUTOCOMPACT=true TRAJECTORIES_CLI=${TRAJ_ROOT}/dist/cli/index.js npx tsx ${TRAJ_ROOT}/scripts/autocompact-probe.mts 2>&1 && node -e '
const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");
const compactedDir = ".agentworkforce/trajectories/compacted";
if (!existsSync(compactedDir)) {
  console.error("AFTER_FAILED: .agentworkforce/trajectories/compacted not created");
  process.exit(1);
}
const files = readdirSync(compactedDir).filter((f) => f.includes("workflow-wf-after"));
if (files.length < 1) {
  console.error("AFTER_FAILED: no workflow-wf-after artifact");
  process.exit(1);
}
const jsonFile = files.find((f) => f.endsWith(".json"));
const mdFile = files.find((f) => f.endsWith(".md"));
if (!jsonFile) { console.error("AFTER_FAILED: no .json artifact"); process.exit(1); }
if (!mdFile) { console.error("AFTER_FAILED: no .md artifact"); process.exit(1); }
const data = JSON.parse(readFileSync(join(compactedDir, jsonFile), "utf-8"));
const jsonBytes = statSync(join(compactedDir, jsonFile)).size;
const mdBytes = statSync(join(compactedDir, mdFile)).size;
console.log("AFTER_OK: " + jsonFile + " (" + jsonBytes + "B), " + mdFile + " (" + mdBytes + "B)");
console.log("sourceTrajectories: " + JSON.stringify(data.sourceTrajectories));
console.log("decisions: " + (Array.isArray(data.decisions) ? data.decisions.length : "n/a"));
if (!Array.isArray(data.sourceTrajectories) || data.sourceTrajectories.length < 1) {
  console.error("AFTER_FAILED: sourceTrajectories empty");
  process.exit(1);
}
'`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 7: Hard BEFORE/AFTER gate ─────────────────────────────
    .step("before-after-gate", {
      type: "deterministic",
      dependsOn: ["after-probe", "before-probe"],
      command: `cd ${TRAJ_ROOT} && node -e '
const { existsSync, readdirSync } = require("node:fs");
const beforeDir = ".trajectories-test/autocompact/before/.agentworkforce/trajectories/compacted";
const afterDir = ".trajectories-test/autocompact/after/.agentworkforce/trajectories/compacted";
const failures = [];
if (existsSync(beforeDir)) {
  const beforeFiles = readdirSync(beforeDir).filter((f) => f.includes("workflow-wf-before"));
  if (beforeFiles.length > 0) failures.push("BEFORE produced compacted files: " + beforeFiles.join(", "));
}
if (!existsSync(afterDir)) failures.push("AFTER did not create compacted dir");
else {
  const afterFiles = readdirSync(afterDir).filter((f) => f.includes("workflow-wf-after"));
  if (afterFiles.length < 2) failures.push("AFTER expected .json + .md, found " + afterFiles.length + ": " + afterFiles.join(", "));
}
if (failures.length) {
  console.error("BEFORE/AFTER GATE FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("BEFORE/AFTER GATE PASSED: autoCompact is a real behavior change");
'`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 8: Self-review + peer review ──────────────────────────
    .step("capture-diff", {
      type: "deterministic",
      dependsOn: ["before-after-gate"],
      command: `cd ${TRAJ_ROOT} && git diff src/sdk/client.ts tests/sdk/workflow-compact.test.ts 2>&1 | head -500`,
      captureOutput: true,
      failOnError: false,
    })
    .step("self-review", {
      agent: "self-reviewer",
      dependsOn: ["capture-diff"],
      task: `You wrote this implementation. Self-review the diff below for correctness, edge cases, and adherence to the brief.

Diff:
{{steps.capture-diff.output}}

Checklist:
- autoCompact is opt-in: new TrajectoryClient() with no options MUST NOT trigger compaction
- When autoCompact.mechanical is passed to compactWorkflow(), the CLI spawn really includes --mechanical
- Failures in compactWorkflow() are swallowed (logged, not thrown) so complete() never rejects
- complete() still saves the raw trajectory BEFORE attempting compaction (so failure doesn't lose work)
- Both session.complete() and session.done() trigger autoCompact
- No other files touched

Write findings to ${TRAJ_ROOT}/.trajectories-test/autocompact/self-review.md. If all clear, the file must contain the single line "SELF_REVIEW_CLEAR". Otherwise list concrete issues.`,
      verification: {
        type: "file_exists",
        value: ".trajectories-test/autocompact/self-review.md",
      },
    })
    .step("peer-review", {
      agent: "reviewer",
      dependsOn: ["capture-diff"],
      task: `Peer-review the implementation diff below. You did NOT write it.

Diff:
{{steps.capture-diff.output}}

Focus on:
1. Opt-in safety: does default behavior change? A user who does not pass autoCompact must see identical behavior to before.
2. Error handling: compactWorkflow can throw (missing CLI, subprocess failure). Does complete() swallow errors but log them?
3. Ordering: the raw trajectory MUST be saved before compaction runs — otherwise a compaction failure could lose the user's work.
4. Tests hit both success and failure paths? Tests avoid real LLM calls (mechanical: true)?
5. The SDK still shells out to trail compact for compaction — it does not re-implement compaction inline?

Write findings to ${TRAJ_ROOT}/.trajectories-test/autocompact/peer-review.md. End with "PEER_REVIEW_APPROVED" on its own line if acceptable. Otherwise list blocking issues.`,
      verification: {
        type: "file_exists",
        value: ".trajectories-test/autocompact/peer-review.md",
      },
    })

    .step("address-review", {
      agent: "impl",
      dependsOn: ["self-review", "peer-review"],
      task: `Read both review files and address any blocking issues. If both end with SELF_REVIEW_CLEAR / PEER_REVIEW_APPROVED and no blocking items, do nothing.

Self-review: ${TRAJ_ROOT}/.trajectories-test/autocompact/self-review.md
Peer-review: ${TRAJ_ROOT}/.trajectories-test/autocompact/peer-review.md

Only edit: src/sdk/client.ts, tests/sdk/workflow-compact.test.ts.

After your edits, re-run both:
  npm run typecheck
  npx vitest run tests/sdk/workflow-compact.test.ts
until both pass.`,
      verification: { type: "exit_code", value: "0" },
    })

    // ── Phase 9: Final gates ────────────────────────────────────────
    .step("tests-after-review", {
      type: "deterministic",
      dependsOn: ["address-review"],
      command: `cd ${TRAJ_ROOT} && npx vitest run tests/sdk/workflow-compact.test.ts 2>&1 | tail -60`,
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
      command: `cd ${TRAJ_ROOT} && npm run test:run 2>&1 | tail -40; echo "REG_EXIT: $?"`,
      captureOutput: true,
      failOnError: false,
    })
    .step("fix-regressions", {
      agent: "impl",
      dependsOn: ["regression-tests"],
      task: `If existing tests broke, fix only the regressions caused by our changes. If all passed, do nothing.

Regression output:
{{steps.regression-tests.output}}

Only edit: src/sdk/client.ts, tests/sdk/workflow-compact.test.ts. Re-run \`npm run test:run\` until green.`,
      verification: { type: "exit_code", value: "0" },
    })
    .step("regression-final", {
      type: "deterministic",
      dependsOn: ["fix-regressions"],
      command: `cd ${TRAJ_ROOT} && npm run test:run 2>&1 | tail -30`,
      captureOutput: true,
      failOnError: true,
    })

    // ── Phase 10: Commit + push to PR ───────────────────────────────
    .step("commit", {
      type: "deterministic",
      dependsOn: ["regression-final"],
      command: `cd ${TRAJ_ROOT} && git add src/sdk/client.ts tests/sdk/workflow-compact.test.ts workflows/sdk-autocompact-option.ts scripts/autocompact-probe.mts && git commit -m "feat(sdk): autoCompact option on TrajectoryClient auto-runs compactWorkflow on complete

When TrajectoryClient is constructed with autoCompact: true (or an
options object with mechanical/markdown overrides) and the trajectory
has a workflowId stamped, session.complete() and session.done() will
automatically shell out to trail compact --workflow <id> after saving
the raw trajectory. The compacted artifact appears at
.agentworkforce/trajectories/compacted/workflow-<id>.{json,md}.

This removes the need for a separate compact step in any SDK consumer
running under a relay workflow — just set TRAJECTORIES_WORKFLOW_ID in
the environment and construct the client with autoCompact: true, and
complete() produces the tight artifact as a side effect.

- autoCompact is opt-in: default behavior unchanged
- Compaction failures are logged but do NOT fail complete() — the raw
  trajectory is always saved first
- Backed by a BEFORE/AFTER validation workflow under workflows/
- Tests cover all four permutations plus graceful failure" 2>&1`,
      captureOutput: true,
      failOnError: true,
    })
    .step("push", {
      type: "deterministic",
      dependsOn: ["commit"],
      command: `cd ${TRAJ_ROOT} && branch=$(git rev-parse --abbrev-ref HEAD) && git push origin "$branch" 2>&1`,
      captureOutput: true,
      failOnError: true,
    })
    .step("comment-pr", {
      type: "deterministic",
      dependsOn: ["push"],
      command: `cd ${TRAJ_ROOT} && branch=$(git rev-parse --abbrev-ref HEAD) && pr=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null) && if [ -n "$pr" ]; then
  gh pr comment "$pr" --body "## sdk-autocompact-option — validated end-to-end

BEFORE/AFTER gate PASSED. The feature is a genuine behavior change, not a no-op:

- **BEFORE**: \\\`new TrajectoryClient()\\\` + session.done() produces NO compacted file (baseline locked).
- **AFTER**: \\\`new TrajectoryClient({ autoCompact: { mechanical: true } })\\\` + session.done() with TRAJECTORIES_WORKFLOW_ID set automatically produces \\\`.agentworkforce/trajectories/compacted/workflow-<id>.{json,md}\\\`.

Ran via \\\`agent-relay run workflows/sdk-autocompact-option.ts\\\` with codex impl + claude tests + claude peer review + codex self-review.
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
      command: `cd ${TRAJ_ROOT} && echo "=== COMMIT ===" && git log -1 --oneline && echo "=== PR ===" && (gh pr list --head "$(git rev-parse --abbrev-ref HEAD)" --json url --jq '.[0].url' || true)`,
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
