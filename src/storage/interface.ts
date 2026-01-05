/**
 * Storage adapter interface for trajectory persistence
 *
 * This interface defines the contract for storage backends.
 * Implementations include FileStorage (default) and SQLiteStorage (optional).
 */

import type {
  Trajectory,
  TrajectoryQuery,
  TrajectorySummary,
} from "../core/types.js";

/**
 * Abstract storage adapter interface
 *
 * All storage implementations must implement this interface.
 * This allows swapping storage backends without changing business logic.
 */
export interface StorageAdapter {
  /**
   * Initialize the storage backend
   * Creates necessary directories, tables, etc.
   */
  initialize(): Promise<void>;

  /**
   * Save a trajectory
   * Creates if new, updates if exists
   * Moves to completed directory if status is completed
   * @param trajectory - The trajectory to save
   */
  save(trajectory: Trajectory): Promise<void>;

  /**
   * Get a trajectory by ID
   * @param id - Trajectory ID
   * @returns The trajectory or null if not found
   */
  get(id: string): Promise<Trajectory | null>;

  /**
   * Get the currently active trajectory
   * @returns The active trajectory or null if none
   */
  getActive(): Promise<Trajectory | null>;

  /**
   * List trajectories with optional filtering
   * @param query - Query options
   * @returns Array of trajectory summaries
   */
  list(query: TrajectoryQuery): Promise<TrajectorySummary[]>;

  /**
   * Delete a trajectory
   * @param id - Trajectory ID to delete
   */
  delete(id: string): Promise<void>;

  /**
   * Search trajectories by text
   * @param text - Search query
   * @param options - Search options
   * @returns Matching trajectory summaries
   */
  search(
    text: string,
    options?: { limit?: number },
  ): Promise<TrajectorySummary[]>;

  /**
   * Close the storage connection
   * Clean up resources
   */
  close(): Promise<void>;
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Base directory for file storage */
  baseDir?: string;
  /** SQLite database path (for SQLite adapter) */
  dbPath?: string;
}

/**
 * Export the StorageAdapter type for use in tests
 */
export const StorageAdapter = {} as StorageAdapter;
