/**
 * Markdown export for trajectories
 *
 * Generates human-readable Notion-style documentation.
 */

import type { Decision, Trajectory } from "../core/types.js";

/**
 * Export a trajectory to markdown format
 * @param trajectory - The trajectory to export
 * @returns Markdown string
 */
export function exportToMarkdown(trajectory: Trajectory): string {
  const lines: string[] = [];

  // Title
  lines.push(`# Trajectory: ${trajectory.task.title}`);
  lines.push("");

  // Metadata block
  lines.push(`> **Status:** ${formatStatus(trajectory.status)}`);
  if (trajectory.task.source) {
    const linkText = trajectory.task.source.url
      ? `[${trajectory.task.source.id}](${trajectory.task.source.url})`
      : trajectory.task.source.id;
    lines.push(`> **Task:** ${linkText}`);
  }
  if (trajectory.retrospective?.confidence !== undefined) {
    lines.push(
      `> **Confidence:** ${Math.round(trajectory.retrospective.confidence * 100)}%`,
    );
  }
  lines.push(`> **Started:** ${formatDate(trajectory.startedAt)}`);
  if (trajectory.completedAt) {
    lines.push(`> **Completed:** ${formatDate(trajectory.completedAt)}`);
  }
  lines.push("");

  // Summary (from retrospective)
  if (trajectory.retrospective) {
    lines.push("---");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(trajectory.retrospective.summary);
    lines.push("");

    if (trajectory.retrospective.approach) {
      lines.push(`**Approach:** ${trajectory.retrospective.approach}`);
      lines.push("");
    }
  }

  // Key Decisions
  const decisions = extractDecisions(trajectory);
  if (decisions.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Key Decisions");
    lines.push("");

    for (const decision of decisions) {
      lines.push(`### ${decision.question}`);
      lines.push(`- **Chose:** ${decision.chosen}`);
      if (decision.alternatives.length > 0) {
        const altStrings = decision.alternatives.map((a) =>
          typeof a === "string" ? a : a.option,
        );
        lines.push(`- **Rejected:** ${altStrings.join(", ")}`);
      }
      lines.push(`- **Reasoning:** ${decision.reasoning}`);
      lines.push("");
    }
  }

  // Chapters
  if (trajectory.chapters.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Chapters");
    lines.push("");

    trajectory.chapters.forEach((chapter, index) => {
      lines.push(`### ${index + 1}. ${chapter.title}`);
      lines.push(`*Agent: ${chapter.agentName}*`);
      lines.push("");

      if (chapter.events.length > 0) {
        const significantEvents = chapter.events.filter(
          (e) =>
            e.significance === "high" ||
            e.significance === "critical" ||
            e.type === "decision",
        );
        if (significantEvents.length > 0) {
          for (const event of significantEvents) {
            lines.push(`- ${event.content}`);
          }
          lines.push("");
        }
      }
    });
  }

  // Challenges
  if (
    trajectory.retrospective?.challenges &&
    trajectory.retrospective.challenges.length > 0
  ) {
    lines.push("---");
    lines.push("");
    lines.push("## Challenges");
    lines.push("");
    for (const challenge of trajectory.retrospective.challenges) {
      lines.push(`- ${challenge}`);
    }
    lines.push("");
  }

  // Learnings
  if (
    trajectory.retrospective?.learnings &&
    trajectory.retrospective.learnings.length > 0
  ) {
    lines.push("---");
    lines.push("");
    lines.push("## Learnings");
    lines.push("");
    for (const learning of trajectory.retrospective.learnings) {
      lines.push(`- ${learning}`);
    }
    lines.push("");
  }

  // Suggestions
  if (
    trajectory.retrospective?.suggestions &&
    trajectory.retrospective.suggestions.length > 0
  ) {
    lines.push("---");
    lines.push("");
    lines.push("## Suggestions");
    lines.push("");
    for (const suggestion of trajectory.retrospective.suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push("");
  }

  // Artifacts
  if (trajectory.commits.length > 0 || trajectory.filesChanged.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Artifacts");
    lines.push("");
    if (trajectory.commits.length > 0) {
      lines.push(`**Commits:** ${trajectory.commits.join(", ")}`);
    }
    if (trajectory.filesChanged.length > 0) {
      lines.push(`**Files changed:** ${trajectory.filesChanged.length}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Helper functions

function formatStatus(status: string): string {
  switch (status) {
    case "active":
      return "🔄 Active";
    case "completed":
      return "✅ Completed";
    case "abandoned":
      return "❌ Abandoned";
    default:
      return status;
  }
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractDecisions(trajectory: Trajectory): Decision[] {
  const decisions: Decision[] = [];

  // From retrospective
  if (trajectory.retrospective?.decisions) {
    decisions.push(...trajectory.retrospective.decisions);
  }

  // From events
  for (const chapter of trajectory.chapters) {
    for (const event of chapter.events) {
      if (event.type === "decision" && event.raw) {
        const raw = event.raw as Decision;
        if (raw.question && raw.chosen && raw.reasoning) {
          // Avoid duplicates
          if (!decisions.some((d) => d.question === raw.question)) {
            decisions.push(raw);
          }
        }
      }
    }
  }

  return decisions;
}
