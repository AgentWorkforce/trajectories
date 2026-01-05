/**
 * trail show command
 */

import type { Command } from "commander";
import { existsSync } from "node:fs";
import { FileStorage, getSearchPaths } from "../../storage/file.js";
import type { Decision, Trajectory } from "../../core/types.js";

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
        delete process.env.TRAJECTORIES_DATA_DIR;
      }
    }
  }

  return null;
}

export function registerShowCommand(program: Command): void {
  program
    .command("show <id>")
    .description("Show trajectory details")
    .option("-d, --decisions", "Show decisions only")
    .action(async (id: string, options) => {
      const trajectory = await findTrajectory(id);

      if (!trajectory) {
        console.error(`Error: Trajectory not found: ${id}`);
        throw new Error("Trajectory not found");
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
            console.log(`  Alternatives: ${decision.alternatives.join(", ")}`);
          }
          console.log("");
        }
        return;
      }

      // Show full details
      console.log(`Trajectory: ${trajectory.id}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Title:   ${trajectory.task.title}`);
      console.log(`Status:  ${trajectory.status}`);
      console.log(`Started: ${trajectory.startedAt}`);
      if (trajectory.completedAt) {
        console.log(`Ended:   ${trajectory.completedAt}`);
      }

      if (trajectory.task.source) {
        console.log(`Source:  ${trajectory.task.source.system}:${trajectory.task.source.id}`);
      }

      console.log(`\nChapters: ${trajectory.chapters.length}`);
      for (const chapter of trajectory.chapters) {
        console.log(`  • ${chapter.title} (${chapter.agentName})`);
        console.log(`    Events: ${chapter.events.length}`);
      }

      if (trajectory.retrospective) {
        console.log(`\nRetrospective:`);
        console.log(`  Summary: ${trajectory.retrospective.summary}`);
        console.log(`  Confidence: ${Math.round(trajectory.retrospective.confidence * 100)}%`);
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
