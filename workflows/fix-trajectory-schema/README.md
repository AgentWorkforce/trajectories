# fix-trajectory-schema workflow

Comprehensive, end-to-end fix for the `trail compact --all` → "No trajectories
found" bug in `workforce/`. Two layers:

1. Stale `index.json` (addressed by `FileStorage.reconcileIndex()` on branch
   `fix/reconcile-stale-index`).
2. Schema mismatch — workforce writes `role` values and ID shapes the
   trajectories zod schema rejects on read. `save()` doesn't validate,
   `readTrajectoryFile()` does (asymmetry).

## Running it

One command. Master executor handles worktrees, chaining both workflows,
and clean-up instructions.

```bash
./workflows/fix-trajectory-schema/run-all.sh
```

That script:
1. Preflight-checks `agent-relay`, `gh`, and base branches
2. Creates two fresh git worktrees (idempotent — recreates on each run):
   - `/tmp/wt-traj-schema` off `fix/reconcile-stale-index`, new branch
     `fix/trajectory-schema-comprehensive`
   - `/tmp/wt-workforce-writer` off workforce `main`, new branch
     `fix/trajectory-writer-align`
3. Symlinks `node_modules` into the trajectories worktree
4. Runs `01-investigate.ts` — Claude lead writes both
   `investigation-findings.md` AND `DECISION.md` automatically
5. Runs `02-implement.ts` — codex workers implement in the worktrees,
   deterministic E2E gate against a copy of real workforce data, Claude
   lead commits, pushes, and opens both PRs
6. Leaves worktrees in place for inspection and prints the cleanup commands

## Files in this directory

| File | Purpose |
|---|---|
| `run-all.sh` | Master executor. One command kicks off the whole thing. |
| `01-investigate.ts` | Phase 1: 3-wave investigation DAG. Writes findings + DECISION. |
| `02-implement.ts` | Phase 2: 5-wave implementation DAG with E2E gate + PR open. |
| `investigation-findings.md` | Produced by phase 1 (not checked in). |
| `DECISION.md` | Produced by phase 1 (not checked in). Key=value format. |

## DECISION.md format (auto-generated)

```
SCHEMA_POLICY=A|B|C|D
VALIDATE_ON_SAVE=yes|no
FIX_WORKFORCE_WRITER=yes|no
ID_REGEX=<new regex literal, or "unchanged">
ROLE_POLICY=<one-line description>
STATUS_POLICY=<one-line, or "unchanged">
SOURCE_POLICY=<one-line, or "unchanged">
NOTES=<one-line, optional>
```

The lead agent picks the option with the smallest blast radius that
unblocks the real workforce data. You see the decision when the master
script prints the file contents before phase 2.

## Env overrides

All optional — defaults work for this machine.

| Var | Default |
|---|---|
| `TRAJ_ROOT` | `/Users/khaliqgant/Projects/AgentWorkforce/trajectories` |
| `WORKFORCE_ROOT` | `/Users/khaliqgant/Projects/AgentWorkforce/workforce` |
| `TRAJ_WORKTREE` | `/tmp/wt-traj-schema` |
| `WORKFORCE_WORKTREE` | `/tmp/wt-workforce-writer` |
| `TRAJ_BASE_BRANCH` | `fix/reconcile-stale-index` |
| `TRAJ_BRANCH` | `fix/trajectory-schema-comprehensive` |
| `WORKFORCE_BASE_BRANCH` | `main` |
| `WORKFORCE_BRANCH` | `fix/trajectory-writer-align` |
| `SKIP_INVESTIGATE=1` | reuse existing findings + DECISION from disk |
| `SKIP_WORKTREES=1` | reuse existing worktrees instead of recreating |

`SKIP_INVESTIGATE=1` is useful when iterating on `02-implement.ts` without
paying for another investigation pass.

## E2E gate (the real completion signal)

Phase 2 wave 4 is a deterministic shell step that:
1. Copies the actual `workforce/.trajectories/` to `/tmp/traj-schema-e2e/`
2. Runs the worktree-built CLI: `node <worktree>/dist/cli/index.js compact --all --dry-run`
3. Gates on 3 hard signals:
   - No "No trajectories found" string
   - No `ZodError` or "Invalid trajectory" in output
   - `Compacting N trajectories` header with N ≥ 11

If any gate fails, the PR step is never reached and the run exits non-zero.

## Worktree lifecycle

Worktrees are idempotent — every `run-all.sh` invocation tears down and
recreates them. They're NOT auto-removed after success, so you can inspect
the diff, check the branches, and manually clean up when you're ready:

```bash
git -C /Users/khaliqgant/Projects/AgentWorkforce/trajectories \
    worktree remove /tmp/wt-traj-schema
git -C /Users/khaliqgant/Projects/AgentWorkforce/workforce \
    worktree remove /tmp/wt-workforce-writer
```
