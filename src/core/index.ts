/**
 * Core module exports
 */

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
  // Trace types
  TraceRecord,
  TraceFile,
  TraceRange,
  TraceConversation,
  TraceContributor,
  ContributorType,
  TrajectoryTraceRef,
} from "./types.js";

// Schemas and validation
export {
  TrajectorySchema,
  ChapterSchema,
  TrajectoryEventSchema,
  DecisionSchema,
  RetrospectiveSchema,
  validateTrajectory,
  validateCreateInput,
  validateCompleteInput,
} from "./schema.js";

// ID generation
export {
  generateTrajectoryId,
  generateChapterId,
  isValidTrajectoryId,
  isValidChapterId,
} from "./id.js";

// Trajectory operations (to be implemented)
export {
  createTrajectory,
  addChapter,
  addEvent,
  addDecision,
  completeTrajectory,
  abandonTrajectory,
} from "./trajectory.js";

// Trace operations
export {
  isGitRepo,
  getGitHead,
  captureGitState,
  generateTrace,
  createTraceRef,
  detectModel,
  generateTraceId,
} from "./trace.js";
