/**
 * trail show command
 */

import type { Command } from "commander";
import { FileStorage } from "../../storage/file.js";
import type { Decision } from "../../core/types.js";

export function registerShowCommand(program: Command): void {
  program
    .command("show <id>")
    .description("Show trajectory details")
    .option("-d, --decisions", "Show decisions only")
    .action(async (id: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const trajectory = await storage.get(id);

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
