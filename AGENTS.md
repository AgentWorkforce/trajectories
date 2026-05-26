<!-- prpm:snippet:start @agent-workforce/trail-snippet@1.1.2 -->
# Trail

Record your work as a trajectory for future agents and humans to follow.

## Usage

Run without a global install by invoking the npm package:
```bash
npx --yes agent-trajectories start "Task description"
```

If `agent-trajectories` is installed locally in a project, run through npm so
`node_modules/.bin` is resolved:
```bash
npx --no-install trail start "Task description"
# or
npm exec -- trail start "Task description"
```

If this is the `agent-trajectories` repository, use the local source runner:
```bash
npm run trail -- start "Task description"
```

If `trail` is installed globally, run commands directly:
```bash
trail start "Task description"
```

Examples below use `trail` directly; for non-global installs, substitute the
appropriate `npx`, `npm exec`, or `npm run trail --` prefix from above.

## When Starting Work

Start a trajectory when beginning a task:

```bash
trail start "Implement user authentication"
```

With external task reference:
```bash
trail start "Fix login bug" --task "ENG-123"
```

## Recording Decisions

Record key decisions as you work:

```bash
trail decision "Chose JWT over sessions" \
  --reasoning "Stateless scaling requirements"
```

For minor decisions, reasoning is optional:
```bash
trail decision "Used existing auth middleware"
```

**Record decisions when you:**
- Choose between alternatives
- Make architectural trade-offs
- Decide on an approach after investigation

## Recording Reflections

Periodically step back and synthesize progress:

```bash
trail reflect "Workers aligned on auth approach, API layer progressing well" \
  --confidence 0.8
```

With focal points and adjustments:
```bash
trail reflect "Frontend and backend duplicating validation logic" \
  --focal-points "duplication,ownership" \
  --adjustments "Reassigning validation to backend team" \
  --confidence 0.7
```

**Record reflections when you:**
- Have received several updates and need to synthesize the big picture
- Notice workers or tasks diverging from the plan
- Want to course-correct before continuing
- Are coordinating multiple agents and need to assess overall progress

Reflections differ from decisions: decisions record a specific choice,
reflections record a higher-level synthesis of what's happening and whether
the current approach is working.

## Completing Work

When done, complete with a retrospective:

```bash
trail complete --summary "Added JWT auth with refresh tokens" --confidence 0.85
```

After completing work, compact the finished trajectory or merged PR into a
durable summary. When the compacted summary is sufficient, discard the raw
source trajectories so `.trajectories/index.json` and list output stay focused:

```bash
trail compact --discard-sources
# or after a PR merge:
trail compact --pr 42 --discard-sources
```

`--discard-sources` removes the source trajectory JSON/Markdown/trace files and
updates the index. Use it after confirming the compacted artifact is the record
you want to keep.

**Confidence levels:**
- 0.9+ : High confidence, well-tested
- 0.7-0.9 : Good confidence, standard implementation
- 0.5-0.7 : Some uncertainty, edge cases possible
- <0.5 : Significant uncertainty, needs review

## Abandoning Work

If you need to stop without completing:

```bash
trail abandon --reason "Blocked by missing API credentials"
```

## Checking Status

View current trajectory:
```bash
trail status
```

## Listing and Viewing Trajectories

List all trajectories:
```bash
trail list
```

View a specific trajectory:
```bash
trail show <trajectory-id>
```

Export a trajectory (markdown, json, timeline, html, pr-summary):
```bash
trail export <trajectory-id> --format markdown
```

## Compacting Trajectories

After a PR merge, compact related trajectories into a single summary and prune
raw source trajectories when the summary should replace them:

```bash
trail compact --pr 42 --discard-sources
```

Compact by branch:
```bash
trail compact --branch feature/auth --discard-sources
```

Compact by commit range:
```bash
trail compact --commits abc123..def456 --discard-sources
```

Compaction consolidates decisions and creates a grouped summary. Adding
`--discard-sources` makes the compacted artifact the durable record by removing
the raw trajectories and their index entries.

## Why Trail?

Your trajectory helps others understand:
- **What** you built (commits show this)
- **Why** you built it this way (trajectory shows this)
- **What alternatives** you considered
- **What challenges** you faced

Future agents can query past trajectories to learn from your decisions.
<!-- prpm:snippet:end @agent-workforce/trail-snippet@1.1.2 -->

<!-- prpm:snippet:start @agent-relay/agent-relay-snippet@1.1.7 -->
# Agent Relay

Real-time agent-to-agent messaging via MCP tools.

## MCP Tools

All agent communication uses MCP tools provided by the Relaycast MCP server:

| Tool                           | Description                           |
| ------------------------------ | ------------------------------------- |
| `relay_send(to, message)`      | Send a message to an agent or channel |
| `relay_inbox()`                | Check your inbox for new messages     |
| `relay_who()`                  | List online agents                    |
| `relay_spawn(name, cli, task)` | Spawn a new worker agent              |
| `relay_release(name)`          | Release/stop a worker agent           |
| `relay_status()`               | Check relay connection status         |

## Sending Messages

Use the `relay_send` MCP tool:

```
relay_send(to: "AgentName", message: "Your message here")
```

### Direct Messages

```
relay_send(to: "Bob", message: "Can you review my code changes?")
```

### Broadcast to All

```
relay_send(to: "*", message: "I've finished the auth module")
```

### Channel Messages

```
relay_send(to: "#frontend", message: "The API endpoints are ready")
```

## Spawning & Releasing Agents

### Spawn a Worker

```
relay_spawn(name: "WorkerName", cli: "claude", task: "Task description here")
```

### CLI Options

| CLI Value | Description             |
| --------- | ----------------------- |
| `claude`  | Claude Code (Anthropic) |
| `codex`   | Codex CLI (OpenAI)      |
| `gemini`  | Gemini CLI (Google)     |
| `aider`   | Aider coding assistant  |
| `goose`   | Goose AI assistant      |

### Release a Worker

```
relay_release(name: "WorkerName")
```

## Receiving Messages

Messages appear as:

```
Relay message from Alice [abc123]: Content here
```

Channel messages include `[#channel]`:

```
Relay message from Alice [abc123] [#general]: Hello!
```

Reply to the channel shown, not the sender.

## When You Are Spawned

If you were spawned by another agent:

1. Your first message is your task from your spawner
2. Use `relay_send` to reply to your spawner
3. Report status to your spawner (your lead), not broadcast

```
relay_send(to: "Lead", message: "ACK: Starting on the task.")
```

## Protocol

- **ACK** when you receive a task: `ACK: Brief description`
- **DONE** when complete: `DONE: What was accomplished`
- Send status to your **lead**, not broadcast

## Agent Naming (Local vs Bridge)

**Local communication** uses plain agent names. The `project:` prefix is **ONLY** for cross-project bridge mode.

| Context                | Correct                                    | Incorrect                             |
| ---------------------- | ------------------------------------------ | ------------------------------------- |
| Local (same project)   | `relay_send(to: "Lead", ...)`              | `relay_send(to: "project:lead", ...)` |
| Bridge (cross-project) | `relay_send(to: "frontend:Designer", ...)` | N/A                                   |

## Checking Status

```
relay_who()      # List online agents
relay_inbox()    # Check for unread messages
relay_status()   # Check connection status
```
<!-- prpm:snippet:end @agent-relay/agent-relay-snippet@1.1.7 -->
