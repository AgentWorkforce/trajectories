/**
 * traj search command
 */

import type { Command } from "commander";
import { FileStorage } from "../../storage/file.js";

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search trajectories")
    .option("-l, --limit <number>", "Limit results", parseInt, 20)
    .action(async (query: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const results = await storage.search(query, { limit: options.limit });

      if (results.length === 0) {
        console.log(`No trajectories found matching "${query}"`);
        return;
      }

      console.log(`Found ${results.length} trajectories matching "${query}":\n`);

      for (const traj of results) {
        const statusIcon = traj.status === "completed" ? "✅" : "🔄";
        console.log(`${statusIcon} ${traj.id}`);
        console.log(`   ${traj.title}`);
        console.log("");
      }
    });
}
