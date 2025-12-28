# Architecture: Agent Trajectories Core

## Overview

Agent Trajectories is a system for capturing, storing, and querying the complete "train of thought" of agent work. This document describes the core architecture for v1.

### Goals

1. **Zero-config start**: Works immediately with `npx agent-trajectories`
2. **Progressive enhancement**: File → SQLite → Postgres as needs grow
3. **Platform agnostic**: Works with any task system or coding tool
4. **Human readable**: All artifacts are inspectable without special tools

### Non-Goals (v1)

- Real-time collaboration (future)
- Cloud sync (future)
- MCP server (v1.1)
- Advanced search/semantic similarity (future)

---

## Component Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT TRAJECTORIES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           CLI LAYER                                   │   │
│  │  src/cli/                                                             │   │
│  │  ├── index.ts          Entry point, Commander setup                   │   │
│  │  ├── runner.ts         Command execution with error handling          │   │
│  │  └── commands/                                                        │   │
│  │      ├── start.ts      traj start                                     │   │
│  │      ├── status.ts     traj status                                    │   │
│  │      ├── complete.ts   traj complete                                  │   │
│  │      ├── decision.ts   traj decision                                  │   │
│  │      ├── chapter.ts    traj chapter                                   │   │
│  │      ├── list.ts       traj list                                      │   │
│  │      ├── show.ts       traj show                                      │   │
│  │      ├── search.ts     traj search                                    │   │
│  │      └── export.ts     traj export                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           CORE LAYER                                  │   │
│  │  src/core/                                                            │   │
│  │  ├── trajectory.ts     Trajectory operations (create, update, etc)    │   │
│  │  ├── schema.ts         Zod schemas for validation                     │   │
│  │  ├── types.ts          TypeScript type definitions                    │   │
│  │  └── id.ts             ID generation utilities                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                         │
│                    ▼               ▼               ▼                         │
│  ┌─────────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │    STORAGE LAYER    │  │  EXPORT LAYER   │  │    CAPTURE LAYER       │  │
│  │  src/storage/       │  │  src/export/    │  │  src/capture/          │  │
│  │  ├── interface.ts   │  │  ├── markdown   │  │  ├── hooks.ts (v1.1)   │  │
│  │  ├── file.ts        │  │  ├── json.ts    │  │  └── parser.ts         │  │
│  │  └── index.ts       │  │  ├── timeline   │  │                        │  │
│  │                     │  │  └── pr-summary │  │                        │  │
│  └─────────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### CLI Layer (`src/cli/`)
- Parse command-line arguments using Commander
- Interactive prompts using Clack
- Format output for terminal display
- Handle errors and provide helpful messages
- **No business logic** - delegates to Core layer

#### Core Layer (`src/core/`)
- Trajectory lifecycle management
- Input validation using Zod schemas
- ID generation
- Pure functions where possible (immutable trajectory updates)
- **No I/O** - delegates to Storage layer

#### Storage Layer (`src/storage/`)
- Abstract storage interface
- File system implementation (v1 default)
- SQLite implementation (v1 optional)
- Index maintenance
- **Single responsibility** - only handles persistence

#### Export Layer (`src/export/`)
- Transform trajectories to various output formats
- Markdown (human-readable documentation)
- JSON (programmatic access)
- Timeline (chronological view)
- PR Summary (concise for pull requests)
- **Pure functions** - no side effects

#### Capture Layer (`src/capture/`)
- Parse `[[TRAJECTORY:*]]` blocks from agent output
- Claude Code hooks integration (v1.1)
- Event stream processing
- **Deferred to v1.1** for hooks, v1 has manual capture only

---

## Data Flow

### Creating a Trajectory

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   CLI   │────▶│    Core     │────▶│   Storage    │────▶│  .trajecto- │
│         │     │             │     │              │     │   ries/     │
│ traj    │     │ createTra-  │     │ save()       │     │             │
│ start   │     │ jectory()   │     │              │     │ active/     │
│ "title" │     │             │     │              │     │ traj_x.json │
└─────────┘     └─────────────┘     └──────────────┘     └─────────────┘
     │                │                    │                    │
     │                │                    │                    │
     ▼                ▼                    ▼                    ▼
  Parse           Validate             Write to             JSON file
  args            + create             file system          created
                  trajectory
