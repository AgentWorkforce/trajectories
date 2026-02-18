# Trail

Record your work as a trajectory for future agents and humans to follow.

## Usage

If `trail` is installed globally, run commands directly:
```bash
trail start "Task description"
```

If not globally installed, use npx to run from local installation:
```bash
npx trail start "Task description"
```

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

## Why Trail?

Your trajectory helps others understand:
- **What** you built (commits show this)
- **Why** you built it this way (trajectory shows this)
- **What alternatives** you considered
- **What challenges** you faced

Future agents can query past trajectories to learn from your decisions.
