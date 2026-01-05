/**
 * JSON export for trajectories
 */

import type { Trajectory } from "../core/types.js";

export interface JSONExportOptions {
  /** Output compact JSON without formatting */
  compact?: boolean;
}

/**
 * Export a trajectory to JSON format
 * @param trajectory - The trajectory to export
 * @param options - Export options
 * @returns JSON string
 */
export function exportToJSON(
  trajectory: Trajectory,
  options?: JSONExportOptions,
): string {
  if (options?.compact) {
    return JSON.stringify(trajectory);
  }
  return JSON.stringify(trajectory, null, 2);
}
