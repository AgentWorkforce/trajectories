# Web Viewer Architecture

## Overview

A lightweight local web interface for humans to browse and read trajectories in a Notion-like format.

## Design Goals

1. **Zero external dependencies** - No cloud services, runs entirely local
2. **Instant startup** - `traj view` opens browser immediately
3. **No build step** - Works without webpack/vite in dev
4. **Offline-first** - All data from local `.agentworkforce/trajectories/`

## Architecture Options

### Option A: Static HTML Export (Recommended for v1)

Generate a self-contained HTML file with embedded data:

```
traj view                    # Opens generated HTML in browser
traj view --serve            # Start live server with hot reload
traj view --export site/     # Generate static site
```

**Pros:**
- No server needed for basic viewing
- Can be committed to repo for sharing
- Works offline, shareable via email

**Cons:**
- No live updates without regeneration

### Option B: Local Dev Server

Run a lightweight HTTP server:

```
traj serve                   # Start server at localhost:3847
```

**Stack:**
- Node HTTP server (built-in, no Express needed)
- Preact for UI (3KB, no build step with htm)
- CSS: Simple stylesheet, no framework

**Pros:**
- Live updates as trajectories change
- Search and filter in UI

**Cons:**
- Requires running server

### Option C: Hybrid (Recommended)

Combine both: static HTML for sharing, local server for active use.

## UI Components

```
┌─────────────────────────────────────────────────────────────────┐
│  🛤️ Trajectories                              [Search...] [⚙️]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SIDEBAR                    │  MAIN VIEW                        │
│  ─────────                  │  ─────────                        │
│                             │                                   │
│  ▸ Active (1)               │  📋 Implement User Auth           │
│    └─ traj_abc123           │  ━━━━━━━━━━━━━━━━━━━━━━━━━        │
│                             │                                   │
│  ▸ This Week (5)            │  Status: ● Active                 │
│                             │  Started: 2h ago                  │
│  ▸ Completed (23)           │  Agent: Claude                    │
│                             │                                   │
│  ▸ Abandoned (2)            │  ▾ Summary                        │
│                             │    JWT auth with refresh tokens   │
│  ──────────────             │                                   │
│  📁 Workspace               │  ▾ Key Decisions (2)              │
│    ├─ Decisions             │    ├─ JWT over sessions           │
│    ├─ Patterns              │    └─ Bcrypt for passwords        │
│    └─ Knowledge             │                                   │
│                             │  ▾ Timeline                       │
│                             │    10:00 Started                  │
│                             │    10:15 Research phase           │
│                             │    10:30 Decision: JWT            │
│                             │    11:00 Implementation           │
│                             │                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Static HTML Generator
- Generate single HTML file with all trajectory data
- Embedded CSS (light/dark mode)
- Collapsible sections for chapters, decisions
- `traj view <id>` opens single trajectory
- `traj view --all` generates index + all trajectories

### Phase 2: Local Server
- Add `traj serve` command
- WebSocket for live updates
- Search across all trajectories
- Filtering by status, date, agent

### Phase 3: Workspace Integration
- Sidebar shows workspace knowledge
- Link decisions to source trajectories
- Pattern library view
- "Related trajectories" for context

## File Structure

```
src/
├── web/
│   ├── server.ts           # HTTP server
│   ├── templates/
│   │   ├── index.html      # Main shell
│   │   ├── trajectory.html # Single trajectory view
│   │   └── styles.css      # Embedded styles
│   ├── generator.ts        # Static HTML generator
│   └── components/         # Preact components (Phase 2)
│       ├── Sidebar.tsx
│       ├── Timeline.tsx
│       └── DecisionCard.tsx
```

## CLI Integration

```bash
# View commands
traj view                  # Open active trajectory in browser
traj view <id>             # Open specific trajectory
traj view --all            # Open index of all trajectories

# Server commands
traj serve                 # Start local server
traj serve --port 8080     # Custom port

# Export for sharing
traj export <id> --format html --output trajectory.html
traj export --all --format html --output ./docs/trajectories/
```

## Workspace Layer

The workspace extracts durable knowledge from trajectories:

```
.agent-workspace/
├── decisions/
│   ├── index.json              # All decisions with links
│   └── auth-approach.md        # Individual decision doc
├── patterns/
│   ├── index.json
│   └── api-endpoint.md         # Reusable pattern
├── knowledge/
│   ├── architecture.md         # Codebase knowledge
│   └── conventions.md          # Team conventions
└── config.json                 # Workspace settings
```

### Decision Extraction

When a trajectory completes, decisions can be promoted to workspace:

```bash
traj workspace promote-decision <trajectory-id> <decision-index>
# or interactively after completion
```

### Query Interface

Agents query the workspace:

```typescript
interface WorkspaceQuery {
  type: 'decision' | 'pattern' | 'trajectory' | 'any';
  query: string;
  context?: string;  // Current task context
  limit?: number;
}

// Example: Agent asks about auth
workspace.query({
  type: 'any',
  query: 'authentication',
  context: 'implementing login flow'
});

// Returns:
// - Decision: "Use JWT for auth"
// - Pattern: "Auth middleware template"
// - Trajectory: traj_abc123 (implemented auth before)
```

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Server | Node http | Zero deps, built-in |
| UI (v1) | Vanilla JS | No build step |
| UI (v2) | Preact + htm | 3KB, no build needed |
| CSS | Custom | Simple, themed |
| Icons | Unicode emoji | No icon deps |

## Questions to Resolve

1. **Workspace location**: `.agent-workspace/` vs inside `.agentworkforce/trajectories/workspace/`?
2. **Knowledge format**: Markdown files vs JSON?
3. **Pattern templates**: How to make patterns executable/reusable?
4. **Multi-repo**: How does workspace work across repos?
