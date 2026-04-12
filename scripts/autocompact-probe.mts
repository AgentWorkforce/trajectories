/**
 * autocompact-probe.mts
 *
 * Shared probe script used by workflows/sdk-autocompact-option.ts for
 * BEFORE/AFTER validation of the TrajectoryClient.autoCompact option.
 *
 * Usage:
 *   cd <isolated tmp dir>
 *   TRAJECTORIES_WORKFLOW_ID=<id> PROBE_AUTOCOMPACT=true \
 *     npx tsx /abs/path/to/scripts/autocompact-probe.mts
 *
 * Env vars:
 *   TRAJECTORIES_WORKFLOW_ID — stamped onto the trajectory so
 *     `trail compact --workflow <id>` can select it.
 *   PROBE_AUTOCOMPACT — "true" turns on autoCompact: { mechanical: true,
 *     markdown: true }. Any other value leaves autoCompact unset, which
 *     is the BEFORE baseline behavior.
 *
 * The script uses `as never` casts on the autoCompact option so it is
 * safe to run even when the option doesn't exist on the Trajectory type
 * yet (pre-implementation). That lets the same file serve both BEFORE
 * (autoCompact ignored) and AFTER (autoCompact honored) runs.
 */

import { TrajectoryClient } from "../src/sdk/index.js";

async function main() {
  const options: Record<string, unknown> = { defaultAgent: "probe" };
  if (process.env.PROBE_AUTOCOMPACT === "true") {
    options.autoCompact = { mechanical: true, markdown: true };
  }

  const client = new TrajectoryClient(options as never);
  await client.init();

  const session = await client.start("autocompact probe");
  await session.decide("Probe decision one", "chosen A", "because reasons");
  await session.decide("Probe decision two", "chosen B", "more reasons");
  await session.done("autocompact probe complete", 0.95);
  await client.close();

  console.log(`PROBE_OK id=${session.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
