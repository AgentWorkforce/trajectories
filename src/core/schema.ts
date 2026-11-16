/**
 * Zod schemas for runtime validation of trajectory data
 *
 * These schemas validate input at system boundaries and ensure
 * data integrity when reading from storage.
 */

import { z } from "zod";

/**
 * Task source system schema
 */
export const TaskSourceSystemSchema = z.union([
  z.literal("beads"),
  z.literal("github"),
  z.literal("linear"),
  z.literal("jira"),
  z.literal("plain"),
  z.string(), // Allow custom systems
]);

/**
 * Task source schema
 */
export const TaskSourceSchema = z.object({
  system: TaskSourceSystemSchema,
  id: z.string().min(1, "Task ID is required"),
  url: z.url().optional(),
});

/**
 * Task reference schema
 */
export const TaskReferenceSchema = z.object({
  title: z
    .string()
    .min(1, "Trajectory title is required")
    .max(500, "Trajectory title must be 500 characters or less"),
  description: z.string().optional(),
  source: TaskSourceSchema.optional(),
});

/**
 * Trajectory status schema
 */
export const TrajectoryStatusSchema = z.enum([
  "active",
  "completed",
  "abandoned",
]);

/** Permissive on read so trajectories from other tools can load even with unknown event types. */
export const TrajectoryEventTypeSchema = z.union([
  z.literal("prompt"),
  z.literal("thinking"),
  z.literal("tool_call"),
  z.literal("tool_result"),
  z.literal("message_sent"),
  z.literal("message_received"),
  z.literal("decision"),
  z.literal("finding"),
  z.literal("learning"),
  z.literal("reflection"),
  z.literal("note"),
  z.literal("error"),
  z.literal("completion-evidence"),
  z.literal("completion-marker"),
  z.string(), // Allow event types emitted by other tools. Downstream code filters to known types.
]);

/**
 * Event significance schema
 */
export const EventSignificanceSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * Trajectory event schema
 */
export const TrajectoryEventSchema = z.object({
  ts: z.number().int().positive(),
  type: TrajectoryEventTypeSchema,
  content: z.string().min(1, "Event content is required"),
  raw: z.unknown().optional(),
  significance: EventSignificanceSchema.optional(),
  tags: z.array(z.string()).optional(),
  confidence: z
    .number()
    .min(0, "Confidence must be between 0 and 1")
    .max(1, "Confidence must be between 0 and 1")
    .optional(),
});

/**
 * Alternative schema for decision alternatives
 */
export const AlternativeSchema = z.object({
  option: z.string().min(1, "Alternative option is required"),
  reason: z.string().optional(),
});

/**
 * Decision schema
 * Note: alternatives supports both string[] (legacy) and Alternative[] (new)
 */
export const DecisionSchema = z.object({
  question: z.string().min(1, "Decision question is required"),
  chosen: z.string().min(1, "Chosen option is required"),
  alternatives: z.array(z.union([z.string(), AlternativeSchema])),
  reasoning: z.string().min(1, "Decision reasoning is required"),
  confidence: z
    .number()
    .min(0, "Confidence must be between 0 and 1")
    .max(1, "Confidence must be between 0 and 1")
    .optional(),
});

/**
 * Project learning schemas
 */
export const LearningSourceSchema = z.enum([
  "human-steer",
  "pr-feedback",
  "failed-attempt",
  "code-review",
  "other",
]);

export const LearningPromotionStatusSchema = z.enum([
  "archived",
  "pending_review",
]);

export const LearningSchema = z.object({
  summary: z.string().min(1, "Learning summary is required"),
  source: LearningSourceSchema,
  area: z.string().min(1, "Affected area is required"),
  evidence: z.string().min(1).optional(),
  recurrenceKey: z.string().min(1).optional(),
  promotionStatus: LearningPromotionStatusSchema,
});

/**
 * Agent participation schema
 */
export const AgentParticipationSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  role: z.string().min(1, "Agent role is required"),
  joinedAt: z.iso.datetime(),
  leftAt: z.iso.datetime().optional(),
});

/**
 * Chapter schema
 */
export const ChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Chapter title is required"),
  agentName: z.string().min(1, "Agent name is required"),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().optional(),
  events: z.array(TrajectoryEventSchema),
});

/**
 * Retrospective schema
 */
export const RetrospectiveSchema = z.object({
  summary: z.string().min(1, "Retrospective summary is required"),
  approach: z.string().min(1, "Approach description is required"),
  decisions: z.array(DecisionSchema).optional(),
  challenges: z.array(z.string()).optional(),
  learnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  confidence: z
    .number()
    .min(0, "Confidence must be between 0 and 1")
    .max(1, "Confidence must be between 0 and 1"),
  timeSpent: z.string().optional(),
});

// ============================================================================
// Agent Trace Schemas
// ============================================================================

/**
 * Trace range schema - represents a range of lines in a file
 */
export const TraceRangeSchema = z.object({
  start_line: z.number().int().positive("Start line must be positive"),
  end_line: z.number().int().positive("End line must be positive"),
  revision: z.string().optional(),
  content_hash: z.string().optional(),
});

/**
 * Contributor type schema
 * Follows agent-trace.dev specification
 */
export const ContributorTypeSchema = z.enum([
  "human",
  "ai",
  "mixed",
  "unknown",
]);

