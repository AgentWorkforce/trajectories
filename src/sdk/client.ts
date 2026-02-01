/**
 * Trajectory SDK Client
 *
 * High-level client for programmatically creating and managing trajectories.
 * Provides a clean, developer-friendly API with automatic storage management.
 */

import { FileStorage } from "../storage/file.js";
import type { StorageAdapter } from "../storage/interface.js";
import {
  createTrajectory,
  addChapter,
  addEvent,
  addDecision,
  completeTrajectory,
  abandonTrajectory,
  TrajectoryError,
} from "../core/trajectory.js";
import type {
  Trajectory,
  CreateTrajectoryInput,
  CompleteTrajectoryInput,
  Decision,
  TrajectoryQuery,
  TrajectorySummary,
  TrajectoryEventType,
  EventSignificance,
} from "../core/types.js";
import { exportToMarkdown } from "../export/markdown.js";
import { exportToJSON } from "../export/json.js";
import { exportToTimeline } from "../export/timeline.js";
import { exportToPRSummary } from "../export/pr-summary.js";

/**
 * Options for configuring the TrajectoryClient
 */
export interface TrajectoryClientOptions {
  /** Storage adapter to use. Defaults to FileStorage. */
  storage?: StorageAdapter;
  /** Base directory for file storage. Defaults to .trajectories */
  dataDir?: string;
  /** Default agent name to use when not specified */
  defaultAgent?: string;
  /** Default project ID. Defaults to current working directory */
  projectId?: string;
  /** Whether to auto-save after each operation. Defaults to true */
  autoSave?: boolean;
}

/**
 * Active trajectory session for chainable operations
 */
export class TrajectorySession {
  private trajectory: Trajectory;
  private client: TrajectoryClient;
  private autoSave: boolean;

  constructor(
    trajectory: Trajectory,
    client: TrajectoryClient,
    autoSave: boolean
  ) {
    this.trajectory = trajectory;
    this.client = client;
    this.autoSave = autoSave;
  }

  /**
   * Get the current trajectory data
   */
  get data(): Trajectory {
    return this.trajectory;
  }

  /**
   * Get the trajectory ID
   */
  get id(): string {
    return this.trajectory.id;
  }

  /**
   * Start a new chapter
   * @param title - Chapter title
   * @param agentName - Agent name (uses default if not specified)
   */
  async chapter(title: string, agentName?: string): Promise<TrajectorySession> {
    const agent = agentName ?? this.client.defaultAgent ?? "default";
    this.trajectory = addChapter(this.trajectory, { title, agentName: agent });
    if (this.autoSave) {
      await this.client.save(this.trajectory);
    }
    return this;
  }

  /**
   * Record an event
   * @param type - Event type
   * @param content - Human-readable content
   * @param options - Additional event options
   */
  async event(
    type: TrajectoryEventType,
    content: string,
    options?: {
      raw?: unknown;
      significance?: EventSignificance;
      tags?: string[];
    }
  ): Promise<TrajectorySession> {
    this.trajectory = addEvent(this.trajectory, {
      type,
      content,
      ...options,
    });
    if (this.autoSave) {
      await this.client.save(this.trajectory);
    }
    return this;
  }

  /**
   * Record a note
   */
  async note(
    content: string,
    significance?: EventSignificance
  ): Promise<TrajectorySession> {
    return this.event("note", content, { significance });
  }

  /**
   * Record a finding
   */
  async finding(
    content: string,
    significance?: EventSignificance
  ): Promise<TrajectorySession> {
    return this.event("finding", content, { significance: significance ?? "medium" });
  }

  /**
   * Record an error
   */
  async error(content: string): Promise<TrajectorySession> {
    return this.event("error", content, { significance: "high" });
  }

  /**
   * Record a decision
   * @param decision - Structured decision record
   */
  async decision(decision: Decision): Promise<TrajectorySession> {
    this.trajectory = addDecision(this.trajectory, decision);
    if (this.autoSave) {
      await this.client.save(this.trajectory);
    }
    return this;
  }

