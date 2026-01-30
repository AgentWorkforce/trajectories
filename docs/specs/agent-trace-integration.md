# Agent Trace Integration Spec

## Design Philosophy

**The user should never think about traces.**

Traces are a *byproduct* of using trajectories, not an additional workflow. If you can use `trail start` and `trail complete`, you get attribution for free.

---

## User Experience

### Before (status quo)

```bash
trail start "Add authentication flow"
# ... agent works ...
trail complete --summary "Added JWT auth" --confidence 0.9
```

Result: trajectory JSON + markdown

### After (with trace integration)

```bash
trail start "Add authentication flow"
# ... agent works ...
trail complete --summary "Added JWT auth" --confidence 0.9
```

Result: trajectory JSON + markdown + **trace record (automatic)**

**Zero new commands. Zero new flags. Zero configuration.**

---

## How It Works

### 1. `trail start` - Snapshot Git State

When a trajectory starts, we silently capture:
- Current git HEAD commit
- Working directory state

```typescript
// Stored internally on trajectory
{
  _trace: {
    startRef: "abc123f",           // git HEAD at start
    startedAt: "2026-01-30T10:00:00Z"
  }
}
```

### 2. Agent Works Normally

The agent writes code, makes commits, modifies files. Nothing changes.

### 3. `trail complete` - Auto-Generate Trace

On completion, we automatically:

1. **Detect all changes** since `startRef`:
   ```bash
   git diff --name-only abc123f..HEAD  # Files changed
   git diff abc123f..HEAD              # Line-level changes
   ```

2. **Generate Agent Trace record**:
   ```json
   {
     "version": "0.1.0",
     "id": "550e8400-e29b-41d4-a716-446655440000",
     "timestamp": "2026-01-30T12:30:00Z",
     "trajectory": "traj_abc123xyz",
     "files": [
       {
         "path": "src/auth/handler.ts",
         "conversations": [{
           "contributor": {
             "type": "ai",
             "model": "anthropic/claude-opus-4-5-20251101"
           },
           "ranges": [
             { "start_line": 1, "end_line": 85, "revision": "def456" }
           ]
         }]
       }
     ]
   }
   ```

3. **Store alongside trajectory**:
   ```
   .trajectories/completed/2026-01/
   ├── traj_abc123xyz.json           # Trajectory
   ├── traj_abc123xyz.trajectory.md  # Markdown export
   └── traj_abc123xyz.trace.json     # Agent Trace record
   ```

---

## Data Model Changes

### Trajectory Type (internal tracking)

```typescript
interface Trajectory {
  // ... existing fields ...

  // Internal trace metadata (not exposed to user)
  _trace?: {
    startRef: string;      // Git commit at trail start
    endRef?: string;       // Git commit at trail complete
    traceId?: string;      // Generated trace record ID
  };
}
```

### New TraceRecord Type

```typescript
// Following agent-trace.dev spec v0.1.0
interface TraceRecord {
  version: "0.1.0";
  id: string;                        // UUID
  timestamp: string;                 // ISO 8601
  trajectory?: string;               // Link back to trajectory ID

  files: TraceFile[];
}

interface TraceFile {
  path: string;                      // Relative from repo root
  conversations: TraceConversation[];
}

interface TraceConversation {
  contributor: {
    type: "human" | "ai" | "mixed" | "unknown";
    model?: string;                  // e.g., "anthropic/claude-opus-4-5-20251101"
  };
  url?: string;                      // Link to trajectory or session
  ranges: TraceRange[];
}

interface TraceRange {
  start_line: number;                // 1-indexed
  end_line: number;
  revision?: string;                 // Git commit SHA
  content_hash?: string;             // murmur3 hash for tracking moves
}
```

---

## CLI Enhancements (Optional, Power Users)

These commands exist for users who *want* to inspect traces, but are never required:

### View trace for a trajectory

```bash
trail show traj_abc123 --trace
```

Output:
```
Trace Record: 550e8400-...
Generated: 2026-01-30T12:30:00Z

Files attributed to AI:
  src/auth/handler.ts        lines 1-85    (new file)
  src/auth/middleware.ts     lines 23-67   (modified)
  src/routes/login.ts        lines 1-42    (new file)

Total: 171 lines across 3 files
```

### Query by file

```bash
trail trace src/auth/handler.ts
```

