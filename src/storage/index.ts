/**
 * Storage module exports
 */

export {
  DEFAULT_TRAJECTORY_DATA_DIR,
  LEGACY_TRAJECTORY_DATA_DIR,
  FileStorage,
  getDefaultTrajectoryDataDir,
  getSearchPaths,
} from "./file.js";
export type { StorageAdapter, StorageConfig } from "./interface.js";
