#!/usr/bin/env tsx
/**
 * Reproducible benchmark fixture for the LLM compaction feature.
 *
 * Records a deliberately noisy trajectory (3 chapters, 5+ decisions, 10+
 * findings, 15+ low-significance noise events) using the default
 * TrajectoryClient storage (always `<cwd>/.agentworkforce/trajectories/`). The caller is
 * expected to `cd` into an isolated directory before invoking this script.
 *
 * Reads TRAJECTORIES_WORKFLOW_ID from the environment and forwards it to
 * the trajectory via createTrajectory's `workflowId` option if accepted by
 * the SDK; otherwise the SDK picks it up from the env var directly. On
 * pre-feature runs this is a no-op, which is expected.
 *
 * Prints exactly one line to stdout: `TRAJECTORY_ID=<id>`
 */

import { TrajectoryClient } from "../src/sdk/index.js";

async function main(): Promise<void> {
  const workflowId = process.env.TRAJECTORIES_WORKFLOW_ID;
  const client = new TrajectoryClient({ defaultAgent: "benchmark-agent" });
  await client.init();

  // Forward the workflow id via start() options if the SDK accepts it.
  // On pre-feature runs the field is unknown to CreateTrajectoryInput, so
  // we widen the cast — the SDK will simply ignore unrecognised keys, and
  // once the feature lands the env var path also works.
  const startOpts = workflowId
    ? ({ workflowId } as unknown as Parameters<typeof client.start>[1])
    : undefined;

  const session = await client.start(
    "Benchmark: noisy compaction sample",
    startOpts,
  );

  // ---------- Chapter 1: Investigation ----------
  await session.chapter("Investigation", "benchmark-agent");
  await session.finding("Repository has 47 TypeScript modules under src/");
  await session.finding("Compaction target: events with significance=low");
  await session.finding("Existing exporters: markdown, json, timeline, pr");
  await session.event("tool_call", "rg --files src/", { significance: "low" });
  await session.event("tool_result", "47 files matched", {
    significance: "low",
  });
  await session.event("thinking", "Considering which paths to scan first", {
    significance: "low",
  });
  await session.event("tool_call", "cat src/sdk/client.ts", {
    significance: "low",
  });
  await session.event("tool_result", "file 580 lines", { significance: "low" });
  await session.event("thinking", "Client looks stable; no API churn needed", {
    significance: "low",
  });
  await session.decide(
    "Where to anchor the benchmark?",
    "scripts/benchmark-compaction.ts",
    "Co-locates with future fixtures and stays out of src/",
    [{ option: "tests/fixtures/", reason: "Mixes fixtures with unit tests" }],
  );
  await session.decide(
    "How to pass workflow id?",
    "Read TRAJECTORIES_WORKFLOW_ID and forward through start options",
    "Matches the env-var contract spec",
  );

  // ---------- Chapter 2: Implementation ----------
  await session.chapter("Implementation", "benchmark-agent");
  await session.finding(
    "TrajectoryClient defaults storage to <cwd>/.agentworkforce/trajectories",
  );
  await session.finding("Session API is fully chainable and auto-saves");
  await session.finding("addEvent accepts arbitrary significance levels");
  await session.event("tool_call", "rg TrajectoryClient src/sdk", {
    significance: "low",
  });
  await session.event("tool_result", "12 hits", { significance: "low" });
  await session.event("thinking", "Will reuse default storage path", {
    significance: "low",
  });
  await session.event("tool_call", "ls .agentworkforce/trajectories", {
    significance: "low",
  });
  await session.event("tool_result", "active/ completed/", {
    significance: "low",
  });
  await session.event("thinking", "Storage already initialised", {
    significance: "low",
  });
  await session.event("tool_call", "node --version", { significance: "low" });
  await session.event("tool_result", "v20.11.0", { significance: "low" });
  await session.decide(
    "Auto-save vs manual save?",
    "Auto-save (default)",
    "Removes a class of fixture flake",
  );
  await session.decide(
    "Noise volume?",
    "15+ low-significance events",
    "Gives the compactor enough signal to demonstrate reduction",
  );

  // ---------- Chapter 3: Validation ----------
  await session.chapter("Validation", "benchmark-agent");
  await session.finding("Trajectory has 3 chapters as required");
  await session.finding("Decision count >= 5");
  await session.finding("Finding count >= 10");
  await session.finding("Low-significance event count >= 15");
  await session.event("tool_call", "wc -l scripts/benchmark-compaction.ts", {
    significance: "low",
  });
  await session.event("tool_result", "under 120 lines", {
    significance: "low",
  });
  await session.event("thinking", "All quotas met", { significance: "low" });
  await session.decide(
    "Print format?",
    "Single TRAJECTORY_ID=<id> line on stdout",
    "Easiest for the harness to parse",
  );

  await session.complete({
    summary:
      "Recorded a deliberately noisy 3-chapter sample trajectory for compaction benchmarks.",
    confidence: 0.95,
    approach:
      "Use TrajectoryClient defaults; emit 5+ decisions, 10+ findings, and 15+ noise events across three chapters.",
    challenges: ["Balancing noise volume vs script size budget"],
    learnings: ["TrajectorySession's chainable API keeps fixture code compact"],
    suggestions: [
      "Reuse this script as the canonical before/after compaction input",
    ],
  });

  process.stdout.write(`TRAJECTORY_ID=${session.id}\n`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