```

### Recording a Decision

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     CLI     │────▶│    Core      │────▶│   Storage    │────▶│    File      │
│             │     │              │     │              │     │              │
│ traj        │     │ getActive()  │     │ getActive()  │     │ Read active  │
│ decision    │     │              │     │              │     │ trajectory   │
│ "Chose A"   │     │ addDecision()│     │ save()       │     │              │
│ --reasoning │     │              │     │              │     │ Write        │
│ "Because"   │     │              │     │              │     │ updated      │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Completing a Trajectory

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     CLI     │────▶│    Core      │────▶│   Storage    │────▶│    Files     │
│             │     │              │     │              │     │              │
│ traj        │     │ getActive()  │     │ getActive()  │     │ Move from    │
│ complete    │     │              │     │              │     │ active/ to   │
│ --summary   │     │ complete-    │     │ save()       │     │ completed/   │
│ "Done"      │     │ Trajectory() │     │              │     │              │
│             │     │              │     │              │     │ Generate .md │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Export    │
                    │              │
                    │ exportTo-    │
                    │ Markdown()   │
                    └──────────────┘
```

---

## Technical Decisions

### 1. Immutable Trajectory Updates

**Decision**: Core functions return new trajectory objects instead of mutating.

**Rationale**:
- Easier to reason about state changes
- Enables undo/history if needed later
- Prevents bugs from shared mutable state
- Aligns with functional programming best practices

**Example**:
```typescript
// ✅ Good - returns new trajectory
const updated = addEvent(trajectory, event);

// ❌ Bad - mutates in place
trajectory.chapters[0].events.push(event);
```

### 2. File-First Storage

**Decision**: Default to file system storage, not SQLite.

**Rationale**:
- Zero dependencies for basic usage
- Human-readable without tools
- Git-friendly (version with code)
- Searchable with grep/ripgrep
- SQLite can be added as optional upgrade

**Trade-off**: No full-text search in basic mode (acceptable for v1).

### 3. JSON + Markdown Dual Format

**Decision**: Store as JSON, generate Markdown on complete.

**Rationale**:
- JSON is the source of truth (programmatic access)
- Markdown is for humans (readable in GitHub, editors)
- Generation is cheap, storage is cheap
- Avoids parsing Markdown to extract data

### 4. Single Active Trajectory

**Decision**: Only one trajectory can be active at a time per project.

**Rationale**:
- Simpler mental model
- Avoids "which trajectory am I in?" confusion
- Matches typical workflow (one task at a time)
- Can be relaxed in future if needed

### 5. ID Format: `traj_` + nanoid

**Decision**: IDs are `traj_` prefix + 12 character nanoid.

**Rationale**:
- Prefix makes IDs self-describing
- nanoid is URL-safe, compact, and collision-resistant
- 12 chars = ~2 billion unique IDs before 1% collision chance
- Example: `traj_v1stahnzwmo`

---

## Error Handling

### User-Facing Errors

All errors thrown to CLI should be user-friendly:

```typescript
class TrajectoryError extends Error {
  constructor(
    message: string,          // Human-readable message
    public code: string,      // Machine-readable code (e.g., "NO_ACTIVE_TRAJECTORY")
    public suggestion?: string // How to fix it
  ) {
    super(message);
  }
}

// Example usage
throw new TrajectoryError(
  "No active trajectory",
  "NO_ACTIVE_TRAJECTORY",
  "Start one with: traj start \"Task description\""
);
```

### Error Codes

| Code | Description |
|------|-------------|
| `NO_ACTIVE_TRAJECTORY` | Operation requires active trajectory |
| `TRAJECTORY_ALREADY_ACTIVE` | Cannot start when one is active |
| `TRAJECTORY_NOT_FOUND` | Specified trajectory ID doesn't exist |
| `TRAJECTORY_ALREADY_COMPLETED` | Cannot modify completed trajectory |
| `VALIDATION_ERROR` | Input failed validation |
| `STORAGE_ERROR` | File system or database error |

---

## Security Considerations

### Credential Sanitization

Before storing trajectory events, sanitize potential secrets:

```typescript
const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|token|secret|password|credential)[:=]\s*['"]?[\w-]+/gi,
  /Bearer\s+[\w-]+/gi,
  /-----BEGIN.*PRIVATE KEY-----/gi,
];

function sanitizeContent(content: string): string {
  let sanitized = content;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}
```

### File Permissions

Trajectory files should be created with restrictive permissions:
- Directory: `0700` (owner only)
- Files: `0600` (owner read/write)

### .gitignore Recommendation

Recommend users add to `.gitignore`:
```
.trajectories/active/    # Don't commit in-progress work
.trajectories/**/*.env   # Any env files
```

---

## Performance Considerations

### Index for Fast Lookups

Maintain `index.json` for quick listing without reading all files:

