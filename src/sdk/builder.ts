/**
 * Trajectory Builder
 *
 * Fluent builder pattern for creating trajectories without storage.
 * Useful for programmatically constructing trajectories in memory.
 */

import {
  createTrajectory,
  addChapter,
  addEvent,
  addDecision,
  completeTrajectory,
  abandonTrajectory,
} from "../core/trajectory.js";
import type {
  Trajectory,
  CreateTrajectoryInput,
  Decision,
  CompleteTrajectoryInput,
  TrajectoryEventType,
  EventSignificance,
  TaskSource,
} from "../core/types.js";
import { exportToMarkdown } from "../export/markdown.js";
import { exportToJSON } from "../export/json.js";
import { exportToTimeline } from "../export/timeline.js";
import { exportToPRSummary } from "../export/pr-summary.js";

/**
 * Fluent builder for creating trajectories in memory
 *
 * @example
 * ```typescript
 * import { TrajectoryBuilder } from 'agent-trajectories/sdk';
 *
 * const trajectory = TrajectoryBuilder
 *   .create('Implement feature X')
 *   .withDescription('Add new authentication flow')
 *   .withSource({ system: 'github', id: 'GH#123' })
 *   .chapter('Research', 'claude')
 *     .note('Found existing auth patterns')
 *     .finding('Current implementation uses JWT')
 *   .chapter('Implementation', 'claude')
 *     .decide('JWT vs Session', 'JWT', 'Better for API clients')
 *     .note('Implemented token refresh')
 *   .complete({
 *     summary: 'Added JWT-based authentication',
 *     approach: 'Extended existing auth module',
 *     confidence: 0.95
 *   });
 *
 * console.log(trajectory.toMarkdown());
 * ```
 */
export class TrajectoryBuilder {
  private trajectory: Trajectory;

  private constructor(input: CreateTrajectoryInput) {
    this.trajectory = createTrajectory(input);
  }

  /**
   * Create a new trajectory builder
   * @param title - Task title
   */
  static create(title: string): TrajectoryBuilder {
    return new TrajectoryBuilder({ title });
  }

  /**
   * Set the task description
   */
  withDescription(description: string): TrajectoryBuilder {
    this.trajectory = {
      ...this.trajectory,
      task: {
        ...this.trajectory.task,
        description,
      },
    };
    return this;
  }

  /**
   * Set the external task source
   */
  withSource(source: TaskSource): TrajectoryBuilder {
    this.trajectory = {
      ...this.trajectory,
      task: {
        ...this.trajectory.task,
        source,
      },
    };
    return this;
  }

  /**
   * Set the project ID
   */
  withProject(projectId: string): TrajectoryBuilder {
    this.trajectory = {
      ...this.trajectory,
      projectId,
    };
    return this;
  }

  /**
   * Add tags
   */
  withTags(...tags: string[]): TrajectoryBuilder {
    this.trajectory = {
      ...this.trajectory,
      tags: [...this.trajectory.tags, ...tags],
    };
    return this;
  }

  /**
   * Add a single tag
   */
  tag(tag: string): TrajectoryBuilder {
    if (!this.trajectory.tags.includes(tag)) {
      this.trajectory = {
        ...this.trajectory,
        tags: [...this.trajectory.tags, tag],
      };
    }
    return this;
  }

  /**
   * Start a new chapter
   * @param title - Chapter title
   * @param agentName - Agent name
   */
  chapter(title: string, agentName: string): TrajectoryBuilder {
    this.trajectory = addChapter(this.trajectory, { title, agentName });
    return this;
  }

  /**
   * Add a generic event
   */
  event(
    type: TrajectoryEventType,
    content: string,
    options?: {
      raw?: unknown;
      significance?: EventSignificance;
      tags?: string[];
    }
  ): TrajectoryBuilder {
    this.trajectory = addEvent(this.trajectory, {
      type,
      content,
      ...options,
    });
    return this;
  }

  /**
   * Add a note event
   */
  note(content: string, significance?: EventSignificance): TrajectoryBuilder {
    return this.event("note", content, { significance });
  }

