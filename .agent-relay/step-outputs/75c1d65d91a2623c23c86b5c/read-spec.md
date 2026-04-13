# trajectory-formatter.ts — Complete File

Write this file to `trail-viewer-server/src/trajectory-formatter.ts`.

```typescript
import type {
  Trajectory,
  Chapter,
  TrajectoryEvent,
  Decision,
  Alternative,
  Retrospective,
  AgentParticipation,
} from 'agent-trajectories/sdk';

// ── Helpers ──────────────────────────────────────────────────────────

function ts(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function eventTs(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function duration(start: string, end?: string): string | null {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function statusBadge(status: string): string {
  const badges: Record<string, string> = {
    active: '`[ACTIVE]`',
    completed: '` OMPLETED]`',
    abandoned: '`[ABANDONED]`',
  };
  return badges[status] ?? `\`[${status.toUpperCase()}]\``;
}

function isSignificant(event: TrajectoryEvent): boolean {
  // Keep events with significance >= medium (skip "low" and undefined defaults to include)
  if (!event.significance) return true;
  return event.significance !== 'low';
}

// ── Full Format ──────────────────────────────────────────────────────

/**
 * Formats a full trajectory as a structured markdown document
 * suitable for injecting into an agent's context.
 */
export function formatTrajectoryForAgent(trajectory: Trajectory): string {
  const lines: string[] = [];

  // 1. Title
  lines.push(`# ${trajectory.task.title}`);
  lines.push('');

  // 2. Status & metadata
  lines.push(`${statusBadge(trajectory.status)}  `);
  lines.push(`**ID:** ${trajectory.id}  `);
  lines.push(`**Started:** ${ts(trajectory.startedAt)}  `);
  if (trajectory.completedAt) {
    lines.push(`**Completed:** ${ts(trajectory.completedAt)}  `);
  }
  const dur = duration(trajectory.startedAt, trajectory.completedAt);
  if (dur) {
    lines.push(`**Duration:** ${dur}  `);
  }
  if (trajectory.task.description) {
    lines.push('');
    lines.push(`> ${trajectory.task.description}`);
  }
  lines.push('');

  // 3. Agents involved
  if (trajectory.agents.length > 0) {
    lines.push('## Agents');
    lines.push('');
    for (const agent of trajectory.agents) {
      lines.push(`- **${agent.name}** — ${agent.role}`);
    }
    lines.push('');
  }

  // 4. Chapters
  if (trajectory.chapters.length > 0) {
    for (const chapter of trajectory.chapters) {
      lines.push(`## ${chapter.title}`);
      lines.push('');
      lines.push(`*Agent: ${chapter.agentName}*`);
      const chapterDur = duration(chapter.startedAt, chapter.endedAt);
      if (chapterDur) {
        lines.push(`  (${chapterDur})`);
      }
      lines.push('');

      const keyEvents = chapter.events.filter(isSignificant);
      if (keyEvents.length > 0) {
        for (const event of keyEvents) {
          const sigTag =
            event.significance === 'critical'
              ? ' ** RITICAL]**'
              : event.significance === 'high'
                ? ' **[HIGH]**'
                : '';
          lines.push(
            `- \`${eventTs(event.ts)}\` ${event.content}${sigTag}`
          );
        }
        lines.push('');
      }
    }
  }

  // 5. Decisions
  const decisions = trajectory.retrospective?.decisions ?? [];
  if (decisions.length > 0) {
    lines.push('## Decisions');
    lines.push('');
    for (const decision of decisions) {
      lines.push(`### ${decision.question}`);
      lines.push('');
      lines.push(`**Chosen:** ${decision.chosen}`);
      lines.push('');
      lines.push(`**Reasoning:** ${decision.reasoning}`);
      lines.push('');
      if (decision.alternatives.length > 0) {
        lines.push('**Alternatives considered:**');
        for (const alt of decision.alternatives) {
          const reason = alt.reason ? ` — ${alt.reason}` : '';
          lines.push(`  - ${alt.option}${reason}`);
        }
        lines.push('');
      }
    }
  }

  // 6. Retrospective
  if (trajectory.retrospective) {
    const retro = trajectory.retrospective;
    lines.push('## Retrospective');
    lines.push('');
    lines.push(retro.summary);
    lines.push('');

    if (retro.learnings && retro.learnings.length > 0) {
      lines.push('### Lessons Learned');
      lines.push('');
      for (const lesson of retro.learnings) {
        lines.push(`- ${lesson}`);
      }
      lines.push('');
    }

    if (retro.suggestions && retro.suggestions.length > 0) {
      lines.push('### Recommendations');
      lines.push('');
      for (const rec of retro.suggestions) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    if (retro.challenges && retro.challenges.length > 0) {
      lines.push('### Challenges');
      lines.push('');
      for (const ch of retro.challenges) {
        lines.push(`- ${ch}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Brief Format ─────────────────────────────────────────────────────

/**
 * Returns a compact summary (~500 tokens) suitable for quick context injection.
 * Includes title, status, key decisions, and retrospective summary.
 */
export function formatTrajectoryBrief(trajectory: Trajectory): string {
  const lines: string[] = [];

  // Title + status
  lines.push(`# ${trajectory.task.title}`);
  lines.push('');
  lines.push(`${statusBadge(trajectory.status)}  `);
  const dur = duration(trajectory.startedAt, trajectory.completedAt);
  if (dur) {
    lines.push(`**Duration:** ${dur}  `);
  }
  lines.push('');

  // Key decisions (question + chosen only)
  const decisions = trajectory.retrospective?.decisions ?? [];
  if (decisions.length > 0) {
    lines.push('## Key Decisions');
    lines.push('');
    for (const d of decisions) {
      lines.push(`- **${d.question}** => ${d.chosen}`);
    }
    lines.push('');
  }

  // Retrospective summary
  if (trajectory.retrospective) {
    lines.push('## Summary');
    lines.push('');
    lines.push(trajectory.retrospective.summary);
    lines.push('');
  }

  return lines.join('\n');
}
```
