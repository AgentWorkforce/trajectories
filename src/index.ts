/**
 * Agent Trajectories
 *
 * Capture the complete "train of thought" of agent work as first-class artifacts.
 *
 * @packageDocumentation
 */

// Core
export {
  createTrajectory,
  addChapter,
  addEvent,
  addDecision,
  completeTrajectory,
  abandonTrajectory,
  TrajectoryError,
} from "./core/trajectory.js";

export {
  validateTrajectory,
  validateCreateInput,
  validateCompleteInput,
  TrajectorySchema,
  ChapterSchema,
  TrajectoryEventSchema,
  DecisionSchema,
  RetrospectiveSchema,
} from "./core/schema.js";

export {
  generateTrajectoryId,
  generateChapterId,
  isValidTrajectoryId,
  isValidChapterId,
} from "./core/id.js";

// Types
export type {
  Trajectory,
  Chapter,
  TrajectoryEvent,
  Decision,
  Retrospective,
  TaskReference,
  TaskSource,
  AgentParticipation,
  TrajectorySummary,
  TrajectoryStatus,
  TrajectoryEventType,
  EventSignificance,
  CreateTrajectoryInput,
  AddChapterInput,
  AddEventInput,
  CompleteTrajectoryInput,
  TrajectoryQuery,
} from "./core/types.js";

// Storage
export { FileStorage } from "./storage/file.js";
export type { StorageAdapter, StorageConfig } from "./storage/interface.js";

// Export
export { exportToMarkdown } from "./export/markdown.js";
export { exportToJSON } from "./export/json.js";
export type { JSONExportOptions } from "./export/json.js";
export { exportToTimeline } from "./export/timeline.js";
export { exportToPRSummary } from "./export/pr-summary.js";
export type { PRSummaryOptions } from "./export/pr-summary.js";
