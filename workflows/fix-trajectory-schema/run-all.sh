#!/usr/bin/env bash
#
# run-all.sh — master executor for the trajectory-schema comprehensive fix
#
# Sets up git worktrees for both repos, runs 01-investigate, then
# 02-implement. The lead agent in 01 auto-writes DECISION.md so there's no
# human gate mid-pipeline. The human checkpoint is reviewing the PRs at
# the end.
#
# Worktrees (both are fresh on every run — idempotent):
#   /tmp/wt-traj-schema        branched from fix/reconcile-stale-index
#                              new branch: fix/trajectory-schema-comprehensive
#   /tmp/wt-workforce-writer   branched from workforce's main
#                              new branch: fix/trajectory-writer-align
#
# Env overrides (all optional — sensible defaults):
#   TRAJ_ROOT                base trajectories checkout
#   WORKFORCE_ROOT           base workforce checkout
#   TRAJ_WORKTREE            trajectories worktree path
#   WORKFORCE_WORKTREE       workforce worktree path
#   TRAJ_BASE_BRANCH         branch to worktree off (default: fix/reconcile-stale-index)
#   TRAJ_BRANCH              new branch name in the worktree
#   WORKFORCE_BASE_BRANCH    branch to worktree off (default: main)
#   WORKFORCE_BRANCH         new branch name in the workforce worktree
#   SKIP_INVESTIGATE=1       skip phase 1 (reuse existing findings/DECISION)
#   SKIP_WORKTREES=1         reuse existing worktrees instead of recreating
#
# Usage:
#   ./workflows/fix-trajectory-schema/run-all.sh

set -euo pipefail

# ---- config ---------------------------------------------------------------

TRAJ_ROOT="${TRAJ_ROOT:-/Users/khaliqgant/Projects/AgentWorkforce/trajectories}"
WORKFORCE_ROOT="${WORKFORCE_ROOT:-/Users/khaliqgant/Projects/AgentWorkforce/workforce}"
TRAJ_WORKTREE="${TRAJ_WORKTREE:-/tmp/wt-traj-schema}"
WORKFORCE_WORKTREE="${WORKFORCE_WORKTREE:-/tmp/wt-workforce-writer}"
TRAJ_BASE_BRANCH="${TRAJ_BASE_BRANCH:-fix/reconcile-stale-index}"
TRAJ_BRANCH="${TRAJ_BRANCH:-fix/trajectory-schema-comprehensive}"
WORKFORCE_BASE_BRANCH="${WORKFORCE_BASE_BRANCH:-main}"
WORKFORCE_BRANCH="${WORKFORCE_BRANCH:-fix/trajectory-writer-align}"

WORKFLOW_DIR="${TRAJ_ROOT}/workflows/fix-trajectory-schema"
INVESTIGATE="${WORKFLOW_DIR}/01-investigate.ts"
IMPLEMENT="${WORKFLOW_DIR}/02-implement.ts"

# ---- helpers --------------------------------------------------------------

log() {
  printf '\n\033[1;36m[run-all]\033[0m %s\n' "$*"
}

die() {
  printf '\n\033[1;31m[run-all] FATAL:\033[0m %s\n' "$*" >&2
  exit 1
}

# ---- preflight ------------------------------------------------------------

log "Preflight checks"

command -v agent-relay >/dev/null || die "agent-relay not on PATH"
command -v gh >/dev/null || die "gh (github cli) not on PATH"
[[ -d "$TRAJ_ROOT/.git" ]] || die "TRAJ_ROOT is not a git repo: $TRAJ_ROOT"
[[ -d "$WORKFORCE_ROOT/.git" ]] || die "WORKFORCE_ROOT is not a git repo: $WORKFORCE_ROOT"
[[ -f "$INVESTIGATE" ]] || die "missing: $INVESTIGATE"
[[ -f "$IMPLEMENT" ]] || die "missing: $IMPLEMENT"

