<!-- prpm:snippet:start @agent-relay/agent-relay-snippet@1.0.2 -->
# Agent Relay

Real-time agent-to-agent messaging. Output `->relay:` patterns to communicate.

## Sending Messages

**Always use the fenced format** for reliable message delivery:

```
->relay:AgentName <<<
Your message here.>>>
```

```
->relay:* <<<
Broadcast to all agents.>>>
```

**CRITICAL:** Always close multi-line messages with `>>>` on its own line!

## Communication Protocol

**ACK immediately** - When you receive a task, acknowledge it before starting work:

```
->relay:Sender <<<
ACK: Brief description of task received>>>
```

Then proceed with your work. This confirms message delivery and lets the sender know you're on it.

**Report completion** - When done, send a completion message:

```
->relay:Sender <<<
DONE: Brief summary of what was completed>>>
```

## Receiving Messages

Messages appear as:
```
Relay message from Alice [abc123]: Message content here
```

### Channel Routing (Important!)

Messages from #general (broadcast channel) include a `[#general]` indicator:
```
Relay message from Alice [abc123] [#general]: Hello everyone!
```

**When you see `[#general]`**: Reply to `*` (broadcast), NOT to the sender directly.

```
# Correct - responds to #general channel
->relay:* <<<
Response to the group message.>>>

# Wrong - sends as DM to sender instead of to the channel
->relay:Alice <<<
Response to the group message.>>>
```

This ensures your response appears in the same channel as the original message.

If truncated, read full message:
```bash
agent-relay read abc123
```

## Spawning Agents

Spawn workers to delegate tasks:

```
->relay:spawn WorkerName claude "task description"
->relay:release WorkerName
```

## Threads

Use threads to group related messages together. Thread syntax:

```
->relay:AgentName [thread:topic-name] <<<
Your message here.>>>
```

**When to use threads:**
- Working on a specific issue (e.g., `[thread:agent-relay-299]`)
- Back-and-forth discussions with another agent
- Code review conversations
- Any multi-message topic you want grouped

**Examples:**

```
->relay:Protocol [thread:auth-feature] <<<
How should we handle token refresh?>>>

->relay:Frontend [thread:auth-feature] <<<
Use a 401 interceptor that auto-refreshes.>>>

->relay:Reviewer [thread:pr-123] <<<
Please review src/auth/*.ts>>>

->relay:Developer [thread:pr-123] <<<
LGTM, approved!>>>
```

Thread messages appear grouped in the dashboard with reply counts.

## Common Patterns

```
->relay:Lead <<<
ACK: Starting /api/register implementation>>>

->relay:* <<<
STATUS: Working on auth module>>>

->relay:Lead <<<
DONE: Auth module complete>>>

->relay:Developer <<<
TASK: Implement /api/register>>>

->relay:Reviewer [thread:code-review-auth] <<<
REVIEW: Please check src/auth/*.ts>>>

->relay:Architect <<<
QUESTION: JWT or sessions?>>>
```

## Rules

- Pattern must be at line start (whitespace OK)
- Escape with `\->relay:` to output literally
- Check daemon status: `agent-relay status`
<!-- prpm:snippet:end @agent-relay/agent-relay-snippet@1.0.2 -->
<!-- PRPM_MANIFEST_START -->

<skills_system priority="1">
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills (loaded into main context):
- Use the <path> from the skill entry below
- Invoke: Bash("cat <path>")
- The skill content will load into your current context
- Example: Bash("cat .openskills/backend-architect/SKILL.md")

Usage notes:
- Skills share your context window
- Do not invoke a skill that is already loaded in your context
</usage>

<available_skills>

<skill activation="lazy">
<name>prpm-json-best-practices-skill</name>
<description>Best practices for structuring prpm.json package manifests with required fields, tags, organization, and multi-package management</description>
<path>.openskills/prpm-json-best-practices-skill/SKILL.md</path>
</skill>

</available_skills>
</skills_system>

<!-- PRPM_MANIFEST_END -->