```json
{
  "version": 1,
  "lastUpdated": "2024-01-15T10:00:00Z",
  "trajectories": {
    "traj_abc123": {
      "title": "Implement auth",
      "status": "completed",
      "startedAt": "2024-01-15T08:00:00Z",
      "completedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Lazy Loading

Only load full trajectory data when needed:
- `list` command reads only index
- `show` command loads full trajectory
- `search` may need to load all (acceptable for v1, optimize later with SQLite)

### File Size Limits

Warn users if trajectory exceeds reasonable size:
- Soft limit: 1MB (show warning)
- Hard limit: 10MB (refuse to save, suggest archiving)

---

## Directory Structure

```
.trajectories/
├── index.json              # Quick lookup index
├── active/                 # In-progress trajectories
│   └── traj_abc123.json
├── completed/              # Finished trajectories
│   └── 2024-01/            # Organized by month
│       ├── traj_def456.json
│       └── traj_def456.md  # Auto-generated markdown
└── .gitignore              # Ignore active/, keep completed/
```

---

## Testing Strategy

### Unit Tests
- Core functions (pure, no I/O)
- Validation schemas
- ID generation

### Integration Tests
- Storage operations (with temp directories)
- CLI commands (subprocess execution)

### Test Fixtures
- Sample trajectories in `tests/fixtures/`
- Both valid and invalid examples

---

## Future Considerations

### v1.1: Claude Code Hooks
- `onSessionStart`: Inject active trajectory context
- `onToolCall`: Auto-capture tool usage
- `onSessionEnd`: Prompt for retrospective

### v1.2: SQLite Storage
- Full-text search with FTS5
- Faster queries for large trajectory counts
- Migration tool from file storage

### v2: Workspace Features
- Pattern extraction from trajectories
- Decision log aggregation
- Cross-trajectory search

---

## API Surface (Public Exports)

```typescript
// Core
export { createTrajectory, addChapter, addEvent, addDecision, completeTrajectory, abandonTrajectory } from './core/trajectory';
export { validateTrajectory } from './core/schema';
export type { Trajectory, Chapter, TrajectoryEvent, Decision, Retrospective } from './core/types';

// Storage
export { FileStorage } from './storage/file';
export type { StorageAdapter, TrajectoryQuery, TrajectorySummary } from './storage/interface';

// Export
export { exportToMarkdown } from './export/markdown';
export { exportToJSON } from './export/json';
export { exportToTimeline } from './export/timeline';
export { exportToPRSummary } from './export/pr-summary';
```

---

## Appendix: Sequence Diagram - Full Workflow

```
┌─────┐          ┌────────┐          ┌─────────┐          ┌───────────┐
│User │          │  CLI   │          │  Core   │          │  Storage  │
└──┬──┘          └───┬────┘          └────┬────┘          └─────┬─────┘
   │                 │                    │                     │
   │ traj start      │                    │                     │
   │ "Add auth"      │                    │                     │
   │────────────────▶│                    │                     │
   │                 │ createTrajectory() │                     │
   │                 │───────────────────▶│                     │
   │                 │                    │ validate input      │
   │                 │                    │──────┐              │
   │                 │                    │      │              │
   │                 │                    │◀─────┘              │
   │                 │                    │ save(trajectory)    │
   │                 │                    │────────────────────▶│
   │                 │                    │                     │ write file
   │                 │                    │                     │────┐
   │                 │                    │                     │    │
   │                 │                    │                     │◀───┘
   │                 │                    │       ok            │
   │                 │                    │◀────────────────────│
   │                 │   trajectory       │                     │
   │                 │◀───────────────────│                     │
   │ ✓ Started       │                    │                     │
   │◀────────────────│                    │                     │
   │                 │                    │                     │
   │ traj decision   │                    │                     │
   │ "Chose JWT"     │                    │                     │
   │────────────────▶│                    │                     │
   │                 │ getActive()        │                     │
   │                 │────────────────────────────────────────▶│
   │                 │                    │       trajectory    │
   │                 │◀────────────────────────────────────────│
   │                 │ addDecision()      │                     │
   │                 │───────────────────▶│                     │
   │                 │                    │ save(updated)       │
   │                 │                    │────────────────────▶│
   │ ✓ Recorded      │                    │                     │
   │◀────────────────│                    │                     │
   │                 │                    │                     │
   │ traj complete   │                    │                     │
   │ --summary "Done"│                    │                     │
   │────────────────▶│                    │                     │
   │                 │ getActive()        │                     │
   │                 │────────────────────────────────────────▶│
   │                 │ completeTrajectory()                     │
   │                 │───────────────────▶│                     │
   │                 │                    │ save(completed)     │
   │                 │                    │────────────────────▶│
   │                 │                    │                     │ move to
   │                 │                    │                     │ completed/
   │                 │                    │                     │ + gen .md
   │ ✓ Completed     │                    │                     │
   │◀────────────────│                    │                     │
   │                 │                    │                     │
```