  /**
   * Quick decision helper for simple choices
   * @param question - What was the question/choice?
   * @param chosen - What was chosen
   * @param reasoning - Why this choice was made
   * @param alternatives - Optional list of alternatives considered
   */
  async decide(
    question: string,
    chosen: string,
    reasoning: string,
    alternatives?: Array<{ option: string; reason?: string }>
  ): Promise<TrajectorySession> {
    return this.decision({
      question,
      chosen,
      reasoning,
      alternatives: alternatives ?? [],
    });
  }

  /**
   * Add a tag to the trajectory
   */
  async tag(tag: string): Promise<TrajectorySession> {
    if (!this.trajectory.tags.includes(tag)) {
      this.trajectory = {
        ...this.trajectory,
        tags: [...this.trajectory.tags, tag],
      };
      if (this.autoSave) {
        await this.client.save(this.trajectory);
      }
    }
    return this;
  }

  /**
   * Complete the trajectory with a retrospective
   * @param input - Retrospective details
   */
  async complete(input: CompleteTrajectoryInput): Promise<Trajectory> {
    this.trajectory = completeTrajectory(this.trajectory, input);
    await this.client.save(this.trajectory);
    return this.trajectory;
  }

  /**
   * Quick complete with minimal required fields
   * @param summary - What was accomplished
   * @param confidence - Confidence level (0-1)
   * @param options - Additional optional fields
   */
  async done(
    summary: string,
    confidence: number,
    options?: Partial<Omit<CompleteTrajectoryInput, "summary" | "confidence">>
  ): Promise<Trajectory> {
    return this.complete({
      summary,
      confidence,
      approach: options?.approach ?? "Standard approach",
      decisions: options?.decisions,
      challenges: options?.challenges,
      learnings: options?.learnings,
      suggestions: options?.suggestions,
    });
  }

  /**
   * Abandon the trajectory
   * @param reason - Reason for abandonment
   */
  async abandon(reason?: string): Promise<Trajectory> {
    this.trajectory = abandonTrajectory(this.trajectory, reason);
    await this.client.save(this.trajectory);
    return this.trajectory;
  }

