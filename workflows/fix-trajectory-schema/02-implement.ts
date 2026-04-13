/**
 * 02-implement.ts
 *
 * Phase 3 + 4 of the trajectory-schema comprehensive fix.
 *
 * Prerequisites (validated by require-decision-file step):
 *   - investigation-findings.md and DECISION.md exist at OUTPUT_DIR
 *   - TRAJ_WORKTREE and WORKFORCE_WORKTREE env vars point to existing
 *     git worktrees created by run-all.sh
 *
 * This workflow:
 *   1. Reads DECISION.md + findings + current source context from the
 *      trajectories worktree
 *   2. Implements schema/reader/save-validation changes inside TRAJ_WORKTREE
 *      (stacked on top of the reconcile work already present on that branch)
 *   3. Conditionally aligns workforce writer inside WORKFORCE_WORKTREE
 *   4. Builds + runs unit tests from TRAJ_WORKTREE
 *   5. E2E verification: runs the worktree-built CLI against a copy of
 *      workforce/.trajectories/, gating on 3 hard signals
 *   6. Lead commits in both worktrees, pushes, opens 2 PRs, prints URLs
 *
 * Normally invoked by run-all.sh, but can be run standalone IF you set
 * TRAJ_WORKTREE + WORKFORCE_WORKTREE manually first.
 */

import { workflow } from "@agent-relay/sdk/workflows";

const TRAJ_ROOT =
  process.env.TRAJ_ROOT ??
  "/Users/khaliqgant/Projects/AgentWorkforce/trajectories";
const WORKFORCE_ROOT =
  process.env.WORKFORCE_ROOT ??
  "/Users/khaliqgant/Projects/AgentWorkforce/workforce";
const TRAJ_WORKTREE = process.env.TRAJ_WORKTREE ?? "/tmp/wt-traj-schema";
const WORKFORCE_WORKTREE =
  process.env.WORKFORCE_WORKTREE ?? "/tmp/wt-workforce-writer";
const TRAJ_BRANCH =
  process.env.TRAJ_BRANCH ?? "fix/trajectory-schema-comprehensive";
const WORKFORCE_BRANCH =
  process.env.WORKFORCE_BRANCH ?? "fix/trajectory-writer-align";

const WORKFLOW_DIR = `${TRAJ_ROOT}/workflows/fix-trajectory-schema`;
const FINDINGS_PATH = `${WORKFLOW_DIR}/investigation-findings.md`;
const DECISION_PATH = `${WORKFLOW_DIR}/DECISION.md`;
const E2E_SCRATCH = "/tmp/traj-schema-e2e";

