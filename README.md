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
- **Agent Trace integration** - Automatic code attribution following [agent-trace.dev](https://agent-trace.dev) spec

### Code Attribution (Agent Trace)

Trajectories automatically generate [Agent Trace](https://agent-trace.dev) records that attribute code changes to AI agents:

```bash
trail start "Implement auth module"
# ... agent writes code, makes commits ...
trail complete --summary "Added JWT auth" --confidence 0.85

# View trace attribution
trail show traj_abc123 --trace
```

**What you get:**
- `.trace.json` files saved alongside each trajectory
- Line-level attribution of which code was AI-generated
- Model identification (Claude, GPT, etc.)
- Git revision tracking for change history

**Zero configuration required** - traces are generated automatically when completing trajectories in a git repository.

See the full [Agent Trace Integration Spec](./docs/specs/agent-trace-integration.md) for details.

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

### CLI

```bash
# Start tracking a task
trail start "Implement auth module"

# View current status
trail status

# Record a decision (reasoning optional for minor decisions)
trail decision "Chose JWT over sessions" \
  --reasoning "Stateless scaling requirements"

# Complete with retrospective
trail complete --summary "Added JWT auth" --confidence 0.85

# List all trajectories (with optional search)
trail list
trail list --search "auth"

# Export for documentation (markdown, json, timeline, or html)
trail export traj_abc123 --format markdown
trail export --format html --open  # Opens in browser
```

### SDK

For programmatic usage, install the package and use the SDK:

```bash
npm install agent-trajectories
```

**Using the Client (with storage):**

```typescript
import { TrajectoryClient } from 'agent-trajectories';

const client = new TrajectoryClient({ defaultAgent: 'my-agent' });
await client.init();

// Start a new trajectory
const session = await client.start('Implement auth module');

// Record work in chapters
await session.chapter('Research');
await session.note('Found existing auth patterns');
await session.finding('Current system uses sessions');

// Record decisions
await session.decide(
  'JWT vs Sessions?',
  'JWT',
  'Better for horizontal scaling'
);

// Complete with retrospective
await session.done('Implemented JWT-based authentication', 0.9);

await client.close();
```

**Using the Builder (in-memory, no storage):**

```typescript
import { trajectory } from 'agent-trajectories';

const result = trajectory('Fix login bug')
  .withSource({ system: 'github', id: 'GH#456' })
  .chapter('Investigation', 'claude')
    .finding('Null pointer in session handler')
    .decide('Fix approach', 'Add null check', 'Minimal change')
  .chapter('Implementation', 'claude')
    .note('Added validation')
  .done('Fixed null pointer exception', 0.95);

// Export the trajectory
console.log(result);  // Full trajectory object
```

**SDK Features:**
- **Auto-save**: Changes persist automatically with the client
- **Fluent API**: Chain operations naturally
- **Resume support**: Pick up where you left off with `client.resume()`
- **Multiple exports**: Markdown, JSON, timeline, PR summary

## Why "Trail"?

> **Trajectory** = the complete path an agent takes through a task
> **Trail** = what's left behind for others to follow

You don't see the whole trajectory in real-time, but you can always follow the trail.

The CLI is called `trail` because that's what you're doing—leaving a trail of breadcrumbs through your work. Future agents and humans can follow this trail to understand not just *what* was built, but *why* it was built that way.

## Who Uses Trail?

**Both agents and humans—but differently.**

### Agents: Write the Trail

Agents use trail commands to **record** their work as they go:

```bash
# Agent starts work on a task
trail start "Add rate limiting to API"

# Agent records key decisions as it works
trail decision "Token bucket algorithm" \
  --reasoning "Better burst handling than fixed window"

# Agent completes with reflection
trail complete --summary "Added rate limiting" --confidence 0.9
```

This can be invoked programmatically by AI coding tools, or agents can learn to call `trail` as part of their workflow.

### Humans: Read the Trail

Humans use trail commands to **understand** and **review** agent work:

```bash
# List and search past work
trail list --search "authentication"

# See trajectory details and decisions
trail show traj_abc123 --decisions

# View in browser
trail export traj_abc123 --format html --open

# Export for code review
trail export traj_abc123 --format markdown
```

### The Handoff

The trail bridges the gap between agent work and human understanding:

```
Agent works → Records decisions → Completes trajectory
                                        ↓
Human reviews → Follows the trail → Understands the "why"
```

Without the trail, humans see only the code. With it, they see the reasoning.

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

## Why Trajectories Matter

> "The trajectory is as valuable as the code."

As AI agents write more code faster than ever before, a critical gap emerges: **we're shipping code without understanding**. Trajectories close this gap.

### The Health of Your Codebase

Without trajectories, agent-generated code becomes a black box:

| Problem | Impact | How Trajectories Help |
|---------|--------|----------------------|
| **Silent assumptions** | Bugs hide in undocumented edge cases | Decisions and reasoning are captured explicitly |
| **Inconsistent patterns** | Each agent reinvents approaches | Past solutions are queryable, patterns emerge |
| **Lost context** | Nobody knows why code exists | The "why" lives alongside the "what" |
| **Review theater** | PRs approved without real understanding | Reviewers see the full decision history |
| **Debugging blind** | Hours spent reverse-engineering intent | Original context is one query away |

### The Flywheel Effect

Trajectories create a virtuous cycle that compounds over time:

```
More trajectories → More extracted knowledge → Better agent context →
Better decisions → Better retrospectives → Richer trajectories → ...
```

Each completed task makes future tasks easier:
- Agents make fewer mistakes by learning from past gotchas
- Decisions are more consistent across the codebase
- Onboarding new agents (or humans) becomes instant
- Institutional memory persists even as team members change

### Future-Proofing Your Project

As agent usage scales, trajectories become essential infrastructure:

**Today (1-2 agents):**
- Nice to have for code review
- Helpful for debugging

**Tomorrow (5-10 agents working in parallel):**
- Critical for coordination
- Required for understanding who did what and why
- Enables agents to learn from each other

**Long-term (agents as primary contributors):**
- The authoritative record of how the system evolved
- Training data for project-specific agent improvements
- Audit trail for compliance and security review

### Trust Through Transparency

Agent-generated code faces a trust problem. Developers hesitate to ship code they don't understand. Trajectories solve this by making agent reasoning transparent:

- **Confidence scores** tell you when to scrutinize more carefully
- **Decision logs** show trade-offs were considered
- **Retrospectives** surface known limitations and risks
- **Challenge documentation** reveals what was hard (and might break)

The result: teams can ship agent code with the same confidence as human-written code—because they understand it just as well.

## Installation

```bash
npm install agent-trajectories
```

The package provides:
- **CLI** (`trail` command) - For command-line usage
- **SDK** - For programmatic integration

```typescript
// Main import (includes SDK)
import { TrajectoryClient, trajectory } from 'agent-trajectories';

// Or import from SDK subpath
import { TrajectoryClient, TrajectoryBuilder } from 'agent-trajectories/sdk';
```

## SDK Reference

### TrajectoryClient

The client manages trajectories with persistent storage.

```typescript
const client = new TrajectoryClient({
  defaultAgent: 'my-agent',    // Default agent name
  dataDir: '.trajectories',     // Storage directory
  autoSave: true,               // Auto-save after operations
});

await client.init();            // Required before use

// Lifecycle
const session = await client.start('Task title');
const session = await client.resume();     // Resume active trajectory
const traj = await client.get('traj_xxx'); // Get by ID

// Query
const list = await client.list({ status: 'completed' });
const results = await client.search('auth');

// Export
const md = await client.exportMarkdown('traj_xxx');
const json = await client.exportJSON('traj_xxx');

await client.close();
```

### TrajectorySession

Sessions provide chainable operations on active trajectories.

```typescript
const session = await client.start('Task');

// Chapters organize work phases
await session.chapter('Research');
await session.chapter('Implementation');

// Events record what happened
await session.note('Observation or note');
await session.finding('Important discovery');
await session.error('Something went wrong');

// Decisions capture choices
await session.decide('Question?', 'Choice', 'Reasoning');

// Complete or abandon
await session.done('Summary of work', 0.9);
await session.abandon('Reason for abandoning');
```

### TrajectoryBuilder

The builder creates trajectories in memory without storage.

```typescript
import { trajectory, TrajectoryBuilder } from 'agent-trajectories';

// Shorthand function
const t = trajectory('Task title')
  .chapter('Work', 'agent-name')
  .note('Did something')
  .done('Completed', 0.9);

// Or use the class directly
const t = TrajectoryBuilder.create('Task')
  .withDescription('Detailed description')
  .withSource({ system: 'linear', id: 'ENG-123' })
  .withTags('feature', 'auth')
  .chapter('Phase 1', 'claude')
  .complete({
    summary: 'What was done',
    approach: 'How it was done',
    confidence: 0.85,
    challenges: ['What was hard'],
    learnings: ['What was learned'],
  });
```

## Status

This project is in early development. See [PROPOSAL-trajectories.md](./PROPOSAL-trajectories.md) for the full design document.

## License

MIT
