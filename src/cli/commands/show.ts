/**
 * trail show command
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Command } from "commander";
import type {
  Decision,
  TraceConversation,
  TraceRecord,
  Trajectory,
} from "../../core/types.js";
import { FileStorage, getSearchPaths } from "../../storage/file.js";

/**
 * Search for a trajectory across all search paths
 */
async function findTrajectory(id: string): Promise<Trajectory | null> {
  const searchPaths = getSearchPaths();

  for (const searchPath of searchPaths) {
    // Skip paths that don't exist
    if (!existsSync(searchPath)) {
      continue;
    }

    // Create storage pointing to this path directly
    const originalDataDir = process.env.TRAJECTORIES_DATA_DIR;
    process.env.TRAJECTORIES_DATA_DIR = searchPath;

    try {
      const storage = new FileStorage();
      await storage.initialize();

      const trajectory = await storage.get(id);
      if (trajectory) {
        return trajectory;
      }
    } finally {
      // Restore original env var
      if (originalDataDir !== undefined) {
        process.env.TRAJECTORIES_DATA_DIR = originalDataDir;
      } else {
        process.env.TRAJECTORIES_DATA_DIR = undefined;
      }
    }
  }

  return null;
}

/**
 * Find and load the trace file for a trajectory
 */
async function findTraceFile(id: string): Promise<TraceRecord | null> {
  const searchPaths = getSearchPaths();

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) {
      continue;
    }

    const completedDir = join(searchPath, "completed");
    if (!existsSync(completedDir)) {
      continue;
    }

    // Search through month directories
    try {
      const { readdirSync } = await import("node:fs");
      const months = readdirSync(completedDir);
      for (const month of months) {
        const tracePath = join(completedDir, month, `${id}.trace.json`);
        if (existsSync(tracePath)) {
          const content = await readFile(tracePath, "utf-8");
          return JSON.parse(content) as TraceRecord;
        }
      }
    } catch {
      // Continue searching
    }
  }

  return null;
}

export function registerShowCommand(program: Command): void {
  program
    .command("show <id>")
    .description("Show trajectory details")
    .option("-d, --decisions", "Show decisions only")
    .option("-t, --trace", "Show trace information")
    .action(async (id: string, options) => {
      const trajectory = await findTrajectory(id);

      if (!trajectory) {
        console.error(`Error: Trajectory not found: ${id}`);
        throw new Error("Trajectory not found");
      }

      if (options.trace) {
        // Show trace information
        console.log(`Trace for ${trajectory.task.title}:\n`);

        // Show embedded trace reference
        if (trajectory._trace) {
          console.log("Trace Reference:");
          console.log(`  Start Ref: ${trajectory._trace.startRef}`);
          if (trajectory._trace.endRef) {
            console.log(`  End Ref:   ${trajectory._trace.endRef}`);
          }
          if (trajectory._trace.traceId) {
            console.log(`  Trace ID:  ${trajectory._trace.traceId}`);
          }
          console.log("");
        }

        // Load and display trace file
        const trace = await findTraceFile(id);
        if (trace) {
          console.log("Trace Details:");
          console.log(`  ID:        ${trace.id}`);
          console.log(`  Timestamp: ${trace.timestamp}`);
          console.log(`  Files:     ${trace.files.length}`);
          console.log("");

          if (trace.files.length > 0) {
            console.log("Modified Files:");
            for (const file of trace.files) {
              const rangeCount = file.conversations.reduce(
                (sum: number, conv: TraceConversation) =>
                  sum + conv.ranges.length,
                0,
              );
              const model =
                file.conversations[0]?.contributor.model ?? "unknown";
              console.log(`  • ${file.path}`);
              console.log(`    Ranges: ${rangeCount}, Model: ${model}`);
            }
          }
        } else if (!trajectory._trace) {
          console.log("No trace information available");
          console.log(
            "Trace is captured when starting a trajectory in a git repo",
          );
        }
        return;
      }

      if (options.decisions) {
        // Show decisions only
        const decisions = extractDecisions(trajectory);

        if (decisions.length === 0) {
          console.log("No decisions recorded");
          return;
        }

        console.log(`Decisions for ${trajectory.task.title}:\n`);
        for (const decision of decisions) {
          console.log(`• ${decision.question}`);
          console.log(`  Chose: ${decision.chosen}`);
          console.log(`  Reasoning: ${decision.reasoning}`);
          if (decision.alternatives.length > 0) {
            const altStrings = decision.alternatives.map((a) =>
              typeof a === "string" ? a : a.option,
            );
            console.log(`  Alternatives: ${altStrings.join(", ")}`);
          }
          console.log("");
        }
        return;
      }

      // Show full details
      console.log(`Trajectory: ${trajectory.id}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`Title:   ${trajectory.task.title}`);
      console.log(`Status:  ${trajectory.status}`);
      console.log(`Started: ${trajectory.startedAt}`);
      if (trajectory.completedAt) {
        console.log(`Ended:   ${trajectory.completedAt}`);
      }

      if (trajectory.task.source) {
        console.log(
          `Source:  ${trajectory.task.source.system}:${trajectory.task.source.id}`,
        );
      }

      console.log(`\nChapters: ${trajectory.chapters.length}`);
      for (const chapter of trajectory.chapters) {
        console.log(`  • ${chapter.title} (${chapter.agentName})`);
        console.log(`    Events: ${chapter.events.length}`);
      }

      if (trajectory.retrospective) {
        console.log("\nRetrospective:");
        console.log(`  Summary: ${trajectory.retrospective.summary}`);
        console.log(
          `  Confidence: ${Math.round(trajectory.retrospective.confidence * 100)}%`,
        );
      }
    });
}

function extractDecisions(trajectory: any): Decision[] {
  const decisions: Decision[] = [];

  // From retrospective
  if (trajectory.retrospective?.decisions) {
    decisions.push(...trajectory.retrospective.decisions);
  }

  // From events
  for (const chapter of trajectory.chapters) {
    for (const event of chapter.events) {
      if (event.type === "decision" && event.raw) {
        const raw = event.raw as Decision;
        if (raw.question && raw.chosen && raw.reasoning) {
          if (!decisions.some((d) => d.question === raw.question)) {
            decisions.push(raw);
          }
        }
      }
    }
  }

  return decisions;
}
