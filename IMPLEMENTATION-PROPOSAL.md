# Implementation Proposal: Agent Trajectories

This document outlines implementation options, trade-offs, and recommendations for building the agent-trajectories system.

---

## Table of Contents

1. [User Workflow](#user-workflow)
2. [Language Recommendation](#language-recommendation)
3. [Language & Runtime Options](#language--runtime-options)
4. [Code Structure](#code-structure)
5. [Storage Layer](#storage-layer)
6. [CLI Framework](#cli-framework)
7. [Integration Architecture](#integration-architecture)
8. [Distribution & Packaging](#distribution--packaging)
9. [Testing Strategy](#testing-strategy)
10. [Recommendations](#recommendations)

---

## User Workflow

What does using agent-trajectories look like day-to-day?

### Workflow 1: Solo Developer with Claude Code

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SOLO DEV WORKFLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │ 1. START     │  User begins work on a feature
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  $ traj start "Add user authentication"                              │
  │  ✓ Trajectory started: traj_a1b2c3                                   │
  │                                                                       │
  │  OR (with Claude Code hooks installed):                               │
  │  Claude detects new work → auto-prompts "What are you working on?"   │
  └──────────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │ 2. WORK      │  User works with Claude Code (or any tool)
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  Claude Code session:                                                 │
  │  > "Implement JWT auth with refresh tokens"                          │
  │                                                                       │
  │  [Hook auto-captures: tool calls, file changes, timestamps]          │
  │                                                                       │
  │  Claude outputs (explicitly or prompted):                             │
  │  [[TRAJECTORY:decision]]                                              │
  │  { "question": "Auth strategy",                                       │
  │    "chosen": "JWT with refresh tokens",                               │
  │    "alternatives": ["sessions", "OAuth only"],                        │
  │    "reasoning": "Stateless for horizontal scaling" }                  │
  │  [[/TRAJECTORY]]                                                      │
  └──────────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │ 3. COMPLETE  │  User finishes the task
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  $ traj complete                                                      │
  │                                                                       │
  │  ┌─ Retrospective ──────────────────────────────────────────────┐    │
  │  │ Summary: Implemented JWT auth with refresh token rotation     │    │
  │  │ Challenges: Existing UserContext types were wrong             │    │
  │  │ Confidence: 0.85                                              │    │
  │  │ Would do differently: Check types earlier                     │    │
  │  └───────────────────────────────────────────────────────────────┘    │
  │                                                                       │
  │  ✓ Trajectory completed                                               │
  │  ✓ Exported to .trajectories/traj_a1b2c3.json                        │
  │  ✓ Summary written to .trajectories/traj_a1b2c3.md                   │
  └──────────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │ 4. USE       │  Later: review, debug, learn
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  # In PR description (auto-generated):                                │
  │  ## Trajectory Summary                                                │
  │  - **Approach:** JWT with refresh tokens for stateless scaling        │
  │  - **Key decisions:** 3 recorded                                      │
  │  - **Confidence:** 85%                                                │
  │  - [Full trajectory](./trajectories/traj_a1b2c3.md)                  │
  │                                                                       │
  │  # Months later, debugging:                                           │
  │  $ traj search "refresh token"                                        │
  │  Found 1 trajectory:                                                  │
  │    traj_a1b2c3: "Add user authentication" (2024-01-15)               │
  │                                                                       │
  │  $ traj show traj_a1b2c3 --decisions                                  │
  │  Decision 1: JWT over sessions (stateless scaling)                    │
  │  Decision 2: HttpOnly cookies (XSS protection)                        │
  │  Decision 3: 15min access / 7day refresh (security balance)          │
  └──────────────────────────────────────────────────────────────────────┘
```

### Workflow 2: Team with Multiple Agents

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TEAM WORKFLOW                                        │
└─────────────────────────────────────────────────────────────────────────┘

  AGENT ALICE                           AGENT BOB
  ────────────                          ─────────
       │                                     │
       ▼                                     │
  ┌────────────────┐                         │
  │ traj start     │                         │
  │ "Auth module"  │                         │
  └───────┬────────┘                         │
          │                                  │
          ▼                                  │
  ┌────────────────┐                         │
  │ Working...     │                         │
  │ Records:       │                         │
  │ - decisions    │                         │
  │ - tool calls   │                         │
  └───────┬────────┘                         │
          │                                  │
          │  ┌───────────────────────────┐   │
          └─▶│ @Bob: Can you review the  │───┘
             │ token rotation logic?     │
             └───────────────────────────┘
                           │
                           ▼
                    ┌────────────────┐
                    │ Bob joins      │
                    │ trajectory     │
                    │ (new chapter)  │
                    └───────┬────────┘
                            │
                            ▼
                    ┌────────────────┐
                    │ Reviews, adds  │
                    │ own decisions  │
                    └───────┬────────┘
                            │
       ┌────────────────────┘
       ▼
  ┌────────────────┐
  │ traj complete  │
  │                │
  │ Trajectory:    │
  │ - 2 agents     │
  │ - 3 chapters   │
  │ - 5 decisions  │
  └────────────────┘
```

### Workflow 3: Learning from Past Trajectories

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LEARNING WORKFLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

  NEW TASK: "Add rate limiting to API"

  ┌─────────────────────────────────────────────────────────────────────┐
  │  Agent (or human) queries workspace:                                 │
  │                                                                      │
  │  $ traj suggest "rate limiting"                                      │
  │                                                                      │
  │  ┌─ Relevant Trajectories ─────────────────────────────────────────┐│
  │  │ traj_x1: "Auth rate limiting" (90% match)                       ││
  │  │   └─ Gotcha: Redis connection pooling was tricky                ││
  │  │ traj_y2: "API throttling" (75% match)                           ││
  │  └─────────────────────────────────────────────────────────────────┘│
  │                                                                      │
  │  ┌─ Related Decisions ─────────────────────────────────────────────┐│
  │  │ "Use Redis for distributed state" (from traj_x1)                ││
  │  │ "Sliding window over fixed window" (from traj_y2)               ││
  │  └─────────────────────────────────────────────────────────────────┘│
  │                                                                      │
  │  ┌─ Suggested Patterns ────────────────────────────────────────────┐│
  │  │ middleware-pattern.md: "How we add cross-cutting concerns"      ││
  │  └─────────────────────────────────────────────────────────────────┘│
  └─────────────────────────────────────────────────────────────────────┘

  Agent now has context BEFORE writing a single line of code.
```

### CLI Command Summary

```bash
# Lifecycle
traj start "Task description"       # Start a new trajectory
traj status                         # Show active trajectory
traj complete                       # Complete with retrospective
traj abandon                        # Abandon without completing

# Recording
traj decision "What" --reasoning "Why" --alternatives "A,B,C"
traj chapter "New phase"            # Start a new chapter
traj note "Observation"             # Add a note

# Querying
traj list                           # List recent trajectories
traj show <id>                      # Show trajectory details
traj search "query"                 # Full-text search
traj suggest "task description"     # Get suggestions for new work

# Export
traj export <id> --format md        # Export as markdown
traj export <id> --format json      # Export as JSON
traj export <id> --format timeline  # Export as timeline view
```

---

## Language Recommendation

**Recommendation: TypeScript**

After weighing all factors, TypeScript is the clear choice for agent-trajectories:

### Why TypeScript Wins

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WHY TYPESCRIPT                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. ECOSYSTEM ALIGNMENT                                                  │
│     ├── Claude Code: TypeScript                                          │
│     ├── agent-relay: TypeScript                                          │
│     ├── claude-mem: TypeScript                                           │
│     ├── Most MCP servers: TypeScript                                     │
│     └── One language across the entire stack                             │
│                                                                          │
│  2. CONTRIBUTOR POOL                                                     │
│     ├── TypeScript: ~15M developers                                      │
│     ├── Rust: ~3M developers                                             │
│     ├── Go: ~4M developers                                               │
│     └── Lower barrier = more contributions                               │
│                                                                          │
│  3. JSON-NATIVE                                                          │
│     ├── Trajectories ARE JSON                                            │
│     ├── No serialization friction                                        │
│     ├── Type inference from schemas                                      │
│     └── Zod for runtime validation                                       │
│                                                                          │
│  4. DEVELOPMENT VELOCITY                                                 │
│     ├── Faster iteration                                                 │
│     ├── Hot reload during development                                    │
│     ├── Rich IDE support                                                 │
│     └── Ship v1 faster                                                   │
│                                                                          │
│  5. INTEGRATION SIMPLICITY                                               │
│     ├── Claude Code hooks: direct integration                            │
│     ├── MCP server: same runtime                                         │
│     ├── agent-relay: import directly                                     │
│     └── No FFI boundaries                                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Addressing TypeScript's Weaknesses

| Concern | Mitigation |
|---------|------------|
| **Startup time (~150ms)** | Acceptable for trajectory operations (not hot path). For CI/scripting, batch commands. Future: Bun binary. |
| **Dependency bloat** | Strict dependency policy. Core has <10 deps. Use `bundleDependencies`. |
| **Runtime type safety** | Zod for all external input. Schema validation on read/write. |
| **Distribution** | NPM primary. Optional: pkg/bun binaries for standalone. |

### The TypeScript Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     RECOMMENDED STACK                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RUNTIME         Node.js 20+ (LTS)                                       │
│                  └── Future: Bun for faster startup                      │
│                                                                          │
│  LANGUAGE        TypeScript 5.3+                                         │
│                  └── Strict mode, ESM-only                               │
│                                                                          │
│  VALIDATION      Zod                                                     │
│                  └── Runtime types from schema                           │
│                                                                          │
│  CLI             Commander + Clack                                       │
│                  └── Simple parsing + beautiful prompts                  │
│                                                                          │
│  STORAGE         better-sqlite3 (default)                                │
│                  └── File fallback for zero-dep mode                     │
│                                                                          │
│  TESTING         Vitest                                                  │
│                  └── Fast, TypeScript-native                             │
│                                                                          │
│  BUILD           tsup                                                    │
│                  └── Zero-config bundling                                │
│                                                                          │
│  FORMATTING      Biome                                                   │
│                  └── Fast, replaces ESLint + Prettier                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Minimal Dependencies

```json
{
  "dependencies": {
    "commander": "^12.0.0",        // CLI parsing
    "@clack/prompts": "^0.7.0",    // Interactive prompts
    "better-sqlite3": "^11.0.0",   // Storage (optional)
    "zod": "^3.23.0"               // Validation
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "tsup": "^8.0.0",
    "@biomejs/biome": "^1.8.0"
  }
}
```

**Total production deps: 4** (and SQLite is optional)

---

## Language & Runtime Options

### Option A: TypeScript + Node.js

**Pros:**
- Ecosystem alignment with Claude Code, agent-relay, and most AI tooling
- Excellent async/await patterns for I/O-heavy operations
- Strong typing catches errors at compile time
- NPM distribution is well-understood
- Easy JSON handling (trajectories are JSON-native)
- Same language for CLI and potential web dashboard

**Cons:**
- Node.js startup time (~100-200ms) noticeable for frequent CLI calls
- Dependency bloat if not careful
- Runtime type checking requires additional tooling (Zod, io-ts)

**Best for:** Maximum ecosystem compatibility, rapid development

### Option B: Rust

**Pros:**
- Near-instant startup time (<10ms)
- Single binary distribution, no runtime dependencies
- Memory safety without garbage collection
- Excellent CLI libraries (clap, dialoguer)
- Strong typing with algebraic data types
- Cross-compilation built-in

**Cons:**
- Steeper learning curve
- Slower iteration during development
- JSON handling more verbose than JS/TS
- Smaller pool of contributors
- Async Rust has complexity (tokio runtime)

**Best for:** Performance-critical, wide distribution, long-term maintenance

### Option C: Go

**Pros:**
- Fast startup, single binary
- Simple concurrency model
- Good CLI libraries (cobra, bubbletea)
- Easy cross-compilation
- Readable by most developers

**Cons:**
- Weaker type system (no generics until recently, no sum types)
- Error handling verbosity
- Less ecosystem overlap with AI/agent tooling
- JSON struct tags are tedious

**Best for:** Simple, reliable tooling with broad compatibility

### Option D: Hybrid (Rust core + TypeScript bindings)

**Pros:**
- Performance-critical paths in Rust
- TypeScript for integrations and scripting
- Best of both worlds

**Cons:**
- Build complexity (napi-rs, wasm-pack)
- Two codebases to maintain
- FFI boundary bugs

**Best for:** When performance AND ecosystem integration are both critical

### Language Comparison Matrix

| Factor | TypeScript | Rust | Go | Hybrid |
|--------|------------|------|-----|--------|
| Startup time | ~150ms | <10ms | <20ms | <20ms |
| Dev velocity | ★★★★★ | ★★☆☆☆ | ★★★★☆ | ★★☆☆☆ |
| Type safety | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★★★ |
| Distribution | ★★★☆☆ | ★★★★★ | ★★★★★ | ★★★★☆ |
| Ecosystem fit | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ |
| Contributor pool | ★★★★★ | ★★★☆☆ | ★★★★☆ | ★★★☆☆ |

---

## Code Structure

### Option A: Monorepo with Packages

```
agent-trajectories/
├── packages/
│   ├── core/                 # Types, schemas, validation
│   │   ├── src/
│   │   │   ├── types.ts      # Trajectory, Chapter, Event types
│   │   │   ├── schema.ts     # JSON Schema + Zod validation
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── storage/              # Storage adapters
│   │   ├── src/
│   │   │   ├── interface.ts  # StorageAdapter interface
│   │   │   ├── file.ts       # File system storage
│   │   │   ├── sqlite.ts     # SQLite storage
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── capture/              # Event capture mechanisms
│   │   ├── src/
│   │   │   ├── hooks.ts      # Claude Code hooks
│   │   │   ├── parser.ts     # [[TRAJECTORY:*]] block parser
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── adapters/             # Task system adapters
│   │   ├── src/
│   │   │   ├── interface.ts  # TaskSourceAdapter interface
│   │   │   ├── beads.ts
│   │   │   ├── github.ts
│   │   │   ├── linear.ts
│   │   │   └── plain.ts
│   │   └── package.json
│   │
│   ├── workspace/            # Knowledge extraction
│   │   ├── src/
│   │   │   ├── decisions.ts
│   │   │   ├── patterns.ts
│   │   │   ├── extract.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── export/               # Export formats
│   │   ├── src/
│   │   │   ├── markdown.ts
│   │   │   ├── timeline.ts
│   │   │   ├── json.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── cli/                  # Command-line interface
│       ├── src/
│       │   ├── commands/
│       │   │   ├── start.ts
│       │   │   ├── status.ts
│       │   │   ├── complete.ts
│       │   │   ├── export.ts
│       │   │   └── search.ts
│       │   └── index.ts
│       └── package.json
│
├── pnpm-workspace.yaml
├── tsconfig.json
└── package.json
```

**Pros:**
- Clear separation of concerns
- Independent versioning possible
- Tree-shaking friendly
- Easy to test in isolation

**Cons:**
- Build complexity (need turborepo/nx/pnpm workspaces)
- More boilerplate
- Dependency management between packages

### Option B: Single Package with Modules

```
agent-trajectories/
├── src/
│   ├── core/
│   │   ├── types.ts
│   │   ├── schema.ts
│   │   └── index.ts
│   │
│   ├── storage/
│   │   ├── interface.ts
│   │   ├── file.ts
│   │   ├── sqlite.ts
│   │   └── index.ts
│   │
│   ├── capture/
│   │   ├── hooks.ts
│   │   ├── parser.ts
│   │   └── index.ts
│   │
│   ├── adapters/
│   │   ├── interface.ts
│   │   ├── beads.ts
│   │   ├── github.ts
│   │   ├── linear.ts
│   │   ├── plain.ts
│   │   └── index.ts
│   │
│   ├── workspace/
│   │   ├── decisions.ts
│   │   ├── patterns.ts
│   │   ├── extract.ts
│   │   └── index.ts
│   │
│   ├── export/
│   │   ├── markdown.ts
│   │   ├── timeline.ts
│   │   ├── json.ts
│   │   └── index.ts
│   │
│   ├── cli/
│   │   ├── commands/
│   │   └── index.ts
│   │
│   └── index.ts              # Main entry point
│
├── package.json
└── tsconfig.json
```

**Pros:**
- Simpler build setup
- Easier to get started
- Single version
- Less boilerplate

**Cons:**
- All-or-nothing imports (unless careful with exports)
- Harder to split later
- Single package grows large over time

### Option C: Plugin Architecture

```
agent-trajectories/
├── src/
│   ├── core/                 # Minimal core
│   │   ├── types.ts
│   │   ├── schema.ts
│   │   ├── plugin.ts         # Plugin interface
│   │   └── registry.ts       # Plugin registry
│   │
│   ├── cli/
│   └── index.ts
│
├── plugins/                  # Official plugins
│   ├── storage-file/
│   ├── storage-sqlite/
│   ├── adapter-beads/
│   ├── adapter-github/
│   ├── export-markdown/
│   └── workspace/
│
└── package.json
```

**Pros:**
- Maximum extensibility
- Community can add adapters/exporters
- Core stays minimal
- Optional features don't bloat install

**Cons:**
- Plugin API design is hard to get right
- Discovery/loading complexity
- Version compatibility matrix
- More documentation needed

### Structure Comparison

| Factor | Monorepo | Single Package | Plugin |
|--------|----------|----------------|--------|
| Initial complexity | High | Low | Medium |
| Extensibility | Medium | Low | High |
| Bundle size control | ★★★★★ | ★★☆☆☆ | ★★★★★ |
| Dev experience | ★★★☆☆ | ★★★★★ | ★★★☆☆ |
| Long-term maintenance | ★★★★★ | ★★★☆☆ | ★★★★☆ |

---

## Storage Layer

### Option A: File System Only

```
.trajectories/
├── index.json                # Quick lookup index
├── active/
│   └── traj_abc123.json
├── completed/
│   └── 2024-01/
│       └── traj_def456.json
└── archive/
```

**Pros:**
- Zero dependencies
- Git-friendly (version with code)
- Human-readable/editable
- Works everywhere

**Cons:**
- No efficient querying
- No full-text search
- Index can get out of sync
- Large repos = slow listing

**Best for:** Simple setups, single-agent use, git-centric workflows

### Option B: SQLite (Primary)

```typescript
// Schema
CREATE TABLE trajectories (
  id TEXT PRIMARY KEY,
  task_title TEXT NOT NULL,
  task_source TEXT,
  task_id TEXT,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  data TEXT NOT NULL,  -- Full JSON
  created_at INTEGER,
  updated_at INTEGER
);

CREATE VIRTUAL TABLE trajectories_fts USING fts5(
  task_title,
  summary,
  decisions,
  content='trajectories'
);
```

**Pros:**
- Full-text search with FTS5
- Efficient queries
- ACID transactions
- Single file, portable
- Excellent library support (better-sqlite3, sql.js)

**Cons:**
- Binary file, harder to diff in git
- Requires SQLite dependency
- Migration management needed
- Concurrent write limitations

**Best for:** Local-first with search, single-user/single-machine

### Option C: SQLite + Files (Hybrid)

```
.trajectories/
├── trajectories.db           # SQLite index + search
├── data/
│   ├── traj_abc123.json      # Full trajectory data
│   └── traj_def456.json
└── exports/
    └── traj_abc123.md        # Generated markdown
```

**Pros:**
- Best of both: search + human-readable files
- Git can track JSON files
- SQLite handles indexing
- Files survive DB corruption

**Cons:**
- Sync complexity
- Two sources of truth
- More disk usage

**Best for:** Balance of usability and power

### Option D: Pluggable Storage Interface

```typescript
interface StorageAdapter {
  // Trajectory CRUD
  save(trajectory: Trajectory): Promise<void>;
  get(id: string): Promise<Trajectory | null>;
  list(query: TrajectoryQuery): Promise<TrajectorySummary[]>;
  delete(id: string): Promise<void>;

  // Search
  search(text: string, options?: SearchOptions): Promise<TrajectorySummary[]>;

  // Events (for streaming)
  appendEvent(trajectoryId: string, event: TrajectoryEvent): Promise<void>;

  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
}

// Implementations
class FileStorageAdapter implements StorageAdapter { }
class SQLiteStorageAdapter implements StorageAdapter { }
class PostgresStorageAdapter implements StorageAdapter { }
class S3StorageAdapter implements StorageAdapter { }
```

**Pros:**
- User chooses what fits their needs
- Easy to add new backends
- Testing with in-memory adapter
- Cloud-ready when needed

**Cons:**
- Interface design requires foresight
- Lowest common denominator features
- More code to maintain

### Storage Comparison

| Factor | File Only | SQLite | Hybrid | Pluggable |
|--------|-----------|--------|--------|-----------|
| Setup complexity | None | Low | Medium | Medium |
| Search capability | ★☆☆☆☆ | ★★★★★ | ★★★★★ | Varies |
| Git-friendly | ★★★★★ | ★☆☆☆☆ | ★★★★☆ | Varies |
| Scalability | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | ★★★★★ |
| Dependencies | None | 1 lib | 1 lib | Varies |

---

## CLI Framework

### Option A: Commander.js

```typescript
import { program } from 'commander';

program
  .command('start <title>')
  .option('--task <id>', 'Link to external task')
  .option('--source <system>', 'Task system (beads, linear, github)')
  .action(async (title, options) => {
    // Implementation
  });
```

**Pros:**
- Most popular, well-documented
- Simple API
- Good TypeScript support
- Automatic help generation

**Cons:**
- Basic output formatting
- No built-in prompts/spinners

### Option B: Oclif (Salesforce)

```typescript
import { Command, Flags } from '@oclif/core';

export default class Start extends Command {
  static flags = {
    task: Flags.string({ char: 't', description: 'External task ID' }),
  };

  async run() {
    const { flags } = await this.parse(Start);
    // Implementation
  }
}
```

**Pros:**
- Enterprise-grade
- Plugin system built-in
- Excellent TypeScript support
- Auto-generated docs
- Built-in testing utilities

**Cons:**
- Heavy (many dependencies)
- Opinionated structure
- Learning curve

### Option C: Yargs

```typescript
import yargs from 'yargs';

yargs
  .command('start <title>', 'Start a new trajectory', (yargs) => {
    return yargs.positional('title', { type: 'string' });
  }, async (argv) => {
    // Implementation
  })
  .parse();
```

**Pros:**
- Flexible
- Good middleware support
- Widely used

**Cons:**
- TypeScript types can be tricky
- Less structured than oclif

### Option D: Clack (Modern)

```typescript
import { intro, outro, text, select, spinner } from '@clack/prompts';

intro('Agent Trajectories');

const title = await text({
  message: 'Trajectory title?',
  placeholder: 'Implement feature X',
});

const s = spinner();
s.start('Creating trajectory...');
// ...
s.stop('Trajectory created!');

outro('Done!');
```

**Pros:**
- Beautiful, modern UI
- Great DX
- Interactive prompts built-in
- Small bundle

**Cons:**
- Newer, less battle-tested
- Focused on interactive use

### Recommendation: Commander + Clack

Use Commander for command parsing, Clack for interactive elements:

```typescript
import { program } from 'commander';
import { intro, spinner, text } from '@clack/prompts';

program
  .command('start [title]')
  .action(async (title) => {
    intro('New Trajectory');

    const finalTitle = title ?? await text({
      message: 'What are you working on?',
    });

    const s = spinner();
    s.start('Creating trajectory...');
    await createTrajectory(finalTitle);
    s.stop('Trajectory created!');
  });
```

---

## Integration Architecture

### Claude Code Hooks

```typescript
// hooks/trajectory.ts
export default {
  name: 'trajectory-capture',

  // Inject active trajectory context at session start
  onSessionStart: async () => {
    const active = await getActiveTrajectory();
    if (active) {
      return {
        systemPrompt: `
          Active trajectory: ${active.task.title}
          Chapter: ${active.currentChapter?.title ?? 'Not started'}

          Use [[TRAJECTORY:event]] blocks to record significant decisions.
        `
      };
    }
  },

  // Prompt for retrospective at session end
  onSessionEnd: async () => {
    const active = await getActiveTrajectory();
    if (active?.status === 'completing') {
      return {
        prompt: 'Please provide a retrospective for this trajectory.'
      };
    }
  },

  // Capture tool calls as events
  onToolCall: async (tool, args, result) => {
    await appendEvent({
      type: 'tool_call',
      content: `${tool}: ${summarize(args)}`,
      raw: { tool, args, result }
    });
  }
};
```

### Agent-Relay Integration

```typescript
// When agent-relay is available, capture messages
import { RelayClient } from 'agent-relay';

const relay = new RelayClient();

relay.on('message', async (envelope) => {
  if (envelope.metadata?.trajectoryId) {
    await appendEvent({
      type: envelope.from === currentAgent ? 'message_sent' : 'message_received',
      content: envelope.payload.body,
      agentName: envelope.from
    });
  }
});
```

### Beads Integration

```typescript
// Watch for beads state changes
import { BeadsClient } from 'beads';

const beads = new BeadsClient();

beads.on('taskStarted', async (task) => {
  await startTrajectory({
    title: task.title,
    source: { system: 'beads', id: task.id }
  });
});

beads.on('taskCompleted', async (taskId) => {
  await promptRetrospective(taskId);
  await completeTrajectory(taskId);
});
```

### MCP Server (Optional)

Expose trajectories via Model Context Protocol:

```typescript
// mcp/trajectory-server.ts
import { MCPServer } from '@anthropic/mcp';

const server = new MCPServer({
  name: 'trajectory-server',

  tools: {
    'trajectory.start': {
      description: 'Start a new trajectory',
      parameters: { title: 'string', taskId: 'string?' },
      handler: async ({ title, taskId }) => {
        return await startTrajectory({ title, taskId });
      }
    },

    'trajectory.decision': {
      description: 'Record a decision point',
      parameters: {
        question: 'string',
        chosen: 'string',
        alternatives: 'string[]',
        reasoning: 'string'
      },
      handler: async (decision) => {
        return await recordDecision(decision);
      }
    },

    'trajectory.search': {
      description: 'Search past trajectories',
      parameters: { query: 'string' },
      handler: async ({ query }) => {
        return await searchTrajectories(query);
      }
    }
  },

  resources: {
    'trajectory://active': {
      description: 'Current active trajectory',
      handler: async () => {
        return await getActiveTrajectory();
      }
    }
  }
});
```

---

## Distribution & Packaging

### Option A: NPM Package

```bash
npm install -g agent-trajectories
# or
npx agent-trajectories start "My task"
```

**Pros:**
- Familiar to JS/TS developers
- Easy updates
- Can be used as library too

**Cons:**
- Requires Node.js
- Startup overhead
- node_modules size

### Option B: Standalone Binary (pkg/nexe)

```bash
# Build
npx pkg . --targets node18-linux-x64,node18-macos-x64,node18-win-x64

# Distribute
curl -fsSL https://agent-trajectories.dev/install.sh | sh
```

**Pros:**
- No Node.js required
- Single file
- Faster startup (bundled)

**Cons:**
- Large binary (~50MB)
- Build complexity
- Platform-specific builds

### Option C: Bun

```bash
bun build ./src/cli/index.ts --compile --outfile agent-trajectories
```

**Pros:**
- Fast builds
- Small binaries
- TypeScript native
- Fast startup

**Cons:**
- Newer runtime, less proven
- Some Node.js APIs differ
- Smaller community

### Option D: Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
ENTRYPOINT ["node", "dist/cli/index.js"]
```

**Pros:**
- Consistent environment
- Easy for CI/CD integration
- No local install

**Cons:**
- Docker required
- Overhead for simple CLI
- Less convenient for daily use

### Distribution Comparison

| Method | Install Size | Startup | Portability | Updates |
|--------|-------------|---------|-------------|---------|
| NPM | ~20MB | ~150ms | Node required | `npm update` |
| Binary (pkg) | ~50MB | ~80ms | Standalone | Redownload |
| Bun | ~30MB | ~30ms | Standalone | Redownload |
| Docker | ~150MB | ~500ms | Docker required | `docker pull` |

---

## Testing Strategy

### Unit Tests

```typescript
// core/schema.test.ts
import { validateTrajectory } from './schema';

describe('Trajectory Schema', () => {
  it('validates a complete trajectory', () => {
    const trajectory = {
      id: 'traj_123',
      version: 1,
      task: { title: 'Test task' },
      status: 'active',
      startedAt: new Date().toISOString(),
      agents: [],
      chapters: []
    };

    expect(validateTrajectory(trajectory)).toEqual({ valid: true });
  });

  it('rejects trajectory without title', () => {
    const trajectory = { id: 'traj_123', status: 'active' };
    expect(validateTrajectory(trajectory).valid).toBe(false);
  });
});
```

### Integration Tests

```typescript
// storage/sqlite.test.ts
import { SQLiteStorage } from './sqlite';
import { tmpdir } from 'os';

describe('SQLite Storage', () => {
  let storage: SQLiteStorage;

  beforeEach(async () => {
    storage = new SQLiteStorage(`${tmpdir()}/test-${Date.now()}.db`);
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('saves and retrieves trajectories', async () => {
    const trajectory = createTestTrajectory();
    await storage.save(trajectory);

    const retrieved = await storage.get(trajectory.id);
    expect(retrieved).toEqual(trajectory);
  });

  it('searches by text', async () => {
    await storage.save(createTestTrajectory({ title: 'Implement auth' }));
    await storage.save(createTestTrajectory({ title: 'Fix database' }));

    const results = await storage.search('auth');
    expect(results).toHaveLength(1);
    expect(results[0].task.title).toBe('Implement auth');
  });
});
```

### E2E Tests

```typescript
// cli/e2e.test.ts
import { execSync } from 'child_process';

describe('CLI E2E', () => {
  it('creates and completes a trajectory', () => {
    // Start
    const startOutput = execSync('npx agent-trajectories start "Test task"');
    expect(startOutput.toString()).toContain('Trajectory created');

    // Check status
    const statusOutput = execSync('npx agent-trajectories status');
    expect(statusOutput.toString()).toContain('Test task');
    expect(statusOutput.toString()).toContain('active');

    // Complete
    const completeOutput = execSync('npx agent-trajectories complete');
    expect(completeOutput.toString()).toContain('completed');
  });
});
```

### Test Framework Options

| Framework | Speed | DX | TypeScript | Watch Mode |
|-----------|-------|-----|------------|------------|
| Vitest | ★★★★★ | ★★★★★ | Native | ★★★★★ |
| Jest | ★★★☆☆ | ★★★★☆ | Config needed | ★★★★☆ |
| Node test runner | ★★★★★ | ★★★☆☆ | Via tsx | ★★★☆☆ |
| Bun test | ★★★★★ | ★★★★☆ | Native | ★★★★☆ |

**Recommendation:** Vitest for best TypeScript DX and speed.

---

## Recommendations

Based on the analysis above, here are my recommendations for different scenarios:

### Scenario 1: Fast MVP (Ship in 2-4 weeks)

| Choice | Recommendation | Rationale |
|--------|----------------|-----------|
| Language | TypeScript | Fastest development, ecosystem alignment |
| Structure | Single package | Less setup, iterate quickly |
| Storage | SQLite + Files hybrid | Good balance of features |
| CLI | Commander + Clack | Simple + beautiful |
| Distribution | NPM | Standard, easy |
| Testing | Vitest | Fast, great DX |

```bash
# Quick start
mkdir agent-trajectories && cd agent-trajectories
npm init -y
npm install typescript commander @clack/prompts better-sqlite3 zod
npm install -D vitest @types/node @types/better-sqlite3
```

### Scenario 2: Production-Ready (2-3 months)

| Choice | Recommendation | Rationale |
|--------|----------------|-----------|
| Language | TypeScript | Ecosystem, contributors |
| Structure | Monorepo (pnpm + turborepo) | Scalability, clean separation |
| Storage | Pluggable (SQLite default) | Flexibility |
| CLI | Oclif | Enterprise-grade, plugins |
| Distribution | NPM + pkg binaries | Both audiences |
| Testing | Vitest + Playwright | Unit + E2E |

### Scenario 3: Maximum Performance

| Choice | Recommendation | Rationale |
|--------|----------------|-----------|
| Language | Rust | Speed, single binary |
| Structure | Cargo workspace | Rust standard |
| Storage | SQLite (rusqlite) | Native performance |
| CLI | clap + ratatui | Fast, beautiful TUI |
| Distribution | GitHub releases | Binary downloads |
| Testing | cargo test | Built-in |

### Scenario 4: Maximum Extensibility

| Choice | Recommendation | Rationale |
|--------|----------------|-----------|
| Language | TypeScript | Contributor-friendly |
| Structure | Plugin architecture | Community extensions |
| Storage | Pluggable | Any backend |
| CLI | Oclif | Built-in plugins |
| Distribution | NPM (core + plugins) | Mix and match |
| Testing | Vitest | Standard |

### Scenario 5: Solo Dev to Enterprise (Recommended)

This is the recommended path—a progressive architecture that works for a solo developer on day one but scales to enterprise teams without rewrites.

| Choice | Recommendation | Rationale |
|--------|----------------|-----------|
| Language | **TypeScript** | Broadest contributor pool, ecosystem alignment |
| Structure | **Single package → Monorepo** | Start simple, split when needed |
| Storage | **Pluggable with sensible defaults** | File for solo, SQLite for power users, Postgres for teams |
| CLI | **Commander + Clack** | Simple, beautiful, scriptable |
| Distribution | **NPM + optional binaries** | Easy install, optional standalone |
| Testing | **Vitest** | Fast, modern, great DX |

#### The Progressive Enhancement Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PROGRESSIVE ENHANCEMENT                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SOLO DEV (Day 1)                                                        │
│  ├── npm install agent-trajectories                                      │
│  ├── File storage (.trajectories/ in repo)                               │
│  ├── CLI: start, status, complete, export                                │
│  └── Zero config, works immediately                                      │
│                                                                          │
│  POWER USER (Week 2)                                                     │
│  ├── Enable SQLite for search                                            │
│  ├── Claude Code hooks for auto-capture                                  │
│  ├── Custom export templates                                             │
│  └── Config file for preferences                                         │
│                                                                          │
│  SMALL TEAM (Month 1)                                                    │
│  ├── Shared SQLite or PostgreSQL                                         │
│  ├── Multiple agent coordination                                         │
│  ├── Team patterns and decisions                                         │
│  └── PR integration                                                      │
│                                                                          │
│  ENTERPRISE (Month 3+)                                                   │
│  ├── PostgreSQL + S3 for scale                                           │
│  ├── SSO/auth integration                                                │
│  ├── Audit logging                                                       │
│  ├── Custom adapters (Jira, ServiceNow, etc.)                            │
│  └── Dashboard/reporting                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Why This Works for Both

| Need | Solo Dev Solution | Enterprise Solution |
|------|-------------------|---------------------|
| **Quick start** | `npx agent-trajectories init` | Same, then configure |
| **Storage** | Files in repo (git-friendly) | Postgres + S3 |
| **Search** | SQLite FTS (local) | Elasticsearch/Postgres FTS |
| **Auth** | None needed | SSO via config |
| **Compliance** | Git history IS the audit log | Dedicated audit tables |
| **Integrations** | Claude Code hooks | + Jira, Linear, custom |

#### Configuration Layers

```typescript
// No config = sensible defaults for solo dev
// .trajectoriesrc.json for customization

// Solo dev (zero config)
{}

// Power user
{
  "storage": "sqlite",
  "hooks": { "claudeCode": true }
}

// Team
{
  "storage": {
    "type": "postgresql",
    "url": "$DATABASE_URL"
  },
  "team": {
    "sharedPatterns": true,
    "requireRetrospective": true
  }
}

// Enterprise
{
  "storage": {
    "type": "postgresql",
    "url": "$DATABASE_URL",
    "archive": { "type": "s3", "bucket": "trajectories-archive" }
  },
  "auth": {
    "type": "oidc",
    "issuer": "$AUTH_ISSUER"
  },
  "audit": { "enabled": true },
  "adapters": ["jira", "servicenow"]
}
```

---

## Open Questions for Discussion

### 1. Integration Priority

How should trajectories be captured? This determines the v1 focus and user experience.

#### Option A: Claude Code Hooks (Automatic Capture)

```typescript
// .claude/hooks/trajectory.ts
export default {
  onSessionStart: async () => {
    // Auto-detect or prompt for trajectory context
    return { systemPrompt: `Recording trajectory for: ${activeTask}` };
  },

  onToolCall: async (tool, args, result) => {
    // Silently capture tool usage
    await trajectory.appendEvent({ type: 'tool_call', tool, summary: ... });
  },

  onSessionEnd: async () => {
    // Prompt for retrospective
    return { prompt: 'Please summarize key decisions made...' };
  }
};
```

**User experience:**
- Install hook once, trajectories captured automatically
- Agent explicitly prompted for decisions/retrospectives
- Works passively in background

**Pros:**
- Lowest friction—just works
- Captures everything (no forgotten recordings)
- Integrates with existing Claude Code workflow

**Cons:**
- Coupled to Claude Code
- Less control over what's captured
- May capture noise

**Best for:** Claude Code users who want zero-effort capture

---

#### Option B: Standalone CLI (Explicit Recording)

```bash
# User explicitly starts/stops trajectories
$ traj start "Implement auth"
Trajectory started: traj_abc123

# User works with any tool (Claude Code, Cursor, manual coding)

# User explicitly records decisions
$ traj decision "Chose JWT over sessions" --reasoning "Stateless scaling"

# User explicitly completes
$ traj complete
Please enter retrospective summary: ...
```

**User experience:**
- Full control over what's recorded
- Works with ANY coding tool/workflow
- Trajectory is a deliberate artifact

**Pros:**
- Tool-agnostic (works with Cursor, Copilot, manual coding)
- User controls signal vs noise
- Simpler implementation (no hook infrastructure)

**Cons:**
- Friction—user must remember to record
- Incomplete trajectories likely
- More typing/commands

**Best for:** Users who want explicit control, multi-tool workflows

---

#### Option C: MCP Server (Agent-Accessible)

```typescript
// Agent can directly read/write trajectories via MCP
const server = new MCPServer({
  tools: {
    'trajectory.start': { ... },
    'trajectory.decision': { ... },
    'trajectory.search': { ... },  // Query past trajectories
    'trajectory.getSuggestions': { ... }  // "How did we solve X before?"
  },
  resources: {
    'trajectory://active': { ... },
    'trajectory://patterns': { ... }
  }
});
```

**User experience:**
- Agent can autonomously record its own work
- Agent can query past trajectories for context
- Enables the "Agent Workspace" vision

**Pros:**
- Agents can learn from past trajectories
- Self-documenting agents
- Enables workspace/pattern features

**Cons:**
- More complex infrastructure
- Requires MCP-capable client
- Agent must be taught to use it

**Best for:** Advanced multi-agent setups, workspace features

---

#### Option D: Hybrid (Recommended)

Start with CLI as the foundation, add hooks and MCP as layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYERS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   MCP Server (Layer 3) ─── Agent-accessible queries/writes      │
│         │                                                        │
│         ▼                                                        │
│   Claude Code Hooks (Layer 2) ─── Automatic capture             │
│         │                                                        │
│         ▼                                                        │
│   CLI Core (Layer 1) ─── Explicit commands, always available    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**v1 scope options:**
- **Minimal:** CLI only (4 commands: start, status, complete, export)
- **Standard:** CLI + Claude Code hooks
- **Full:** CLI + Hooks + MCP Server

**Recommendation:** Start with CLI + Hooks. MCP in v1.1.

2. **Storage default?**
   - File-only (simplest, git-friendly)? ← Recommended for v1
   - SQLite (searchable)?
   - Both available from start?

3. **Retrospective enforcement?**
   - Required to complete?
   - Optional but prompted? ← Recommended
   - Fully optional?

4. **Scope of v1?**
   - Core capture + export only?
   - Include workspace features?
   - Include all adapters?

---

## Next Steps

1. **Decide on core choices** (language, structure, storage)
2. **Define v1 scope** (what's in, what's deferred)
3. **Set up repository** with chosen stack
4. **Implement core types** and schema validation
5. **Build minimal CLI** (start, status, complete, export)
6. **Add first integration** (Claude Code hooks or Beads)
7. **Ship alpha** for feedback

---

## Appendix: Dependency Inventory

### TypeScript Stack (Recommended)

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "@clack/prompts": "^0.7.0",
    "better-sqlite3": "^9.0.0",
    "zod": "^3.22.0",
    "chalk": "^5.3.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0",
    "@types/better-sqlite3": "^7.0.0",
    "tsup": "^8.0.0"
  }
}
```

### Rust Stack

```toml
[dependencies]
clap = { version = "4.4", features = ["derive"] }
rusqlite = { version = "0.30", features = ["bundled"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
chrono = { version = "0.4", features = ["serde"] }
tokio = { version = "1.0", features = ["full"] }
```
