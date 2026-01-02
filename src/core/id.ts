/**
 * ID generation utilities for trajectories and chapters
 *
 * Uses a simple random ID generator to avoid external dependencies.
 * IDs are URL-safe and collision-resistant.
 */

import { webcrypto } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 12;

/**
 * Generate a random ID string
 * @param length - Length of the ID (default: 12)
 * @returns Random alphanumeric string
 */
export function generateRandomId(length: number = ID_LENGTH): string {
  let id = "";
  const randomValues = new Uint8Array(length);
  webcrypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    id += ALPHABET[randomValues[i] % ALPHABET.length];
  }

  return id;
}

/**
 * Generate a trajectory ID
 * Format: traj_xxxxxxxxxxxx (traj_ prefix + 12 random chars)
 * @returns Unique trajectory ID
 */
export function generateTrajectoryId(): string {
  return `traj_${generateRandomId()}`;
}

/**
 * Generate a chapter ID
 * Format: chap_xxxxxxxxxxxx (chap_ prefix + 12 random chars)
 * @returns Unique chapter ID
 */
export function generateChapterId(): string {
  return `chap_${generateRandomId()}`;
}

/**
 * Validate a trajectory ID format
 * @param id - The ID to validate
 * @returns True if valid format
 */
export function isValidTrajectoryId(id: string): boolean {
  return /^traj_[a-z0-9]{12}$/.test(id);
}

/**
 * Validate a chapter ID format
 * @param id - The ID to validate
 * @returns True if valid format
 */
export function isValidChapterId(id: string): boolean {
  return /^chap_[a-z0-9]{12}$/.test(id);
}
