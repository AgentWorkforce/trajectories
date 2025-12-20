/**
 * trail context command - Generate context summary for AI tools
 */

import type { Command } from "commander";
import { FileStorage } from "../../storage/file.js";
import { WorkspaceStorage } from "../../workspace/storage.js";

export function registerContextCommand(program: Command): void {
  program
    .command("context")
    .description("Generate context summary for AI tools")
    .option("-f, --format <format>", "Output format: text, markdown, json", "text")
    .option("--decisions <n>", "Number of recent decisions", "5")
    .option("--patterns", "Include patterns", false)
    .action(async (options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const workspace = new WorkspaceStorage();
      await workspace.initialize();

      const active = await storage.getActive();
      const decisions = await workspace.listDecisions();
      const patterns = await workspace.listPatterns();
      const knowledge = await workspace.listKnowledge();

      const decisionLimit = parseInt(options.decisions, 10);

      if (options.format === "json") {
        console.log(
          JSON.stringify(
            {
              activeTrajectory: active
                ? {
                    id: active.id,
                    task: active.task.title,
                    chapters: active.chapters.length,
                  }
                : null,
              recentDecisions: decisions.slice(0, decisionLimit).map((d) => ({
                title: d.title,
                reasoning: d.reasoning,
              })),
              patterns: patterns.map((p) => ({
                title: p.title,
                when: p.when,
              })),
              knowledge: knowledge.map((k) => ({
                title: k.title,
                category: k.category,
              })),
            },
            null,
            2
          )
        );
        return;
      }

      if (options.format === "markdown") {
        console.log("# Project Context\n");

        if (active) {
          console.log("## Active Work\n");
          console.log(`Currently working on: **${active.task.title}**`);
          console.log(`Trajectory: \`${active.id}\``);
          console.log(`Chapters: ${active.chapters.length}\n`);
        }

        if (decisions.length > 0) {
          console.log("## Recent Decisions\n");
          for (const d of decisions.slice(0, decisionLimit)) {
            console.log(`- **${d.title}**: ${d.reasoning}`);
          }
          console.log("");
        }

        if (options.patterns && patterns.length > 0) {
          console.log("## Patterns\n");
          for (const p of patterns) {
            console.log(`- **${p.title}**: ${p.when}`);
          }
          console.log("");
        }

        if (knowledge.length > 0) {
          console.log("## Knowledge Base\n");
          for (const k of knowledge) {
            console.log(`- [${k.category}] ${k.title}`);
          }
          console.log("");
        }
        return;
      }

      // Text format (default)
      console.log("PROJECT CONTEXT");
      console.log("═".repeat(50));

      if (active) {
        console.log(`\nActive: ${active.task.title}`);
        console.log(`        ${active.id} (${active.chapters.length} chapters)`);
      } else {
        console.log("\nNo active trajectory");
      }

      if (decisions.length > 0) {
        console.log(`\nRecent Decisions (${Math.min(decisions.length, decisionLimit)}):`);
        for (const d of decisions.slice(0, decisionLimit)) {
          console.log(`  • ${d.title}`);
          console.log(`    ${d.reasoning}`);
        }
      }

      if (options.patterns && patterns.length > 0) {
        console.log(`\nPatterns (${patterns.length}):`);
        for (const p of patterns) {
          console.log(`  • ${p.title}: ${p.when}`);
        }
      }

      if (knowledge.length > 0) {
        console.log(`\nKnowledge (${knowledge.length}):`);
        for (const k of knowledge) {
          console.log(`  • [${k.category}] ${k.title}`);
        }
      }

      console.log("\n" + "─".repeat(50));
      console.log("Use: trail context --format markdown > CLAUDE.md");
    });
}
