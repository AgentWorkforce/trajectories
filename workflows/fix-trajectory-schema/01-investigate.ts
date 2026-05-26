/**
 * 01-investigate.ts
 *
 * Phase 1 of the trajectory-schema comprehensive fix.
 *
 * Produces TWO files on disk and hands control back to the master executor:
 *   - investigation-findings.md — full audit, options, recommendation
 *   - DECISION.md               — auto-picked by the lead (no human gate)
 *
 * The lead synthesizer is responsible for writing both files so the pipeline
 * can chain directly into 02-implement.ts without human intervention. The
 * human checkpoint is the PR review at the end, not the middle of the run.
 *
 * Normally invoked by run-all.sh, but can be run standalone:
 *   agent-relay run workflows/fix-trajectory-schema/01-investigate.ts
 */

import { workflow } from "@agent-relay/sdk/workflows";

const TRAJ_ROOT =
  process.env.TRAJ_ROOT ??
  "/Users/khaliqgant/Projects/AgentWorkforce/trajectories";
const WORKFORCE_ROOT =
  process.env.WORKFORCE_ROOT ??
  "/Users/khaliqgant/Projects/AgentWorkforce/workforce";
const OUTPUT_DIR = `${TRAJ_ROOT}/workflows/fix-trajectory-schema`;
const FINDINGS_PATH = `${OUTPUT_DIR}/investigation-findings.md`;
const DECISION_PATH = `${OUTPUT_DIR}/DECISION.md`;

