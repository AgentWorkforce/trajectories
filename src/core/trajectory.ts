/**
 * Trajectory operations
 *
 * Pure functions for creating and manipulating trajectories.
 * These functions return new trajectory objects (immutable updates).
 */

import { generateChapterId, generateTrajectoryId } from "./id.js";
import {
  CompleteTrajectoryInputSchema,
  CreateTrajectoryInputSchema,
} from "./schema.js";
import type {
  AddChapterInput,
  AddEventInput,
  Chapter,
  CompleteTrajectoryInput,
  CreateTrajectoryInput,
  Decision,
  Trajectory,
} from "./types.js";

/**
 * Custom error class for trajectory operations
 */
export class TrajectoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = "TrajectoryError";
  }
}

/**
 * Create a new trajectory
 * @param input - Trajectory creation input
 * @returns New trajectory object
 * @throws TrajectoryError if validation fails
 */
export function createTrajectory(input: CreateTrajectoryInput): Trajectory {
  // Validate input
  const validation = CreateTrajectoryInputSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    throw new TrajectoryError(
      firstError.message,
      "VALIDATION_ERROR",
      "Check your input and try again",
    );
  }

  const now = new Date().toISOString();

  return {
    id: generateTrajectoryId(),
    version: 1,
    task: {
      title: input.title,
      description: input.description,
      source: input.source,
    },
    status: "active",
    startedAt: now,
    agents: [],
    chapters: [],
    commits: [],
    filesChanged: [],
    projectId: input.projectId ?? process.cwd(),
    tags: input.tags ?? [],
  };
}

/**
 * Add a chapter to a trajectory
 * @param trajectory - The trajectory to update
 * @param input - Chapter creation input
 * @returns Updated trajectory with new chapter
 * @throws TrajectoryError if trajectory is completed
 */
export function addChapter(
  trajectory: Trajectory,
  input: AddChapterInput,
): Trajectory {
  if (trajectory.status === "completed") {
    throw new TrajectoryError(
      "Cannot add chapter to completed trajectory",
      "TRAJECTORY_ALREADY_COMPLETED",
      "Start a new trajectory instead",
    );
  }

  const now = new Date().toISOString();

  // End the previous chapter if one exists
  const updatedChapters = trajectory.chapters.map((chapter, index) => {
    if (index === trajectory.chapters.length - 1 && !chapter.endedAt) {
      return { ...chapter, endedAt: now };
    }
    return chapter;
  });

  const newChapter: Chapter = {
    id: generateChapterId(),
    title: input.title,
    agentName: input.agentName,
    startedAt: now,
    events: [],
  };

  return {
    ...trajectory,
    chapters: [...updatedChapters, newChapter],
  };
}

/**
 * Add an event to the current chapter
 * Auto-creates a chapter if none exists
 * @param trajectory - The trajectory to update
 * @param input - Event creation input
 * @returns Updated trajectory with new event
 */
export function addEvent(
  trajectory: Trajectory,
  input: AddEventInput,
): Trajectory {
  // Auto-create a chapter if none exists
  let updatedTrajectory = trajectory;
  if (trajectory.chapters.length === 0) {
    updatedTrajectory = addChapter(trajectory, {
      title: "Work",
      agentName: "default",
    });
  }

  const event = {
    ts: Date.now(),
    type: input.type,
    content: input.content,
    raw: input.raw,
    significance: input.significance,
    tags: input.tags,
  };

  const chapters = [...updatedTrajectory.chapters];
  const lastChapter = chapters[chapters.length - 1];
  chapters[chapters.length - 1] = {
    ...lastChapter,
    events: [...lastChapter.events, event],
  };

  return {
    ...updatedTrajectory,
    chapters,
  };
}

/**
 * Add a structured decision to the trajectory
 * @param trajectory - The trajectory to update
 * @param decision - Decision details
 * @returns Updated trajectory with decision event
 */
export function addDecision(
  trajectory: Trajectory,
  decision: Decision,
): Trajectory {
  return addEvent(trajectory, {
    type: "decision",
    content: `${decision.question}: ${decision.chosen}`,
    raw: decision,
    significance: "high",
  });
}

/**
 * Complete a trajectory with retrospective
 * @param trajectory - The trajectory to complete
 * @param input - Retrospective input
 * @returns Completed trajectory
 * @throws TrajectoryError if already completed or validation fails
 */
export function completeTrajectory(
  trajectory: Trajectory,
  input: CompleteTrajectoryInput,
): Trajectory {
  if (trajectory.status === "completed") {
    throw new TrajectoryError(
      "Trajectory is already completed",
      "TRAJECTORY_ALREADY_COMPLETED",
      "Start a new trajectory instead",
    );
  }

  // Validate input
  const validation = CompleteTrajectoryInputSchema.safeParse(input);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    throw new TrajectoryError(
      firstError.message,
      "VALIDATION_ERROR",
      "Check your input and try again",
    );
  }

  const now = new Date().toISOString();

  // End the last chapter if one exists
  const chapters = trajectory.chapters.map((chapter, index) => {
    if (index === trajectory.chapters.length - 1 && !chapter.endedAt) {
      return { ...chapter, endedAt: now };
    }
    return chapter;
  });

  return {
    ...trajectory,
    status: "completed",
    completedAt: now,
    chapters,
    retrospective: {
      summary: input.summary,
      approach: input.approach,
      decisions: input.decisions,
      challenges: input.challenges,
      learnings: input.learnings,
      suggestions: input.suggestions,
      confidence: input.confidence,
    },
  };
}

/**
 * Abandon a trajectory without completing
 * @param trajectory - The trajectory to abandon
 * @param reason - Reason for abandonment
 * @returns Abandoned trajectory
 */
export function abandonTrajectory(
  trajectory: Trajectory,
  reason?: string,
): Trajectory {
  const now = new Date().toISOString();

  // End the last chapter if one exists
  const chapters = trajectory.chapters.map((chapter, index) => {
    if (index === trajectory.chapters.length - 1 && !chapter.endedAt) {
      return { ...chapter, endedAt: now };
    }
    return chapter;
  });

  // Add abandonment note if reason provided
  let updatedChapters = chapters;
  if (reason && chapters.length > 0) {
    const lastChapter = chapters[chapters.length - 1];
    updatedChapters = [
      ...chapters.slice(0, -1),
      {
        ...lastChapter,
        events: [
          ...lastChapter.events,
          {
            ts: Date.now(),
            type: "note" as const,
            content: `Abandoned: ${reason}`,
            significance: "high" as const,
          },
        ],
      },
    ];
  }

  return {
    ...trajectory,
    status: "abandoned",
    completedAt: now,
    chapters: updatedChapters,
  };
}
