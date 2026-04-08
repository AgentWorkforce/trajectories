/**
 * Configuration helpers for trajectory compaction.
 */

const DEFAULT_COMPACT_CLI = "claude";
const DEFAULT_COMPACT_TIMEOUT = 120_000;

/**
 * Read compaction configuration from environment variables.
 */
export function getCompactConfig(): { cli: string; timeout: number } {
  const cli = process.env.COMPACT_CLI?.trim() || DEFAULT_COMPACT_CLI;
  const timeoutValue = Number.parseInt(process.env.COMPACT_TIMEOUT ?? "", 10);
  const timeout =
    Number.isFinite(timeoutValue) && timeoutValue > 0
      ? timeoutValue
      : DEFAULT_COMPACT_TIMEOUT;

  return { cli, timeout };
}