  /**
   * Force save the current state
   */
  async save(): Promise<void> {
    await this.client.save(this.trajectory);
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
 * Main SDK client for trajectory management
 *
 * @example
 * ```typescript
 * import { TrajectoryClient } from 'agent-trajectories/sdk';
 *
 * const client = new TrajectoryClient({ defaultAgent: 'my-agent' });
 * await client.init();
 *
 * // Start a new trajectory
 * const session = await client.start('Implement feature X');
 *
 * // Record work
 * await session
 *   .chapter('Research')
 *   .note('Found relevant documentation')
 *   .decide('Use library A vs B', 'Library A', 'Better TypeScript support');
 *
 * // Complete with retrospective
 * await session.done('Successfully implemented feature X', 0.9);
 * ```
 */
export class TrajectoryClient {
  private storage: StorageAdapter;
  private initialized = false;
  readonly defaultAgent?: string;
  private projectId?: string;
  private autoSave: boolean;

  constructor(options: TrajectoryClientOptions = {}) {
    this.storage = options.storage ?? new FileStorage(options.dataDir);
    this.defaultAgent = options.defaultAgent ?? process.env.TRAJECTORIES_AGENT;
    this.projectId = options.projectId ?? process.env.TRAJECTORIES_PROJECT;
    this.autoSave = options.autoSave ?? true;
  }

  /**
   * Initialize the client (creates storage directories, etc.)
   * Must be called before using other methods.
   */
  async init(): Promise<void> {
    if (!this.initialized) {
      await this.storage.initialize();
      this.initialized = true;
    }
  }

  /**
   * Ensure the client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new TrajectoryError(
        "Client not initialized. Call init() first.",
        "NOT_INITIALIZED",
        "Add 'await client.init()' before using the client"
      );
    }
  }

  /**
   * Start a new trajectory
   * @param title - Task title
   * @param options - Additional creation options
   * @returns A session for the new trajectory
   */
  async start(
    title: string,
    options?: Omit<CreateTrajectoryInput, "title">
  ): Promise<TrajectorySession> {
    this.ensureInitialized();

    // Check if there's already an active trajectory
    const active = await this.storage.getActive();
    if (active) {
      throw new TrajectoryError(
        `Active trajectory already exists: ${active.id}`,
        "ACTIVE_TRAJECTORY_EXISTS",
        "Complete or abandon the active trajectory first"
      );
    }

    const trajectory = createTrajectory({
      title,
      projectId: this.projectId,
      ...options,
    });

    await this.storage.save(trajectory);
    return new TrajectorySession(trajectory, this, this.autoSave);
  }

  /**
   * Resume the currently active trajectory
   * @returns Session for active trajectory, or null if none active
   */
  async resume(): Promise<TrajectorySession | null> {
    this.ensureInitialized();
    const active = await this.storage.getActive();
    if (!active) {
      return null;
    }
    return new TrajectorySession(active, this, this.autoSave);
  }

  /**
   * Get the active trajectory (without creating a session)
   */
  async getActive(): Promise<Trajectory | null> {
    this.ensureInitialized();
    return this.storage.getActive();
  }

  /**
   * Get a trajectory by ID
   * @param id - Trajectory ID
   */
  async get(id: string): Promise<Trajectory | null> {
    this.ensureInitialized();
    return this.storage.get(id);
  }

  /**
   * Open a trajectory session by ID
   * @param id - Trajectory ID
   */
  async open(id: string): Promise<TrajectorySession | null> {
    this.ensureInitialized();
    const trajectory = await this.storage.get(id);
    if (!trajectory) {
      return null;
    }
    return new TrajectorySession(trajectory, this, this.autoSave);
  }

  /**
   * List trajectories with optional filtering
   * @param query - Query options
   */
  async list(query?: TrajectoryQuery): Promise<TrajectorySummary[]> {
    this.ensureInitialized();
    return this.storage.list(query ?? {});
  }

  /**
   * Search trajectories by text
   * @param text - Search text
   * @param limit - Maximum results
   */
  async search(text: string, limit?: number): Promise<TrajectorySummary[]> {
    this.ensureInitialized();
    return this.storage.search(text, limit !== undefined ? { limit } : undefined);
  }

  /**
   * Delete a trajectory
   * @param id - Trajectory ID
   */
  async delete(id: string): Promise<void> {
    this.ensureInitialized();
    await this.storage.delete(id);
  }

  /**
   * Save a trajectory to storage
   * @param trajectory - Trajectory to save
   */
  async save(trajectory: Trajectory): Promise<void> {
    this.ensureInitialized();
    await this.storage.save(trajectory);
  }

  /**
   * Close the client and release resources
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.storage.close();
      this.initialized = false;
    }
  }

  /**
   * Export a trajectory to markdown
   * @param id - Trajectory ID
   */
  async exportMarkdown(id: string): Promise<string | null> {
    const trajectory = await this.get(id);
    if (!trajectory) return null;
    return exportToMarkdown(trajectory);
  }

  /**
   * Export a trajectory to JSON
   * @param id - Trajectory ID
   * @param compact - Whether to use compact format
   */
  async exportJSON(id: string, compact?: boolean): Promise<string | null> {
    const trajectory = await this.get(id);
    if (!trajectory) return null;
    return exportToJSON(trajectory, { compact });
  }

  /**
   * Export a trajectory to timeline format
   * @param id - Trajectory ID
   */
  async exportTimeline(id: string): Promise<string | null> {
    const trajectory = await this.get(id);
    if (!trajectory) return null;
    return exportToTimeline(trajectory);
  }

  /**
   * Export a trajectory to PR summary format
   * @param id - Trajectory ID
   */
  async exportPRSummary(id: string): Promise<string | null> {
    const trajectory = await this.get(id);
    if (!trajectory) return null;
    return exportToPRSummary(trajectory);
  }
}