  /**
   * Add a finding event
   */
  finding(
    content: string,
    significance?: EventSignificance
  ): TrajectoryBuilder {
    return this.event("finding", content, {
      significance: significance ?? "medium",
    });
  }

  /**
   * Add an error event
   */
  error(content: string): TrajectoryBuilder {
    return this.event("error", content, { significance: "high" });
  }

  /**
   * Add a thinking event
   */
  thinking(content: string): TrajectoryBuilder {
    return this.event("thinking", content, { significance: "low" });
  }

  /**
   * Add a tool call event
   */
  toolCall(content: string, raw?: unknown): TrajectoryBuilder {
    return this.event("tool_call", content, { raw });
  }

  /**
   * Add a tool result event
   */
  toolResult(content: string, raw?: unknown): TrajectoryBuilder {
    return this.event("tool_result", content, { raw });
  }

  /**
   * Add a prompt event
   */
  prompt(content: string): TrajectoryBuilder {
    return this.event("prompt", content, { significance: "medium" });
  }

  /**
   * Add a message sent event
   */
  messageSent(content: string): TrajectoryBuilder {
    return this.event("message_sent", content);
  }

  /**
   * Add a message received event
   */
  messageReceived(content: string): TrajectoryBuilder {
    return this.event("message_received", content);
  }

  /**
   * Add a structured decision
   */
  decision(decision: Decision): TrajectoryBuilder {
    this.trajectory = addDecision(this.trajectory, decision);
    return this;
  }

  /**
   * Quick decision helper
   */
  decide(
    question: string,
    chosen: string,
    reasoning: string,
    alternatives?: Array<{ option: string; reason?: string }>
  ): TrajectoryBuilder {
    return this.decision({
      question,
      chosen,
      reasoning,
      alternatives: alternatives ?? [],
    });
  }

  /**
   * Record git commits
   */
  commits(...hashes: string[]): TrajectoryBuilder {
    this.trajectory = {
      ...this.trajectory,
      commits: [...this.trajectory.commits, ...hashes],
    };
    return this;
  }

  /**
   * Record files changed
   */
  filesChanged(...paths: string[]): TrajectoryBuilder {
    this.trajectory = {
      ...this.trajectory,
      filesChanged: [...this.trajectory.filesChanged, ...paths],
    };
    return this;
  }

  /**
   * Complete the trajectory with a retrospective
   * @param input - Retrospective details
   * @returns The completed trajectory
   */
  complete(input: CompleteTrajectoryInput): Trajectory {
    this.trajectory = completeTrajectory(this.trajectory, input);
    return this.trajectory;
  }

  /**
   * Quick complete with minimal fields
   */
  done(
    summary: string,
    confidence: number,
    approach?: string
  ): Trajectory {
    return this.complete({
      summary,
      confidence,
      approach: approach ?? "Standard approach",
    });
  }

  /**
   * Abandon the trajectory
   */
  abandon(reason?: string): Trajectory {
    this.trajectory = abandonTrajectory(this.trajectory, reason);
    return this.trajectory;
  }

  /**
   * Get the current trajectory (without completing)
   */
  build(): Trajectory {
    return this.trajectory;
  }

  /**
   * Export to markdown
   */
  toMarkdown(): string {
    return exportToMarkdown(this.trajectory);
  }

  /**
   * Export to JSON
   */
  toJSON(compact?: boolean): string {
    return exportToJSON(this.trajectory, { compact });
  }

  /**
   * Export to timeline format
   */
  toTimeline(): string {
    return exportToTimeline(this.trajectory);
  }

  /**
   * Export to PR summary format
   */
  toPRSummary(): string {
    return exportToPRSummary(this.trajectory);
  }
}

/**
 * Shorthand function to create a trajectory builder
 *
 * @example
 * ```typescript
 * import { trajectory } from 'agent-trajectories/sdk';
 *
 * const result = trajectory('Fix bug in auth')
 *   .chapter('Investigation', 'claude')
 *   .finding('Found null pointer in login handler')
 *   .done('Fixed null pointer exception', 0.95);
 * ```
 */
export function trajectory(title: string): TrajectoryBuilder {
  return TrajectoryBuilder.create(title);
}
