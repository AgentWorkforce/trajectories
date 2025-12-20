/**
 * traj workspace commands - manage the knowledge workspace
 */

import type { Command } from "commander";
import { WorkspaceStorage } from "../../workspace/storage.js";
import { FileStorage } from "../../storage/file.js";

export function registerWorkspaceCommand(program: Command): void {
  const workspace = program
    .command("workspace")
    .alias("ws")
    .description("Manage the knowledge workspace");

  // Query the workspace
  workspace
    .command("query <search>")
    .description("Search the workspace for decisions, patterns, knowledge")
    .option("-t, --type <type>", "Filter by type: decision, pattern, knowledge")
    .option("-l, --limit <n>", "Limit results", "10")
    .action(async (search: string, options) => {
      const ws = new WorkspaceStorage();
      await ws.initialize();

      const results = await ws.query({
        query: search,
        type: options.type,
        limit: parseInt(options.limit, 10),
      });

      const hasResults =
        results.decisions.length +
          results.patterns.length +
          results.knowledge.length >
        0;

      if (!hasResults) {
        console.log(`No results for "${search}"`);
        return;
      }

      if (results.decisions.length > 0) {
        console.log(`\n📋 Decisions (${results.decisions.length})`);
        console.log("─".repeat(40));
        for (const d of results.decisions) {
          console.log(`  ${d.title}`);
          console.log(`    ${d.reasoning}`);
          console.log(`    Source: ${d.sourceTrajectory}`);
        }
      }

      if (results.patterns.length > 0) {
        console.log(`\n📐 Patterns (${results.patterns.length})`);
        console.log("─".repeat(40));
        for (const p of results.patterns) {
          console.log(`  ${p.title}`);
          console.log(`    ${p.description}`);
        }
      }

      if (results.knowledge.length > 0) {
        console.log(`\n📚 Knowledge (${results.knowledge.length})`);
        console.log("─".repeat(40));
        for (const k of results.knowledge) {
          console.log(`  [${k.category}] ${k.title}`);
        }
      }
    });

  // Promote a decision from a trajectory
  workspace
    .command("promote-decision <trajectoryId>")
    .description("Promote a decision from a trajectory to the workspace")
    .option("-i, --index <n>", "Decision index (0-based)", "0")
    .option("--tags <tags>", "Comma-separated tags")
    .action(async (trajectoryId: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const ws = new WorkspaceStorage();
      await ws.initialize();

      const trajectory = await storage.get(trajectoryId);
      if (!trajectory) {
        console.error(`Trajectory not found: ${trajectoryId}`);
        process.exitCode = 1;
        return;
      }

      // Find all decisions in the trajectory
      const decisions: Array<{ content: string; reasoning: string; alternatives?: string[] }> = [];
      for (const chapter of trajectory.chapters) {
        for (const event of chapter.events) {
          if (event.type === "decision") {
            decisions.push({
              content: event.content,
              reasoning: (event.metadata?.reasoning as string) || "",
              alternatives: event.metadata?.alternatives as string[] | undefined,
            });
          }
        }
      }

      if (decisions.length === 0) {
        console.log("No decisions found in this trajectory");
        return;
      }

      const index = parseInt(options.index, 10);
      if (index < 0 || index >= decisions.length) {
        console.error(
          `Invalid index. Trajectory has ${decisions.length} decisions (0-${decisions.length - 1})`
        );
        process.exitCode = 1;
        return;
      }

      const decision = decisions[index];
      const tags = options.tags ? options.tags.split(",").map((t: string) => t.trim()) : [];

      const promoted = await ws.addDecision({
        title: decision.content,
        context: trajectory.task.title,
        decision: decision.content,
        reasoning: decision.reasoning,
        alternatives: decision.alternatives,
        sourceTrajectory: trajectoryId,
        sourceDate: trajectory.startedAt,
        tags,
        status: "active",
      });

      console.log(`Decision promoted: ${promoted.id}`);
      console.log(`  Title: ${promoted.title}`);
      console.log(`  From: ${trajectory.task.title}`);
    });

  // Add a pattern
  workspace
    .command("add-pattern <title>")
    .description("Add a reusable pattern to the workspace")
    .requiredOption("-d, --description <desc>", "Pattern description")
    .requiredOption("-w, --when <when>", "When to use this pattern")
    .option("-s, --structure <struct>", "Template structure")
    .option("-e, --example <example>", "Example usage")
    .option("--tags <tags>", "Comma-separated tags")
    .action(async (title: string, options) => {
      const ws = new WorkspaceStorage();
      await ws.initialize();

      const tags = options.tags ? options.tags.split(",").map((t: string) => t.trim()) : [];

      const pattern = await ws.addPattern({
        title,
        description: options.description,
        when: options.when,
        structure: options.structure || "",
        example: options.example,
        sourceTrajectories: [],
        tags,
      });

      console.log(`Pattern added: ${pattern.id}`);
      console.log(`  Title: ${pattern.title}`);
    });

  // Add knowledge
  workspace
    .command("add-knowledge <title>")
    .description("Add a knowledge document to the workspace")
    .requiredOption("-c, --category <cat>", "Category: architecture, convention, guide, reference")
    .requiredOption("-t, --content <content>", "Content (markdown)")
    .option("--tags <tags>", "Comma-separated tags")
    .action(async (title: string, options) => {
      const ws = new WorkspaceStorage();
      await ws.initialize();

      const tags = options.tags ? options.tags.split(",").map((t: string) => t.trim()) : [];

      const knowledge = await ws.addKnowledge({
        title,
        category: options.category,
        content: options.content,
        sourceTrajectories: [],
        tags,
      });

      console.log(`Knowledge added: ${knowledge.id}`);
      console.log(`  Title: ${knowledge.title}`);
      console.log(`  Category: ${knowledge.category}`);
    });

  // List workspace contents
  workspace
    .command("list")
    .description("List all workspace contents")
    .option("-t, --type <type>", "Filter by type: decision, pattern, knowledge")
    .action(async (options) => {
      const ws = new WorkspaceStorage();
      await ws.initialize();

      const showDecisions = !options.type || options.type === "decision";
      const showPatterns = !options.type || options.type === "pattern";
      const showKnowledge = !options.type || options.type === "knowledge";

      if (showDecisions) {
        const decisions = await ws.listDecisions();
        console.log(`\n📋 Decisions (${decisions.length})`);
        console.log("─".repeat(40));
        if (decisions.length === 0) {
          console.log("  (none)");
        } else {
          for (const d of decisions) {
            const status = d.status === "active" ? "●" : "○";
            console.log(`  ${status} ${d.title}`);
            console.log(`    ${d.id} | ${d.tags.join(", ") || "no tags"}`);
          }
        }
      }

      if (showPatterns) {
        const patterns = await ws.listPatterns();
        console.log(`\n📐 Patterns (${patterns.length})`);
        console.log("─".repeat(40));
        if (patterns.length === 0) {
          console.log("  (none)");
        } else {
          for (const p of patterns) {
            console.log(`  ${p.title}`);
            console.log(`    ${p.id} | ${p.description.slice(0, 50)}...`);
          }
        }
      }

      if (showKnowledge) {
        const knowledge = await ws.listKnowledge();
        console.log(`\n📚 Knowledge (${knowledge.length})`);
        console.log("─".repeat(40));
        if (knowledge.length === 0) {
          console.log("  (none)");
        } else {
          for (const k of knowledge) {
            console.log(`  [${k.category}] ${k.title}`);
            console.log(`    ${k.id}`);
          }
        }
      }
    });
}