/**
 * Trace contributor schema
 * model_id follows models.dev convention (e.g., 'anthropic/claude-opus-4-5-20251101')
 */
export const TraceContributorSchema = z.object({
  type: ContributorTypeSchema,
  model_id: z.string().max(250).optional(),
});

/**
 * Trace conversation schema
 */
export const TraceConversationSchema = z.object({
  contributor: TraceContributorSchema,
  url: z.url().optional(),
  ranges: z.array(TraceRangeSchema),
});

/**
 * Trace file schema
 */
export const TraceFileSchema = z.object({
  path: z.string().min(1, "File path is required"),
  conversations: z.array(TraceConversationSchema),
});

/**
 * Trace record schema - the main trace type
 * Follows agent-trace.dev specification v0.1.0
 */
export const TraceRecordSchema = z.object({
  version: z.string().min(1, "Version is required"),
  id: z.string().min(1, "Trace ID is required"),
  timestamp: z.iso.datetime(),
  trajectory: z.string().optional(),
  files: z.array(TraceFileSchema),
});

/**
 * Trajectory trace reference schema
 */
export const TrajectoryTraceRefSchema = z.object({
  startRef: z.string().min(1, "Start ref is required"),
  endRef: z.string().optional(),
  traceId: z.string().optional(),
});

/**
 * Full trajectory schema
 */
export const TrajectorySchema = z.object({
  id: z.string().regex(/^traj_[a-z0-9_]+$/, "Invalid trajectory ID format"),
  version: z.literal(1),
  task: TaskReferenceSchema,
  status: TrajectoryStatusSchema,
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  agents: z.array(AgentParticipationSchema),
  chapters: z.array(ChapterSchema),
  retrospective: RetrospectiveSchema.optional(),
  commits: z.array(z.string()).default([]),
  filesChanged: z.array(z.string()).default([]),
  projectId: z.string().optional(),
  workflowId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  _trace: TrajectoryTraceRefSchema.optional(),
});

/**
 * Create trajectory input schema
 */
export const CreateTrajectoryInputSchema = z.object({
  title: z
    .string()
    .min(1, "Trajectory title is required")
    .max(500, "Trajectory title must be 500 characters or less"),
  description: z.string().optional(),
  source: TaskSourceSchema.optional(),
  projectId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Add chapter input schema
 */
export const AddChapterInputSchema = z.object({
  title: z.string().min(1, "Chapter title is required"),
  agentName: z.string().min(1, "Agent name is required"),
});

/**
 * Add event input schema
 */
export const AddEventInputSchema = z.object({
  type: TrajectoryEventTypeSchema,
  content: z.string().min(1, "Event content is required"),
  raw: z.unknown().optional(),
  significance: EventSignificanceSchema.optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Complete trajectory input schema
 */
export const CompleteTrajectoryInputSchema = z.object({
  summary: z.string().min(1, "Retrospective summary is required"),
  approach: z.string().min(1, "Approach description is required"),
  decisions: z.array(DecisionSchema).optional(),
  challenges: z.array(z.string()).optional(),
  learnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  confidence: z
    .number()
    .min(0, "Confidence must be between 0 and 1")
    .max(1, "Confidence must be between 0 and 1"),
});

/**
 * Trajectory query schema
 */
export const TrajectoryQuerySchema = z.object({
  status: TrajectoryStatusSchema.optional(),
  since: z.iso.datetime().optional(),
  until: z.iso.datetime().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  sortBy: z.enum(["startedAt", "completedAt", "title"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/**
 * Validate a trajectory object
 * @param data - The data to validate
 * @returns Validation result with success flag and errors
 */
export function validateTrajectory(data: unknown): {
  success: boolean;
  data?: z.infer<typeof TrajectorySchema>;
  errors?: z.ZodError;
} {
  const result = TrajectorySchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate create trajectory input
 */
export function validateCreateInput(data: unknown): {
  success: boolean;
  data?: z.infer<typeof CreateTrajectoryInputSchema>;
  errors?: z.ZodError;
} {
  const result = CreateTrajectoryInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate complete trajectory input
 */
export function validateCompleteInput(data: unknown): {
  success: boolean;
  data?: z.infer<typeof CompleteTrajectoryInputSchema>;
  errors?: z.ZodError;
} {
  const result = CompleteTrajectoryInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

// Type exports inferred from schemas
export type TaskSourceSchema = z.infer<typeof TaskSourceSchema>;
export type TaskReferenceSchema = z.infer<typeof TaskReferenceSchema>;
export type TrajectoryEventSchema = z.infer<typeof TrajectoryEventSchema>;
export type ChapterSchema = z.infer<typeof ChapterSchema>;
export type RetrospectiveSchema = z.infer<typeof RetrospectiveSchema>;
export type TrajectorySchemaType = z.infer<typeof TrajectorySchema>;
export type TraceRangeSchemaType = z.infer<typeof TraceRangeSchema>;
export type TraceContributorSchemaType = z.infer<typeof TraceContributorSchema>;
export type TraceConversationSchemaType = z.infer<
  typeof TraceConversationSchema
>;
export type TraceFileSchemaType = z.infer<typeof TraceFileSchema>;
export type TraceRecordSchemaType = z.infer<typeof TraceRecordSchema>;
export type TrajectoryTraceRefSchemaType = z.infer<
  typeof TrajectoryTraceRefSchema
>;