async function main() {
  const result = await workflow("fix-trajectory-schema-implement")
    .description(
      "Implement schema/reader/writer fix in worktrees, E2E-gate against real data, open PRs",
    )
    .pattern("dag")
    .channel("wf-fix-traj-schema-implement")
    .maxConcurrency(4)
    .timeout(3_600_000)

    .agent("lead", {
      cli: "claude",
      role: "Lead coordinator — reviews outputs, commits in worktrees, opens PRs",
    })
    .agent("trajectories-worker", {
      cli: "codex",
      preset: "worker",
      role: "Implements schema + reader + save-validation in trajectories worktree",
    })
    .agent("workforce-worker", {
      cli: "codex",
      preset: "worker",
      role: "Aligns trajectory writer in workforce worktree (conditional)",
    })

    // ---------- Phase A: validate prereqs + gather context ----------

    .step("require-decision-file", {
      type: "deterministic",
      command: `
set -e
if [ ! -f "${FINDINGS_PATH}" ]; then
  echo "FATAL: ${FINDINGS_PATH} missing. Run 01-investigate.ts first." >&2
  exit 1
fi
if [ ! -f "${DECISION_PATH}" ]; then
  echo "FATAL: ${DECISION_PATH} missing." >&2
  exit 1
fi
if [ ! -d "${TRAJ_WORKTREE}" ]; then
  echo "FATAL: TRAJ_WORKTREE=${TRAJ_WORKTREE} is not a directory." >&2
  echo "Run run-all.sh which sets up the worktrees, or create it manually:" >&2
  echo "  git -C ${TRAJ_ROOT} worktree add ${TRAJ_WORKTREE} -b ${TRAJ_BRANCH}" >&2
  exit 1
fi
if [ ! -d "${WORKFORCE_WORKTREE}" ]; then
  echo "FATAL: WORKFORCE_WORKTREE=${WORKFORCE_WORKTREE} is not a directory." >&2
  exit 1
fi
echo "=== DECISION ==="
cat ${DECISION_PATH}
echo ""
echo "=== FINDINGS (context injection) ==="
cat ${FINDINGS_PATH}
echo ""
echo "=== TRAJ_WORKTREE branch ==="
git -C ${TRAJ_WORKTREE} branch --show-current
echo ""
echo "=== WORKFORCE_WORKTREE branch ==="
git -C ${WORKFORCE_WORKTREE} branch --show-current
`.trim(),
      captureOutput: true,
      failOnError: true,
    })

    .step("read-trajectories-source", {
      type: "deterministic",
      dependsOn: ["require-decision-file"],
      command: `
set -e
echo "=== src/core/schema.ts ==="
cat ${TRAJ_WORKTREE}/src/core/schema.ts
echo ""
echo "=== src/core/id.ts ==="
cat ${TRAJ_WORKTREE}/src/core/id.ts
echo ""
echo "=== src/core/types.ts ==="
cat ${TRAJ_WORKTREE}/src/core/types.ts
echo ""
echo "=== src/storage/file.ts (full — worker must read but not modify storage internals) ==="
cat ${TRAJ_WORKTREE}/src/storage/file.ts
`.trim(),
      captureOutput: true,
      failOnError: true,
    })

    // Baseline vitest count — lets impl-trajectories assert monotonicity.
    // If the post-impl pass count drops below baseline, the workflow knows
    // the worker introduced a regression at vitest-layer (fast) rather
    // than waiting for the E2E gate (8 minutes).
    .step("vitest-baseline", {
      type: "deterministic",
      dependsOn: ["require-decision-file"],
      command: `
set -e
cd ${TRAJ_WORKTREE}
if [ ! -e node_modules ]; then
  ln -sf ${TRAJ_ROOT}/node_modules ${TRAJ_WORKTREE}/node_modules
fi
OUTPUT=$(npx vitest run 2>&1 || true)
echo "$OUTPUT" | tail -10
PASSED=$(echo "$OUTPUT" | grep -Eo "Tests  [0-9]+ passed" | grep -Eo "[0-9]+" | head -1)
if [ -z "$PASSED" ]; then
  echo "BASELINE_FAIL: could not parse vitest output" >&2
  exit 1
fi
echo "BASELINE_PASSED=$PASSED"
`.trim(),
      captureOutput: true,
      failOnError: true,
    })

    // ---------- Phase B: parallel implementation in worktrees ----------

    .step("impl-trajectories", {
      agent: "trajectories-worker",
      dependsOn: ["read-trajectories-source", "vitest-baseline"],
      task: `
Implement the trajectory schema loosening inside the trajectories WORKTREE.
All paths below are in the worktree, NOT the primary checkout.

Worktree: ${TRAJ_WORKTREE}
Branch:   ${TRAJ_BRANCH}

=== HARD CONSTRAINTS — read these before touching anything ===

1. The files below are COMPLETE AND CORRECT at this branch. DO NOT modify
   them. They are load-bearing for legacy-data compatibility.
     - src/storage/file.ts  (reconcileIndex, readTrajectoryFile,
       readTrajectoryOrNull, walkJsonFilesInto, ReconcileSummary, the
       save() path's validateTrajectory call — ALL of this is done)
     - tests/storage/storage.test.ts  (all existing reconcile tests)
     - tests/storage/reconcile-real-data.test.ts  (fixture-based locks)
     - tests/fixtures/workforce-trajectories/**  (fixtures)

   If you find yourself about to write a line in any of those files,
   STOP. That is a regression. Exit with a non-zero status and report
   exactly which file tempted you to edit.

2. Your work is scoped to these files ONLY:
     - src/core/schema.ts   (constraint loosening per DECISION)
     - src/core/id.ts       (isValidTrajectoryId regex)
     - src/core/types.ts    (mirror TS types to zod shape)
     - tests/core/schema.test.ts  (NEW unit tests for loosened constraints)

   If a deliverable below seems to require editing outside this list, it
   is already done by a previous step — move on.

3. Run \`vitest run\` BEFORE making any edits and record the pass count.
   The baseline from the vitest-baseline step is:
     {{steps.vitest-baseline.output}}
   After your edits, run vitest again. The post-impl pass count MUST be
   >= the baseline pass count. A drop is a hard fail — revert and retry.

=== DECISION + FINDINGS ===
{{steps.require-decision-file.output}}

=== CURRENT SOURCE (for reference — DO NOT EDIT storage/file.ts) ===
{{steps.read-trajectories-source.output}}

=== DELIVERABLES ===

1. src/core/schema.ts — apply ID_REGEX, ROLE_POLICY, and any other
   constraint the DECISION flags. If a constraint you'd change is already
   loose enough for the DECISION, leave it alone.

2. src/core/id.ts — if ID_REGEX changed, update isValidTrajectoryId so
   both the canonical form AND the legacy timestamp-hex form validate.

3. src/core/types.ts — mirror the schema changes at the TS type level so
   existing TS consumers don't break. Prefer \`string\` over literal
   unions where the zod side has been opened up.

4. tests/core/schema.test.ts — add (or update) unit tests that assert:
   - Legacy ids like "traj_1775734701264_ba65c69b" pass validateTrajectory
   - Legacy role values like "workflow-runner" pass
   - Optional/default fields (commits, filesChanged, tags) default to []
   - projectId is optional
   If the file doesn't exist, create it in the same style as
   tests/core/trailers.test.ts.

5. Run \`cd ${TRAJ_WORKTREE} && npx vitest run\`. Report:
     - POST_IMPL_PASSED=<count>
     - Whether POST_IMPL_PASSED >= baseline (yes/no)
   If not yes, exit non-zero.

=== CONSTRAINTS ===
  - Do NOT git commit
  - Do NOT touch workflows/, node_modules, dist/, or package.json
  - Do NOT add new dependencies
  - Keep the diff minimal

Exit 0 on success (all tests pass, pass count monotonically non-decreasing).
`.trim(),
      verification: { type: "exit_code" },
      retries: 1,
    })

    .step("impl-workforce", {
      agent: "workforce-worker",
      dependsOn: ["require-decision-file"],
      task: `
Conditional on FIX_WORKFORCE_WRITER in DECISION.md.

DECISION + FINDINGS:
{{steps.require-decision-file.output}}

If the DECISION says FIX_WORKFORCE_WRITER=no, print exactly:
  SKIPPED: no workforce changes requested
and exit 0. Do nothing else.

Otherwise, all work happens inside the workforce WORKTREE:

Worktree: ${WORKFORCE_WORKTREE}
Branch:   ${WORKFORCE_BRANCH}

1. Find the writer code path cited in findings "Writer location".
2. Align it with the new trajectories schema per ROLE_POLICY and ID_REGEX.
   Preserve domain meaning — map "workflow-runner" to an equivalent in
   the new shape rather than dropping it.
3. If the workforce package.json pins agent-trajectories to a specific
   version AND the DECISION requires a version bump, update it. Otherwise
   leave the dep alone.
4. Run the workforce test command (check package.json scripts — likely
   \`npm test\` or \`pnpm test\`). Paste the summary.
5. Do NOT git commit — the lead commits.

Exit 0 on clean skip or clean success.
`.trim(),
      verification: { type: "exit_code" },
      retries: 1,
    })

    // ---------- Phase C: build + unit tests in worktree ----------

    .step("build-and-test", {
      type: "deterministic",
      dependsOn: ["impl-trajectories"],
      command: `
set -e
cd ${TRAJ_WORKTREE}
echo "=== npm install (worktree may need linked node_modules) ==="
if [ ! -d node_modules ]; then
  ln -sf ${TRAJ_ROOT}/node_modules ${TRAJ_WORKTREE}/node_modules
fi
echo "=== npm run build ==="
npm run build
echo ""
echo "=== vitest ==="
npx vitest run 2>&1 | tail -40
`.trim(),
      captureOutput: true,
      failOnError: true,
    })

    // ---------- Phase D: real-data E2E gate ----------

    .step("prep-e2e-fixture", {
      type: "deterministic",
      dependsOn: ["build-and-test"],
      command: `
set -e
rm -rf ${E2E_SCRATCH}
mkdir -p ${E2E_SCRATCH}
cp -R ${WORKFORCE_ROOT}/.trajectories ${E2E_SCRATCH}/.trajectories
echo "=== fixture files ==="
find ${E2E_SCRATCH}/.trajectories -type f -name "*.json" | sort
echo ""
echo "=== count ==="
find ${E2E_SCRATCH}/.trajectories -type f -name "*.json" | wc -l
`.trim(),
      captureOutput: true,
      failOnError: true,
    })

    .step("e2e-compact", {
      type: "deterministic",
      dependsOn: ["prep-e2e-fixture"],
      command: `
set -e
# Use a SCRATCH copy of the fixture — cp brought workforce's original
# index.json with it, which would make reconcile look like it did
# nothing (everything appears pre-indexed). Rebuild from just the
# on-disk files so the reconcile summary reflects actual work.
FRESH=${E2E_SCRATCH}-fresh
rm -rf "$FRESH"
mkdir -p "$FRESH/.trajectories/completed"
if ls ${E2E_SCRATCH}/.trajectories/completed/*.json >/dev/null 2>&1; then
  cp ${E2E_SCRATCH}/.trajectories/completed/*.json "$FRESH/.trajectories/completed/" || true
fi
if [ -d ${E2E_SCRATCH}/.trajectories/completed ]; then
  find ${E2E_SCRATCH}/.trajectories/completed -mindepth 2 -name "*.json" -print0 2>/dev/null | while IFS= read -r -d '' f; do
    rel=\${f#${E2E_SCRATCH}/.trajectories/completed/}
    dir=$(dirname "$rel")
    mkdir -p "$FRESH/.trajectories/completed/$dir"
    cp "$f" "$FRESH/.trajectories/completed/$rel"
  done
fi

FILES_ON_DISK=$(find "$FRESH/.trajectories" -type f -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
echo "=== fixture file count: $FILES_ON_DISK ==="

cd "$FRESH"
LOG=$(mktemp)
node ${TRAJ_WORKTREE}/dist/cli/index.js compact --all --dry-run 2>&1 | tee "$LOG"
echo ""
echo "=== GATES ==="

# Gate 1: NO ZodError / "Invalid trajectory" / generic schema-violation text
if grep -Eq "ZodError|Invalid trajectory|validation error" "$LOG"; then
  echo "GATE_FAIL: schema validation errors present in output"
  exit 1
fi

# Gate 2: reconcile's own structured log must show N/N where N equals
# files-on-disk. This is the real signal — compact's own status filter
# only shows \`completed\` trajectories, so the reconcile log is the only
# place that proves every file on disk was successfully read.
RECON=$(grep -Eo "reconciled [0-9]+/[0-9]+" "$LOG" | head -1 || true)
if [ -z "$RECON" ]; then
  echo "GATE_FAIL: reconcile summary log not found — reconcile may not have run"
  exit 1
fi
RECON_ADDED=$(echo "$RECON" | grep -Eo "^reconciled [0-9]+" | grep -Eo "[0-9]+")
RECON_TOTAL=$(echo "$RECON" | grep -Eo "/[0-9]+" | grep -Eo "[0-9]+")
if [ "$RECON_ADDED" != "$RECON_TOTAL" ]; then
  echo "GATE_FAIL: reconcile skipped files — $RECON (check reason counts in output)"
  exit 1
fi
if [ "$RECON_TOTAL" != "$FILES_ON_DISK" ]; then
  echo "GATE_FAIL: reconcile scanned $RECON_TOTAL but disk has $FILES_ON_DISK"
  exit 1
fi

# Gate 3: compact must surface at least one trajectory it can process.
# N may be small because workforce data has mostly status=abandoned;
# that's correct filter behavior. Just assert non-zero.
if grep -q "No trajectories found" "$LOG"; then
  echo "GATE_FAIL: compact reported no trajectories"
  exit 1
fi
if ! grep -Eq "Compacting [0-9]+ trajectories" "$LOG"; then
  echo "GATE_FAIL: no compaction header found"
  exit 1
fi
N=$(grep -Eo "Compacting [0-9]+ trajectories" "$LOG" | grep -Eo "[0-9]+" | head -1)
if [ "$N" -lt 1 ]; then
  echo "GATE_FAIL: compact header present but count is 0"
  exit 1
fi

echo "ALL_GATES_PASSED (reconciled $RECON, compacted $N)"
`.trim(),
      captureOutput: true,
      failOnError: true,
    })

    // ---------- Phase E: commit, push, open PRs ----------

    .step("open-prs", {
      agent: "lead",
      dependsOn: ["e2e-compact", "impl-workforce"],
      task: `
E2E verification passed. Commit in the worktrees, push, open PRs.

E2E output:
{{steps.e2e-compact.output}}

Build/test summary:
{{steps.build-and-test.output}}

Workforce impl result (may be SKIPPED):
{{steps.impl-workforce.output}}

DECISION context:
{{steps.require-decision-file.output}}

Steps (stop on first failure):

1. Trajectories PR — in ${TRAJ_WORKTREE}:
   a. git status — confirm branch is ${TRAJ_BRANCH} with expected modified
      files (schema.ts, id.ts, file.ts, tests)
   b. git add changed src/ and tests/ files by explicit name — no -A
   c. git commit with a HEREDOC message that:
      - Summarizes the schema relaxation per DECISION
      - Calls out the read/write asymmetry fix if VALIDATE_ON_SAVE=yes
      - Lists the new test cases
      - Ends with the standard Claude Opus 4.6 Co-Authored-By trailer
   d. git push -u origin ${TRAJ_BRANCH}
   e. gh pr create with title <70 chars, Summary bullets, and a Test plan
      section including the E2E gate output lines. Capture the PR URL.

2. Workforce PR — ONLY if impl-workforce did NOT print SKIPPED. In
   ${WORKFORCE_WORKTREE}:
   a. git status — confirm branch is ${WORKFORCE_BRANCH}
   b. git add changed files by explicit name
   c. git commit with a clear message + Co-Authored-By trailer
   d. git push -u origin ${WORKFORCE_BRANCH}
   e. gh pr create — reference the trajectories PR URL in the body

3. Print both PR URLs on separate lines, prefixed with "PR: ".
4. Do NOT merge either PR.

Exit 0 on success.
`.trim(),
      verification: { type: "output_contains", value: "PR: https://" },
    })

    .onError("fail-fast")
    .run({
      cwd: TRAJ_ROOT,
      onEvent: (e) => console.log(`[${e.type}]${e.step ? ` ${e.step}` : ""}`),
    });

  console.log("\nImplementation workflow complete:", result.status);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
