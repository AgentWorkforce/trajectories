/**
 * Agent Trajectories SDK
 *
 * A high-level SDK for programmatically creating and managing agent trajectories.
 *
 * @example
 * ```typescript
 * // Using the client for persistent storage
 * import { TrajectoryClient } from 'agent-trajectories/sdk';
 *
 * const client = new TrajectoryClient({ defaultAgent: 'my-agent' });
 * await client.init();
 *
 * const session = await client.start('Implement feature X');
 * await session.chapter('Research').note('Found documentation');
 * await session.done('Feature implemented', 0.9);
 * ```
 *
 * @example
 * ```typescript
 * // Using the builder for in-memory trajectories
 * import { trajectory } from 'agent-trajectories/sdk';
 *
 * const result = trajectory('Fix bug')
 *   .chapter('Investigation', 'claude')
 *   .finding('Found the issue')
 *   .done('Bug fixed', 0.95);
 * ```
 *
 * @packageDocumentation
 */

// Client (with storage)
export { TrajectoryClient, TrajectorySession } from "./client.js";
export type { TrajectoryClientOptions } from "./client.js";

// Builder (in-memory)
export { TrajectoryBuilder, trajectory } from "./builder.js";

// Re-export commonly needed types for convenience
export type {
  Trajectory,
  Chapter,
  TrajectoryEvent,
  Decision,
  Alternative,
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
  Finding,
  FindingCategory,
} from "../core/types.js";

// Re-export error class
export { TrajectoryError } from "../core/trajectory.js";

// Re-export storage interfaces for custom implementations
export type { StorageAdapter, StorageConfig } from "../storage/interface.js";
export { FileStorage } from "../storage/file.js";

// Re-export validation utilities
export {
  validateTrajectory,
  validateCreateInput,
  validateCompleteInput,
  TrajectorySchema,
} from "../core/schema.js";
