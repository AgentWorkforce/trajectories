import type { CompactedTrajectory, LLMCompactedOutput } from "./parser.js";

export function generateCompactionMarkdown(
  compacted: CompactedTrajectory & LLMCompactedOutput,
): string {
  const dateRange = `${formatDate(compacted.dateRange.start)} - ${formatDate(compacted.dateRange.end)}`;
  const agents =
    compacted.summary.uniqueAgents.length > 0
      ? compacted.summary.uniqueAgents.join(", ")
      : "None";
  const decisionRows =
    compacted.decisions.length > 0
      ? compacted.decisions
          .map(
            (decision) =>
              `| ${escapeTableCell(decision.question)} | ${escapeTableCell(decision.chosen)} | ${escapeTableCell(decision.impact)} |`,
          )
          .join("\n")
      : "| None identified |  |  |";
  const conventions =
    compacted.conventions.length > 0
      ? compacted.conventions
          .map(
            (convention) =>
              `- **${convention.pattern || "Unnamed pattern"}**: ${convention.rationale || "No rationale captured."} (scope: ${convention.scope || "unspecified"})`,
          )
          .join("\n")
      : "- None established.";
  const lessons =
    compacted.lessons.length > 0
      ? compacted.lessons
          .map((lesson) => {
            const context = lesson.context ? ` (${lesson.context})` : "";
            const recommendation = lesson.recommendation
              ? ` - ${lesson.recommendation}`
              : "";
            return `- ${lesson.lesson}${context}${recommendation}`;
          })
          .join("\n")
      : "- None captured.";
  const openQuestions =
    compacted.openQuestions.length > 0
      ? compacted.openQuestions.map((question) => `- ${question}`).join("\n")
      : "- None.";

  return [
    `# Trajectory Compaction: ${dateRange}`,
    "",
    "## Summary",
    compacted.narrative || "No narrative available.",
    "",
    `## Key Decisions (${compacted.decisions.length})`,
    "| Question | Decision | Impact |",
    "|----------|----------|--------|",
    decisionRows,
    "",
    "## Conventions Established",
    conventions,
    "",
    "## Lessons Learned",
    lessons,
    "",
    "## Open Questions",
    openQuestions,
    "",
    "## Stats",
    `- Sessions: ${compacted.sourceTrajectories.length}, Agents: ${agents}, Files: ${compacted.filesAffected.length}, Commits: ${compacted.commits.length}`,
    `- Date range: ${compacted.dateRange.start} - ${compacted.dateRange.end}`,
  ].join("\n");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
