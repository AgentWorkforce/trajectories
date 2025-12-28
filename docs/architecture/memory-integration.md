# Memory Integration Across AI Tools

## The Problem

Each AI coding tool maintains its own isolated context:

| Tool | Memory Location | Format | Persistence |
|------|-----------------|--------|-------------|
| Claude Code | Anthropic cloud | Proprietary | Per-user |
| Cursor | `.cursor/` | SQLite + JSON | Per-project |
| Aider | `.aider/` | Chat history | Per-session |
| Copilot | GitHub | Embeddings | Per-repo |
| Windsurf | Local | Proprietary | Per-project |

**Result:** When switching between tools or agents, context is lost.

## The Solution: Shared Project Memory

Trajectories and the workspace provide tool-agnostic project memory:

```
.trajectories/           # What happened (work history)
├── active/              # Current work
└── completed/           # Past work with full reasoning

.agent-workspace/        # What to know (extracted knowledge)
├── decisions/           # Why things are the way they are
├── patterns/            # How to do common tasks
└── knowledge/           # Architecture, conventions
```

Any AI tool can read these to understand the project.

## Integration Approaches

### 1. Context Injection (Simplest)

Add workspace content to system prompts:

```markdown
# Project Context

## Recent Decisions
- Use JWT for auth (stateless scaling)
- PostgreSQL over MySQL (JSON support)

## Patterns
- API endpoints follow REST conventions in patterns/api-endpoint.md
- Error handling uses Result types per patterns/error-handling.md

## Active Work
Currently implementing: traj_abc123 (Add user authentication)
```

**Works with:** Any AI tool that accepts system prompts or context files.

### 2. CLAUDE.md / .cursorrules Integration

Generate tool-specific context files from workspace:

```bash
traj export-context --format claude.md > CLAUDE.md
traj export-context --format cursorrules > .cursorrules
traj export-context --format aider > .aider.conf.yml
```

**Benefit:** Native integration with each tool's context mechanism.

### 3. MCP Server (Advanced)

Expose workspace as an MCP (Model Context Protocol) server:

```typescript
// Agent can query the workspace
const decisions = await mcp.call("workspace/query", {
  query: "authentication",
  type: "decision"
});

// Agent can record decisions
await mcp.call("trajectory/decision", {
  title: "Use bcrypt for password hashing",
  reasoning: "Industry standard, adjustable work factor"
});
```

**Benefit:** Real-time bidirectional integration.

### 4. Git Hooks (Automatic)

Sync context on git operations:

```bash
# .git/hooks/post-checkout
traj sync-context

# .git/hooks/pre-commit
traj auto-capture  # Capture trajectory from commit
```

## Claude Memory Complement

Claude Memory and Trajectories serve different purposes:

| Claude Memory | Trajectories/Workspace |
|---------------|----------------------|
| "I prefer TypeScript" | "This project uses TypeScript" |
| "Use concise responses" | "Auth uses JWT per decision-001" |
| "My name is Khaliq" | "API follows patterns/rest-endpoint.md" |

**Claude Memory** = Personal preferences that follow YOU
**Workspace** = Project knowledge that follows THE CODE

### Synergy

```
┌─────────────────────────────────────────────────────┐
│                    AI Agent                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Claude Memory          Workspace Query              │
│  ┌──────────────┐      ┌──────────────────────────┐ │
│  │ User prefers │      │ Project uses JWT auth    │ │
│  │ TypeScript   │  +   │ Error pattern: Result<T> │ │
│  │ Concise code │      │ Last auth work: traj_123 │ │
│  └──────────────┘      └──────────────────────────┘ │
│         ↓                        ↓                   │
│  ┌───────────────────────────────────────────────┐  │
│  │ Combined Context:                              │  │
│  │ "Write TypeScript auth using JWT, following   │  │
│  │  the Result<T> error pattern from traj_123"   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Implementation Priority

### Phase 1: Export Context (Now)
```bash
traj context                    # Print current context summary
traj context --format markdown  # For CLAUDE.md
```

### Phase 2: Tool-Specific Files
```bash
traj sync claude    # Generate CLAUDE.md
traj sync cursor    # Generate .cursorrules
traj sync aider     # Generate .aider context
```

### Phase 3: MCP Server
```bash
traj serve --mcp    # Start MCP server for real-time queries
```

### Phase 4: Auto-Capture
Git hooks and file watchers that automatically capture trajectory events from any tool's output.

## Cross-Tool Workflow Example

```bash
# Start work in Claude Code
traj start "Add rate limiting"
# Claude Code works, decisions are recorded

# Switch to Cursor for UI work
# Cursor reads .cursorrules (generated from workspace)
# Cursor sees: "Rate limiting uses token bucket, see traj_xyz"

# Switch to Aider for quick fix
# Aider reads context, understands the approach
# Continues the trajectory

# Complete in any tool
traj complete --summary "Added rate limiting" --confidence 0.9
```

## Key Insight

**Trajectories are the universal memory layer for AI-assisted development.**

- Claude Memory = your preferences (portable across Claude contexts)
- Trajectories = project decisions (portable across ALL AI tools)
- Workspace = extracted patterns (queryable by any agent)

Together, they ensure no context is lost when switching tools, agents, or even team members.
