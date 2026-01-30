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
  url: z.string().url().optional(),
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

/**
 * Event type schema
 */
export const TrajectoryEventTypeSchema = z.enum([
  "prompt",
  "thinking",
  "tool_call",
  "tool_result",
  "message_sent",
  "message_received",
  "decision",
  "finding",
  "note",
  "error",
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
 * Agent participation schema
 */
export const AgentParticipationSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  role: z.enum(["lead", "contributor", "reviewer"]),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().optional(),
});

/**
 * Chapter schema
 */
export const ChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Chapter title is required"),
  agentName: z.string().min(1, "Agent name is required"),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
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
 */
export const ContributorTypeSchema = z.enum(["human", "agent"]);

/**
 * Trace contributor schema
 */
export const TraceContributorSchema = z.object({
  type: ContributorTypeSchema,
  model: z.string().optional(),
});

/**
 * Trace conversation schema
 */
export const TraceConversationSchema = z.object({
  contributor: TraceContributorSchema,
  url: z.string().url().optional(),
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
 */
export const TraceRecordSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^trace_[a-z0-9]+$/, "Invalid trace ID format"),
  timestamp: z.string().datetime(),
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
  id: z.string().regex(/^traj_[a-z0-9]+$/, "Invalid trajectory ID format"),
  version: z.literal(1),
  task: TaskReferenceSchema,
  status: TrajectoryStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  agents: z.array(AgentParticipationSchema),
  chapters: z.array(ChapterSchema),
  retrospective: RetrospectiveSchema.optional(),
  commits: z.array(z.string()),
  filesChanged: z.array(z.string()),
  projectId: z.string(),
  tags: z.array(z.string()),
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
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
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
