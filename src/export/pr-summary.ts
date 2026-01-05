/**
 * PR Summary export for trajectories
 *
 * Generates a concise summary suitable for pull request descriptions.
 */

import type { Trajectory } from "../core/types.js";

export interface PRSummaryOptions {
  /** Path to the full trajectory file for linking */
  trajectoryPath?: string;
}

/**
 * Export a trajectory to PR summary format
 * @param trajectory - The trajectory to export
 * @param options - Export options
 * @returns PR summary markdown string
 */
export function exportToPRSummary(
  trajectory: Trajectory,
  options?: PRSummaryOptions,
): string {
  const lines: string[] = [];

  lines.push("## Trajectory Summary");
  lines.push("");

  // Summary
  if (trajectory.retrospective?.summary) {
    lines.push(trajectory.retrospective.summary);
    lines.push("");
  }

  // Key metrics
  const decisionCount = trajectory.chapters.reduce(
    (count, chapter) =>
      count + chapter.events.filter((e) => e.type === "decision").length,
    0,
  );

  lines.push(`**Key decisions:** ${decisionCount}`);

  if (trajectory.retrospective?.confidence !== undefined) {
    lines.push(
      `**Confidence:** ${Math.round(trajectory.retrospective.confidence * 100)}%`,
    );
  }

  // Link to full trajectory
  if (options?.trajectoryPath) {
    lines.push("");
    lines.push(`[Full trajectory](${options.trajectoryPath})`);
  }

  return lines.join("\n");
}
