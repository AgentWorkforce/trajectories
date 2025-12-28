/**
 * Core type definitions for Agent Trajectories
 *
 * These types define the shape of all trajectory data.
 * They are used for TypeScript type checking and documentation.
 * Runtime validation is handled by Zod schemas in schema.ts.
 */

/**
 * Supported task source systems
 */
export type TaskSourceSystem =
  | "beads"
  | "github"
  | "linear"
  | "jira"
  | "plain"
  | string;

/**
 * Reference to an external task/issue
 */
export interface TaskSource {
  /** The task management system (e.g., 'github', 'linear') */
  system: TaskSourceSystem;
  /** The external ID (e.g., 'GH#123', 'ENG-456') */
  id: string;
  /** Optional URL to the external task */
  url?: string;
}

/**
 * Task reference - either standalone or linked to external system
 */
export interface TaskReference {
  /** Human-readable task title */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional link to external task system */
  source?: TaskSource;
}

/**
 * Trajectory status
 */
export type TrajectoryStatus = "active" | "completed" | "abandoned";

/**
 * Event types that can be recorded in a trajectory
 */
export type TrajectoryEventType =
  | "prompt"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "message_sent"
  | "message_received"
  | "decision"
  | "note"
  | "error";

/**
 * Significance level for events
 */
export type EventSignificance = "low" | "medium" | "high" | "critical";

/**
 * A single event in the trajectory timeline
 */
export interface TrajectoryEvent {
  /** Unix timestamp in milliseconds */
  ts: number;
  /** Type of event */
  type: TrajectoryEventType;
  /** Human-readable summary of the event */
  content: string;
  /** Full raw data (optional, for debugging) */
  raw?: unknown;
  /** Importance level */
  significance?: EventSignificance;
  /** User-defined tags */
  tags?: string[];
}

/**
 * A structured decision record
 */
export interface Decision {
  /** What was the choice/question? */
  question: string;
  /** What was chosen */
  chosen: string;
  /** What alternatives were considered */
  alternatives: string[];
  /** Why this choice was made */
  reasoning: string;
}

/**
 * Agent participation record
 */
export interface AgentParticipation {
  /** Agent identifier */
  name: string;
  /** Role in the trajectory */
  role: "lead" | "contributor" | "reviewer";
  /** When the agent joined */
  joinedAt: string;
  /** When the agent left (if applicable) */
  leftAt?: string;
}

/**
 * A chapter represents a logical phase of work
 */
export interface Chapter {
  /** Unique chapter ID */
  id: string;
  /** Chapter title (e.g., "Initial exploration", "Implementation") */
  title: string;
  /** Which agent is working in this chapter */
  agentName: string;
  /** When the chapter started (ISO timestamp) */
  startedAt: string;
  /** When the chapter ended (ISO timestamp, undefined if current) */
  endedAt?: string;
  /** Events that occurred in this chapter */
  events: TrajectoryEvent[];
}

/**
 * Retrospective reflection on the completed work
 */
export interface Retrospective {
  /** Brief summary of what was accomplished */
  summary: string;
  /** How the work was approached */
  approach: string;
  /** Key decisions made during the work */
  decisions?: Decision[];
  /** What was unexpectedly difficult */
  challenges?: string[];
  /** What was learned */
  learnings?: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
  /** Agent's confidence in the solution (0-1) */
  confidence: number;
  /** Total time spent (human-readable) */
  timeSpent?: string;
}

/**
 * The main Trajectory type - represents the complete record of work on a task
 */
export interface Trajectory {
  /** Unique trajectory ID (format: traj_xxxxxxxxxxxx) */
  id: string;
  /** Schema version for forward compatibility */
  version: 1;
  /** The task being worked on */
  task: TaskReference;
  /** Current status */
  status: TrajectoryStatus;
  /** When work started (ISO timestamp) */
  startedAt: string;
  /** When work completed (ISO timestamp) */
  completedAt?: string;
  /** Agents who participated */
  agents: AgentParticipation[];
  /** Logical phases of work */
  chapters: Chapter[];
  /** Final reflection (only on completion) */
  retrospective?: Retrospective;
  /** Git commits produced */
  commits: string[];
  /** Files that were modified */
  filesChanged: string[];
  /** Project identifier */
  projectId: string;
  /** User-defined tags */
  tags: string[];
}

/**
 * Summary of a trajectory for listing/indexing
 */
export interface TrajectorySummary {
  id: string;
  title: string;
  status: TrajectoryStatus;
  startedAt: string;
  completedAt?: string;
  confidence?: number;
  chapterCount: number;
  decisionCount: number;
}

/**
 * Input for creating a new trajectory
 */
export interface CreateTrajectoryInput {
  /** Task title */
  title: string;
  /** Optional task description */
  description?: string;
  /** Optional external task reference */
  source?: TaskSource;
  /** Optional project ID (defaults to cwd) */
  projectId?: string;
  /** Optional initial tags */
  tags?: string[];
}

/**
 * Input for adding a chapter
 */
export interface AddChapterInput {
  /** Chapter title */
  title: string;
  /** Agent name */
  agentName: string;
}

/**
 * Input for adding an event
 */
export interface AddEventInput {
  /** Event type */
  type: TrajectoryEventType;
  /** Human-readable content */
  content: string;
  /** Optional raw data */
  raw?: unknown;
  /** Optional significance */
  significance?: EventSignificance;
  /** Optional tags */
  tags?: string[];
}

/**
 * Input for completing a trajectory
 */
export interface CompleteTrajectoryInput {
  summary: string;
  approach: string;
  decisions?: Decision[];
  challenges?: string[];
  learnings?: string[];
  suggestions?: string[];
  confidence: number;
}

/**
 * Query options for listing trajectories
 */
export interface TrajectoryQuery {
  /** Filter by status */
  status?: TrajectoryStatus;
  /** Filter by date range */
  since?: string;
  until?: string;
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort field */
  sortBy?: "startedAt" | "completedAt" | "title";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}