Output:
```
src/auth/handler.ts attribution:

  Lines 1-85: AI (claude-opus-4-5)
    Trajectory: traj_abc123 "Add authentication flow"
    Date: 2026-01-30
```

### Export trace only

```bash
trail export traj_abc123 --format=trace > auth.trace.json
```

---

## Configuration (Optional)

For teams that want to customize, add to `.trailrc` or environment:

```yaml
# .trailrc (optional)
trace:
  enabled: true                    # Default: true
  includeModel: true               # Include AI model in trace
  storage: "alongside"             # "alongside" | "separate" | "none"
```

Environment variables:
```bash
TRAIL_TRACE_ENABLED=true           # Enable/disable (default: true)
TRAIL_TRACE_MODEL=anthropic/...    # Override model identifier
```

**Default: everything enabled, zero config required.**

---

## Edge Cases

### No git repository

If not in a git repo, traces are silently skipped. Trajectory works normally.

```
⚠ Not a git repository - trace generation skipped
✓ Trajectory completed: traj_abc123
```

### No changes made

If the agent didn't change any files, no trace is generated (nothing to attribute).

### Uncommitted changes

We capture both committed and uncommitted changes. Uncommitted changes use `revision: "working"` to indicate they're not yet committed.

### Agent model detection

Model is detected from (in priority order):
1. `TRAIL_TRACE_MODEL` environment variable
2. `ANTHROPIC_MODEL` or similar env vars
3. Agent name mapping (configurable)
4. Fallback: `"unknown"`

### Multiple agents

If multiple agents participated (tracked in `trajectory.agents[]`), we attribute based on chapter boundaries:
- Changes during Agent A's chapter → attributed to Agent A
- Changes during Agent B's chapter → attributed to Agent B

---

## Implementation Phases

### Phase 1: Core Integration (MVP)
- [ ] Add `_trace` field to trajectory for git state tracking
- [ ] Capture git HEAD on `trail start`
- [ ] Generate trace record on `trail complete`
- [ ] Store trace JSON alongside trajectory
- [ ] Add `--trace` flag to `trail show`

### Phase 2: Query & Export
- [ ] Add `trail trace <file>` command for file-based queries
- [ ] Add trace export format
- [ ] Trace index for fast file→trajectory lookups

### Phase 3: Advanced Features
- [ ] Multi-agent attribution (per-chapter)
- [ ] Content hashing for move detection
- [ ] Integration with external trace stores
- [ ] VS Code extension showing inline attribution

---

## Benefits

### For Developers
- **Zero effort**: Traces happen automatically
- **Better code review**: See exactly what AI generated
- **Debugging**: "Why does this code exist?" → check the trajectory

### For Teams
- **Audit trail**: Know which code is AI-generated
- **Quality gates**: "Flag PRs with >80% AI-generated code for extra review"
- **Learning**: See how AI approaches different problems

### For the Ecosystem
- **Standard format**: Compatible with any agent-trace.dev tooling
- **Interoperability**: Other tools can read/write the same traces
- **Future-proof**: As AI attribution becomes important, you're ready

---

## Example Flow

```bash
$ trail start "Implement rate limiting middleware"
✓ Trajectory started: traj_9f8e7d6c5b4a

# Agent works for a while...

$ trail complete --summary "Added token bucket rate limiter" --confidence 0.85
✓ Trajectory completed: traj_9f8e7d6c5b4a
  Summary: Added token bucket rate limiter
  Confidence: 85%
  Trace: 3 files, 127 lines attributed

$ trail show traj_9f8e7d6c5b4a --trace
Trajectory: traj_9f8e7d6c5b4a
Title: Implement rate limiting middleware
Status: completed
...

AI Attribution:
  src/middleware/rateLimit.ts    lines 1-89   (new)
  src/middleware/index.ts        lines 12-24  (modified)
  src/config/limits.ts           lines 1-14   (new)

Total: 127 lines across 3 files
```

---

## Summary

| Aspect | Design Choice |
|--------|--------------|
| **Activation** | Automatic (opt-out, not opt-in) |
| **New commands** | None required (optional power-user commands) |
| **Configuration** | Zero required (optional overrides) |
| **Storage** | Alongside trajectory files |
| **Format** | agent-trace.dev v0.1.0 compliant |
| **Failure mode** | Silent skip (never breaks trajectories) |

**The trajectory is the interface. The trace is the implementation detail.**
