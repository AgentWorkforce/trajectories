/**
 * Timeline export for trajectories
 *
 * Generates a chronological Linear-style view.
 */

import type { Trajectory } from "../core/types.js";

/**
 * Export a trajectory to timeline format
 * @param trajectory - The trajectory to export
 * @returns Timeline string
 */
export function exportToTimeline(trajectory: Trajectory): string {
  const lines: string[] = [];

  // Start marker
  lines.push(`● ${formatTime(trajectory.startedAt)}  Started: ${trajectory.task.title}`);
  lines.push("│");

  // Chapters and events
  for (const chapter of trajectory.chapters) {
    lines.push(`├─ ${formatTime(chapter.startedAt)}  Chapter: ${chapter.title}`);
    lines.push(`│         Agent: ${chapter.agentName}`);
    lines.push("│");

    for (const event of chapter.events) {
      const prefix = event.type === "decision" ? "├─ Decision: " : "├─ ";
      const timeStr = formatTime(new Date(event.ts).toISOString());

      if (event.type === "decision") {
        lines.push(`│  ${timeStr}  ${prefix}${event.content}`);
      } else if (
        event.significance === "high" ||
        event.significance === "critical"
      ) {
        lines.push(`│  ${timeStr}  ${prefix}${event.content}`);
      }
    }

    if (chapter.endedAt) {
      lines.push("│");
    }
  }

  // End marker
  if (trajectory.completedAt) {
    const status = trajectory.status === "completed" ? "Completed" : "Abandoned";
    lines.push(`○ ${formatTime(trajectory.completedAt)}  ${status}`);

    if (trajectory.retrospective) {
      lines.push("");
      lines.push("  Summary: " + trajectory.retrospective.summary);
      lines.push(
        `  Confidence: ${Math.round(trajectory.retrospective.confidence * 100)}%`
      );
    }
  }

  return lines.join("\n");
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
