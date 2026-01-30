/**
 * trail complete command
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Command } from "commander";
import { generateTrace, getGitHead } from "../../core/trace.js";
import { completeTrajectory } from "../../core/trajectory.js";
import type { TraceRecord, Trajectory } from "../../core/types.js";
import { FileStorage } from "../../storage/file.js";

/**
 * Save trace file alongside the trajectory
 */
async function saveTraceFile(
  trajectory: Trajectory,
  trace: TraceRecord,
): Promise<void> {
  // Determine trajectory file location based on status
  const dataDir = process.env.TRAJECTORIES_DATA_DIR;
  const baseDir = dataDir ? dataDir : join(process.cwd(), ".trajectories");
  const completedDir = join(baseDir, "completed");

  const date = new Date(trajectory.completedAt ?? trajectory.startedAt);
  const monthDir = join(
    completedDir,
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
  );

  // Ensure directory exists
  if (!existsSync(monthDir)) {
    await mkdir(monthDir, { recursive: true });
  }

  // Save trace file with .trace.json extension
  const tracePath = join(monthDir, `${trajectory.id}.trace.json`);
  await writeFile(tracePath, JSON.stringify(trace, null, 2), "utf-8");
}

export function registerCompleteCommand(program: Command): void {
  program
    .command("complete")
    .description("Complete the active trajectory with retrospective")
    .option("--summary <text>", "Summary of what was accomplished")
    .option("--approach <text>", "How the work was approached")
    .option("--confidence <number>", "Confidence level 0-1", Number.parseFloat)
    .action(async (options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const active = await storage.getActive();
      if (!active) {
        console.error("Error: No active trajectory");
        console.error('Start one with: trail start "Task description"');
        throw new Error("No active trajectory");
      }

      // Require summary and confidence
      if (!options.summary) {
        console.error("Error: --summary is required");
        throw new Error("Summary required");
      }

      const confidence = options.confidence ?? 0.8;
      if (confidence < 0 || confidence > 1) {
        console.error("Error: --confidence must be between 0 and 1");
        throw new Error("Invalid confidence");
      }

      let completed = completeTrajectory(active, {
        summary: options.summary,
        approach: options.approach || "Standard approach",
        confidence,
      });

      // Generate trace if we have a start reference
      let trace: TraceRecord | null = null;
      if (active._trace?.startRef) {
        trace = generateTrace(completed, active._trace.startRef);
        if (trace) {
          // Update trajectory with final trace reference
          const endRef = getGitHead();
          completed = {
            ...completed,
            _trace: {
              ...completed._trace,
              startRef: active._trace.startRef,
              endRef: endRef ?? undefined,
              traceId: trace.id,
            },
          };
        }
      }

      await storage.save(completed);

      // Save trace file alongside trajectory if generated
      if (trace) {
        await saveTraceFile(completed, trace);
      }

      console.log(`✓ Trajectory completed: ${completed.id}`);
      console.log(`  Summary: ${options.summary}`);
      console.log(`  Confidence: ${Math.round(confidence * 100)}%`);
      if (trace) {
        console.log(`  Trace: ${trace.id} (${trace.files.length} files)`);
      }
    });
}
