/**
 * Markdown rendering for compacted trajectories.
 */

import type { CompactedTrajectory } from "./parser.js";

const MAX_DECISIONS_PER_GROUP = 5;
const MAX_FILES = 20;
const MAX_LEARNINGS = 10;
const MAX_FINDINGS = 10;

/**
 * Generate a readable markdown summary for a compacted trajectory.
 */
export function generateMarkdownSummary(
  compacted: CompactedTrajectory,
): string {
  const lines: string[] = [];

  lines.push(`# Compacted Trajectory ${compacted.id}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Compacted At: ${formatDate(compacted.compactedAt)}`);
  lines.push(`- Source Trajectories: ${compacted.sourceTrajectories.length}`);
  lines.push(
    `- Date Range: ${formatDate(compacted.dateRange.start)} to ${formatDate(compacted.dateRange.end)}`,
  );
  lines.push(`- Total Decisions: ${compacted.summary.totalDecisions}`);
  lines.push(`- Total Events: ${compacted.summary.totalEvents}`);
  lines.push(
    `- Agents: ${compacted.summary.uniqueAgents.join(", ") || "None recorded"}`,
  );
  lines.push("");

  lines.push("## Decision Groups");
  lines.push("");
  if (compacted.decisionGroups.length === 0) {
    lines.push("- None recorded");
    lines.push("");
  } else {
    for (const group of compacted.decisionGroups) {
      lines.push(
        `### ${capitalize(group.category)} (${group.decisions.length})`,
      );
      lines.push("");

      for (const decision of group.decisions.slice(
        0,
        MAX_DECISIONS_PER_GROUP,
      )) {
        lines.push(`- Question: ${decision.question}`);
        lines.push(`  Chosen: ${decision.chosen}`);
        lines.push(`  Reasoning: ${decision.reasoning}`);
        lines.push(`  Source: ${decision.fromTrajectory}`);
      }

      const overflow = group.decisions.length - MAX_DECISIONS_PER_GROUP;
      if (overflow > 0) {
        lines.push(`- ... ${overflow} more decisions`);
      }

      lines.push("");
    }
  }

  lines.push("## Key Learnings");
  lines.push("");
  appendStringList(lines, compacted.keyLearnings, MAX_LEARNINGS);
  lines.push("");

  lines.push("## Key Findings");
  lines.push("");
  appendStringList(lines, compacted.keyFindings, MAX_FINDINGS);
  lines.push("");

  lines.push("## Files Affected");
  lines.push("");
  appendStringList(lines, compacted.filesAffected, MAX_FILES);
  lines.push("");

  if (compacted.commits.length > 0) {
    lines.push("## Commits");
    lines.push("");
    appendStringList(lines, compacted.commits, MAX_FILES);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function appendStringList(
  lines: string[],
  values: string[],
  limit: number,
): void {
  if (values.length === 0) {
    lines.push("- None recorded");
    return;
  }

  for (const value of values.slice(0, limit)) {
    lines.push(`- ${value}`);
  }

  const overflow = values.length - limit;
  if (overflow > 0) {
    lines.push(`- ... ${overflow} more`);
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