# Ensure the trajectories base branch actually exists locally
if ! git -C "$TRAJ_ROOT" show-ref --verify --quiet "refs/heads/${TRAJ_BASE_BRANCH}"; then
  die "TRAJ_BASE_BRANCH=${TRAJ_BASE_BRANCH} does not exist in $TRAJ_ROOT"
fi

# ---- worktree setup -------------------------------------------------------

setup_worktree() {
  local repo="$1" wt="$2" base="$3" branch="$4"

  if [[ "${SKIP_WORKTREES:-0}" == "1" ]]; then
    [[ -d "$wt" ]] || die "SKIP_WORKTREES=1 but $wt does not exist"
    log "reusing worktree $wt"
    return
  fi

  # Tear down any existing worktree at the same path
  if git -C "$repo" worktree list | grep -q "$wt"; then
    log "removing stale worktree at $wt"
    git -C "$repo" worktree remove --force "$wt" || true
  fi
  rm -rf "$wt"

  # Delete the branch if it already exists locally so -b can recreate it
  if git -C "$repo" show-ref --verify --quiet "refs/heads/${branch}"; then
    log "deleting stale local branch $branch in $repo"
    git -C "$repo" branch -D "$branch"
  fi

  log "creating worktree $wt (branch $branch from $base)"
  git -C "$repo" worktree add "$wt" -b "$branch" "$base"
}

setup_worktree "$TRAJ_ROOT" "$TRAJ_WORKTREE" "$TRAJ_BASE_BRANCH" "$TRAJ_BRANCH"
setup_worktree "$WORKFORCE_ROOT" "$WORKFORCE_WORKTREE" "$WORKFORCE_BASE_BRANCH" "$WORKFORCE_BRANCH"

# Link node_modules into the trajectories worktree so build/test work
if [[ ! -e "$TRAJ_WORKTREE/node_modules" && -d "$TRAJ_ROOT/node_modules" ]]; then
  log "symlinking node_modules into $TRAJ_WORKTREE"
  ln -sf "$TRAJ_ROOT/node_modules" "$TRAJ_WORKTREE/node_modules"
fi

# ---- export for downstream workflows --------------------------------------

export TRAJ_ROOT WORKFORCE_ROOT
export TRAJ_WORKTREE WORKFORCE_WORKTREE
export TRAJ_BRANCH WORKFORCE_BRANCH

# ---- phase 1: investigate -------------------------------------------------

if [[ "${SKIP_INVESTIGATE:-0}" == "1" ]]; then
  log "SKIP_INVESTIGATE=1 — reusing existing findings + DECISION"
  [[ -f "$WORKFLOW_DIR/investigation-findings.md" ]] || die "findings missing"
  [[ -f "$WORKFLOW_DIR/DECISION.md" ]] || die "DECISION.md missing"
else
  log "running phase 1: investigate"
  agent-relay run "$INVESTIGATE"
fi

[[ -f "$WORKFLOW_DIR/investigation-findings.md" ]] || die "investigate did not produce findings"
[[ -f "$WORKFLOW_DIR/DECISION.md" ]] || die "investigate did not produce DECISION.md"

log "DECISION.md contents:"
cat "$WORKFLOW_DIR/DECISION.md"

# ---- phase 2: implement ---------------------------------------------------

log "running phase 2: implement"
agent-relay run "$IMPLEMENT"

# ---- done -----------------------------------------------------------------

log "all phases complete"
echo ""
echo "Trajectories worktree: $TRAJ_WORKTREE  (branch $TRAJ_BRANCH)"
echo "Workforce worktree:    $WORKFORCE_WORKTREE  (branch $WORKFORCE_BRANCH)"
echo ""
echo "Worktrees are left in place for inspection. Remove with:"
echo "  git -C $TRAJ_ROOT worktree remove $TRAJ_WORKTREE"
echo "  git -C $WORKFORCE_ROOT worktree remove $WORKFORCE_WORKTREE"
