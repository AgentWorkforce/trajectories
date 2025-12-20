# Agent Trajectories

**Capture the complete "train of thought" of agent work as first-class artifacts.**

When an agent completes a task today, the only artifacts are code changes, commit messages, and PR descriptions. The rich context of *how* the work happened disappears: why approach A was chosen over B, what dead ends were explored, what assumptions were made.

Agent Trajectories captures this missing context as structured, searchable, portable records that travel with the code.

## What is a Trajectory?

A **trajectory** is the complete story of agent work on a task:

- **Chapters** - Logical segments of work (exploration, implementation, testing)
- **Events** - Prompts, tool calls, decisions, messages between agents
- **Retrospective** - Agent reflection on what was accomplished, challenges faced, and lessons learned
- **Artifacts** - Links to commits, files changed, and external task references

## Key Features

### Platform Agnostic
Works with any task system: Beads, Linear, Jira, GitHub Issues, or standalone. Trajectories are a universal format—like Markdown for documentation.

### Multiple Storage Backends
- **File system** (default) - `.trajectories/` directory, git-friendly
- **SQLite** - Local indexing and search
- **PostgreSQL/S3** - For teams and archival

### Rich Export Formats
- **Markdown** - Notion-style pages for documentation
- **Timeline** - Linear-style chronological view
- **JSON** - Full structured data for tooling

### Integration Ready
- Complements [claude-mem](https://github.com/thedotmack/claude-mem) for observation-level memory
- Integrates with [agent-relay](https://github.com/khaliqgant/agent-relay) for multi-agent messaging

## Use Cases

### Code Review
Instead of guessing at intent from 500 changed lines, reviewers can:
- Read the trajectory summary
- See what alternatives were considered and rejected
- Understand the agent's confidence level

### Bug Diagnosis
When a bug surfaces months later:
- Query the trajectory for the commit that introduced the code
- See original requirements and edge cases considered
- Understand the context that led to this implementation

### Institutional Memory
Over time, trajectories become a searchable knowledge base:
- "How have we solved caching problems before?"
- "What libraries did we evaluate for X?"
- "Why did we choose this architecture?"

## Quick Start

```bash
# Start tracking a task
agent-relay trajectory start "Implement auth module"

# View current trajectory
agent-relay trajectory status

# Add a decision point
agent-relay trajectory decision "Chose JWT over sessions" \
  --reasoning "Stateless scaling requirements"

# Complete and export
agent-relay trajectory complete
agent-relay trajectory export --format markdown
```

## Agent Workspace

Trajectories power a broader vision: **a knowledge workspace for agents**—like Notion, but for AI.

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT WORKSPACE                             │
├─────────────────────────────────────────────────────────────────┤
│  📚 Knowledge Base          🛤️ Trajectories                     │
│  ├── Architecture docs      ├── Active work                    │
│  ├── Code patterns          ├── Recent history                 │
│  └── Conventions            └── Searchable archive             │
│                                                                 │
│  🧠 Decision Log            📋 Pattern Library                  │
│  └── Why things are         └── How to do things               │
└─────────────────────────────────────────────────────────────────┘
```

When an agent starts a new task, it can query the workspace for:
- Relevant past trajectories
- Applicable patterns and conventions
- Related decisions
- Potential gotchas from retrospectives

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT-TRAJECTORIES (Layer 3)                                   │
│  Task narratives, decisions, retrospectives                     │
│                            ▲                                    │
│                            │ aggregates                         │
│  CLAUDE-MEM (Layer 2)                                           │
│  Tool observations, semantic concepts                           │
│                            ▲                                    │
│                            │ captures                           │
│  AGENT-RELAY (Layer 1)                                          │
│  Real-time messaging, message persistence                       │
└─────────────────────────────────────────────────────────────────┘
```

Each layer is independent and can be used alone, but together they form a complete agent memory stack.

## The Trajectory Format

```json
{
  "id": "traj_abc123",
  "task": {
    "title": "Implement user authentication",
    "source": { "system": "linear", "id": "ENG-456" }
  },
  "status": "completed",
  "chapters": [...],
  "retrospective": {
    "summary": "Implemented JWT-based auth with refresh tokens",
    "decisions": [...],
    "confidence": 0.85
  }
}
```

Trajectories are stored as `.trajectory.json` files (machine-readable) with auto-generated `.trajectory.md` summaries (human-readable).

## Why This Matters

> "The trajectory is as valuable as the code."

Just as we version control source code, we should version control the reasoning that produced it. Trajectories transform ephemeral agent work into durable knowledge that:

- Makes code review meaningful
- Accelerates bug diagnosis
- Preserves institutional memory
- Enables learning from past work
- Builds trust in agent-generated code

## Status

This project is in early development. See [PROPOSAL-trajectories.md](./PROPOSAL-trajectories.md) for the full design document.

## License

MIT