async function main() {
  const result = await workflow("fix-trajectory-schema-investigate")
    .description(
      "Investigate trajectory schema mismatch between trajectories lib and workforce writers",
    )
    .pattern("dag")
    .channel("wf-fix-traj-schema-investigate")
    .maxConcurrency(4)
    .timeout(1_800_000)

    .agent("lead", {
      cli: "claude",
      role: "Lead architect — synthesizes findings into a design doc",
    })
    .agent("writer-auditor", {
      cli: "codex",
      preset: "worker",
      role: "Audits workforce code for trajectory write paths",
    })
    .agent("schema-auditor", {
      cli: "codex",
      preset: "worker",
      role: "Audits trajectories schema constraints and history",
    })

    // ---------- Phase 1a: parallel data collection ----------

    .step("dump-workforce-data", {
      type: "deterministic",
      command: `
set -e
echo "=== FILE LIST ==="
ls -1 ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed/*.json 2>/dev/null || true
find ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed -mindepth 2 -name "*.json" 2>/dev/null || true
echo ""
echo "=== COUNT ==="
find ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed -name "*.json" -type f | wc -l
echo ""
echo "=== INDEX.JSON ==="
cat ${WORKFORCE_ROOT}/.agentworkforce/trajectories/index.json 2>/dev/null || echo "(missing)"
echo ""
echo "=== UNIQUE TRAJECTORY IDS ==="
find ${WORKFORCE_ROOT}/.agentworkforce/trajectories -name "traj_*.json" -type f -exec basename {} .json \\; | sort -u
echo ""
echo "=== UNIQUE AGENT ROLES ==="
find ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed -name "*.json" -type f -exec grep -h '"role"' {} \\; | sort -u
echo ""
echo "=== UNIQUE SOURCE.SYSTEM VALUES ==="
find ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed -name "*.json" -type f -exec grep -hA1 '"source"' {} \\; | grep '"system"' | sort -u
echo ""
echo "=== STATUS VALUES ==="
find ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed -name "*.json" -type f -exec grep -h '"status"' {} \\; | sort -u | head -20
echo ""
echo "=== SAMPLE FIRST FILE (first 60 lines) ==="
find ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed -name "*.json" -type f | head -1 | xargs head -60
`.trim(),
      captureOutput: true,
      failOnError: false,
    })

    .step("dump-trajectories-schema", {
      type: "deterministic",
      command: `
set -e
echo "=== schema.ts ==="
cat ${TRAJ_ROOT}/src/core/schema.ts
echo ""
echo "=== id.ts ==="
cat ${TRAJ_ROOT}/src/core/id.ts
echo ""
echo "=== types.ts (relevant types only) ==="
cat ${TRAJ_ROOT}/src/core/types.ts
echo ""
echo "=== validateTrajectory callsites ==="
grep -rn "validateTrajectory\\|readTrajectoryFile" ${TRAJ_ROOT}/src --include="*.ts"
echo ""
echo "=== git log on schema.ts (last 10) ==="
git -C ${TRAJ_ROOT} log --oneline -10 -- src/core/schema.ts
echo ""
echo "=== git log on id.ts (last 10) ==="
git -C ${TRAJ_ROOT} log --oneline -10 -- src/core/id.ts
`.trim(),
      captureOutput: true,
      failOnError: false,
    })

    .step("audit-writer", {
      agent: "writer-auditor",
      dependsOn: ["dump-workforce-data"],
      task: `
Find the code in workforce that produces the trajectory JSON files.

Observed data from disk:
{{steps.dump-workforce-data.output}}

Your job:
1. Search ${WORKFORCE_ROOT}/packages for any code that writes to .agentworkforce/trajectories/
   or imports from 'agent-trajectories'. Use grep/rg.
2. Search ${WORKFORCE_ROOT}/node_modules/agent-trajectories/dist for the code
   paths that emit files with role values like "workflow-runner", "specialist",
   "orchestrator" — are these user-supplied roles or produced by the SDK?
3. Identify the exact file(s) and function(s) that construct the Trajectory
   object before calling storage.save().
4. Determine whether the writer:
   (a) bypasses validateTrajectory() entirely
   (b) uses a looser internal type than the zod schema
   (c) lives in workforce source (fixable here)
   (d) lives in an installed package like agent-trajectories or another dep

Output format (plain markdown, no preamble):
### Writer location
- File path(s):
- Function name(s):

### Role values — origin
- Are roles hard-coded? User-supplied? Mapped from persona configs? Cite the line.

### ID generation — origin
- Where is traj_{timestamp}_{hex} generated? Cite the function.

### Classification
- Circle one: (a) bypasses validation / (b) loose internal type / (c) workforce source / (d) external dep

### Recommended source fix
- One paragraph: what minimal writer change aligns with the trajectories schema,
  OR a statement that the schema is wrong and the writer is right.
`.trim(),
      verification: { type: "exit_code" },
    })

    .step("audit-schema", {
      agent: "schema-auditor",
      dependsOn: ["dump-trajectories-schema"],
      task: `
Enumerate every strict enum and regex in the trajectories schema that could
reject real-world data. You have the source already:

{{steps.dump-trajectories-schema.output}}

Your job: produce a complete constraint inventory.

For each constraint, report:
- Field path (e.g., agents[].role, id, chapters[].events[].significance)
- Current constraint (enum values, regex)
- Blast radius: which callers read/write this field
- Risk if relaxed: what guarantees would be lost
- Observed real values that violate the constraint (cross-reference with
  any values you can see from the workforce audit — the data is at
  ${WORKFORCE_ROOT}/.agentworkforce/trajectories/completed)

Also answer:
- Is validateTrajectory called on save() or only on read()? (Look at
  storage/file.ts.) If asymmetric, that's a bug — flag it.
- Has the schema been loosened before? Check git log.

Output format (plain markdown):
### Constraint inventory
| Field | Current | Blast radius | Violated by |
|---|---|---|---|
| ... | ... | ... | ... |

### Read/write asymmetry
- Findings on save() vs read() validation.

### Schema loosening history
- Notable past changes, if any.

### Recommendation
- For each problematic constraint, one line on preferred fix:
  relax-regex | open-string | superset-enum | discriminated-union | leave-as-is.
`.trim(),
      verification: { type: "exit_code" },
    })

    // ---------- Phase 1b: synthesis ----------

    .step("synthesize-findings", {
      agent: "lead",
      dependsOn: ["audit-writer", "audit-schema", "dump-workforce-data"],
      task: `
Produce TWO files on disk — do not echo them to stdout.

File 1: ${FINDINGS_PATH}
File 2: ${DECISION_PATH}

Inputs:

=== Workforce data dump ===
{{steps.dump-workforce-data.output}}

=== Writer audit ===
{{steps.audit-writer.output}}

=== Schema audit ===
{{steps.audit-schema.output}}

--- File 1: investigation-findings.md ---

Required sections (in this order):

1. # Trajectory Schema Fix — Investigation Findings
2. ## Problem statement (3-5 lines, no preamble)
3. ## What the writer produces
   - Exact data shape, cite unique role/status/source values
4. ## Constraint inventory
   - Table from the schema audit
5. ## Read/write asymmetry
   - Does save() validate? Does read() reject? Call the sub-bug out.
6. ## Options
   For each option: name, change set, pros, cons, blast radius.
   Include at minimum:
     - Option A: Relax schema (open-string role + loosened ID regex)
     - Option B: Superset enum for role + typed ID unions
     - Option C: Fix at source (align workforce writer to current schema)
7. ## Recommendation
   - One paragraph. State the pick and why.

--- File 2: DECISION.md ---

The pipeline will read this file directly in 02-implement.ts — use exactly
this format (one key=value per line, no backticks, no extra prose):

SCHEMA_POLICY=<A|B|C|D>
VALIDATE_ON_SAVE=<yes|no>
FIX_WORKFORCE_WRITER=<yes|no>
ID_REGEX=<new regex literal, or "unchanged">
ROLE_POLICY=<one-line description>
STATUS_POLICY=<one-line, or "unchanged">
SOURCE_POLICY=<one-line, or "unchanged">
NOTES=<one-line, optional>

Rules for the auto-decision:
- Pick the option that unblocks the real workforce data with the smallest
  schema blast radius. Bias toward Option A unless the audit surfaced a
  stronger reason.
- If the writer code lives outside workforce's control (e.g., inside the
  installed agent-trajectories package), FIX_WORKFORCE_WRITER=no — fix
  it in trajectories repo only.
- If save() does not currently validate but read() does,
  VALIDATE_ON_SAVE=yes (close the asymmetry).
- Your choice must reflect the EVIDENCE in the audits, not a default.

After writing both files, ls -la them to confirm both exist.
`.trim(),
      verification: { type: "file_exists", value: DECISION_PATH },
    })

    .onError("fail-fast")
    .run({
      cwd: TRAJ_ROOT,
      onEvent: (e) => console.log(`[${e.type}]${e.step ? ` ${e.step}` : ""}`),
    });

  console.log("\nInvestigation complete:", result.status);
  console.log(`Findings: ${FINDINGS_PATH}`);
  console.log(`Decision: ${DECISION_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
