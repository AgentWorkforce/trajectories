/**
 * Serialize trajectories into a compact, model-readable text format.
 */

import type { Decision, Trajectory, TrajectoryEvent } from "../core/types.js";

const MAX_DECISIONS = 6;
const MAX_EVENTS = 10;
const MAX_FILES = 20;
const MAX_COMMITS = 12;
const MAX_FINDINGS = 6;

/**
 * Convert trajectories into a concise plain-text representation suitable for
 * LLM summarization.
 */
export function serializeTrajectories(trajectories: Trajectory[]): string {
  return trajectories
    .map((trajectory, index) => serializeTrajectory(trajectory, index))
    .join("\n\n---\n\n");
}

function serializeTrajectory(trajectory: Trajectory, index: number): string {
  const lines: string[] = [];
  const decisions = extractDecisions(trajectory);
  const events = selectKeyEvents(trajectory);
  const findings = extractFindings(trajectory);

  lines.push(`## Trajectory ${index + 1}`);
  lines.push(`Trajectory ID: ${trajectory.id}`);
  lines.push(`Title: ${sanitizeInline(trajectory.task.title)}`);
  lines.push(`Status: ${trajectory.status}`);
  lines.push(
    `Date Range: ${formatDateRange(trajectory.startedAt, trajectory.completedAt)}`,
  );
  lines.push(`Agents: ${formatAgents(trajectory) || "None recorded"}`);

  if (trajectory.task.description) {
    lines.push(
      `Task Description: ${truncate(sanitizeInline(trajectory.task.description), 220)}`,
    );
  }

  if (trajectory.retrospective?.summary) {
    lines.push(
      `Retrospective Summary: ${truncate(sanitizeInline(trajectory.retrospective.summary), 260)}`,
    );
  }

  if (trajectory.retrospective?.approach) {
    lines.push(
      `Approach: ${truncate(sanitizeInline(trajectory.retrospective.approach), 220)}`,
    );
  }

  lines.push("Decisions:");
  if (decisions.length === 0) {
    lines.push("- None recorded");
  } else {
    for (const decision of decisions.slice(0, MAX_DECISIONS)) {
      lines.push(
        `- Question: ${truncate(sanitizeInline(decision.question), 160)}`,
      );
      lines.push(`  Chosen: ${truncate(sanitizeInline(decision.chosen), 140)}`);
      lines.push(
        `  Reasoning: ${truncate(sanitizeInline(decision.reasoning), 220)}`,
      );
    }
    appendOverflowLine(lines, decisions.length, MAX_DECISIONS, "decisions");
  }

  lines.push("Key Events:");
  if (events.length === 0) {
    lines.push("- None recorded");
  } else {
    for (const event of events.slice(0, MAX_EVENTS)) {
      lines.push(`- ${event}`);
    }
    appendOverflowLine(lines, events.length, MAX_EVENTS, "events");
  }

  if (findings.length > 0) {
    lines.push("Findings:");
    for (const finding of findings.slice(0, MAX_FINDINGS)) {
      lines.push(`- ${finding}`);
    }
    appendOverflowLine(lines, findings.length, MAX_FINDINGS, "findings");
  }

  lines.push("Files Changed:");
  if (trajectory.filesChanged.length === 0) {
    lines.push("- None recorded");
  } else {
    for (const file of trajectory.filesChanged.slice(0, MAX_FILES)) {
      lines.push(`- ${file}`);
    }
    appendOverflowLine(
      lines,
      trajectory.filesChanged.length,
      MAX_FILES,
      "files",
    );
  }

  lines.push("Commits:");
  if (trajectory.commits.length === 0) {
    lines.push("- None recorded");
  } else {
    for (const commit of trajectory.commits.slice(0, MAX_COMMITS)) {
      lines.push(`- ${commit}`);
    }
    appendOverflowLine(
      lines,
      trajectory.commits.length,
      MAX_COMMITS,
      "commits",
    );
  }

  return lines.join("\n");
}

function extractDecisions(trajectory: Trajectory): Decision[] {
  const decisions: Decision[] = [];
  const seen = new Set<string>();

  for (const decision of trajectory.retrospective?.decisions || []) {
    const key = `${decision.question}\u0000${decision.chosen}`;
    if (!seen.has(key)) {
      decisions.push(decision);
      seen.add(key);
    }
  }

  for (const chapter of trajectory.chapters) {
    for (const event of chapter.events) {
      if (event.type !== "decision" || !event.raw) {
        continue;
      }

      const decision = event.raw as Decision;
      if (!decision.question || !decision.chosen || !decision.reasoning) {
        continue;
      }

      const key = `${decision.question}\u0000${decision.chosen}`;
      if (!seen.has(key)) {
        decisions.push(decision);
        seen.add(key);
      }
    }
  }

  return decisions;
}

function selectKeyEvents(trajectory: Trajectory): string[] {
  const selected: Array<{ ts: number; content: string }> = [];

  for (const chapter of trajectory.chapters) {
    for (const event of chapter.events) {
      if (!shouldIncludeEvent(event)) {
        continue;
      }

      const label = [
        chapter.title ? `[${sanitizeInline(chapter.title)}]` : "",
        `${event.type}:`,
        truncate(sanitizeInline(event.content), 180),
      ]
        .filter(Boolean)
        .join(" ");

      selected.push({
        ts: event.ts,
        content: label,
      });
    }
  }

  selected.sort((a, b) => a.ts - b.ts);
  return selected.map((event) => event.content);
}

function shouldIncludeEvent(event: TrajectoryEvent): boolean {
  if (
    event.type === "decision" ||
    event.type === "finding" ||
    event.type === "error"
  ) {
    return true;
  }

  if (event.type === "reflection" || event.type === "note") {
    return true;
  }

  return event.significance === "high" || event.significance === "critical";
}

function extractFindings(trajectory: Trajectory): string[] {
  const findings = new Set<string>();

  for (const chapter of trajectory.chapters) {
    for (const event of chapter.events) {
      if (event.type === "finding" && event.content.trim()) {
        findings.add(truncate(sanitizeInline(event.content), 180));
      }
    }
  }

  return [...findings];
}

function formatAgents(trajectory: Trajectory): string {
  return trajectory.agents
    .map((agent) => `${agent.name} (${agent.role})`)
    .join(", ");
}

function formatDateRange(startedAt: string, completedAt?: string): string {
  const end = completedAt || "in progress";
  return `${startedAt} -> ${end}`;
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function sanitizeInline(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function appendOverflowLine(
  lines: string[],
  total: number,
  displayed: number,
  label: string,
): void {
  const overflow = total - displayed;
  if (overflow > 0) {
    lines.push(`- ... ${overflow} more ${label}`);
  }
}
