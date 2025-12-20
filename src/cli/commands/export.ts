/**
 * traj export command
 */

import type { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { FileStorage } from "../../storage/file.js";
import { exportToMarkdown } from "../../export/markdown.js";
import { exportToJSON } from "../../export/json.js";
import { exportToTimeline } from "../../export/timeline.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export <id>")
    .description("Export a trajectory")
    .option("-f, --format <format>", "Export format (md, json, timeline)", "md")
    .option("-o, --output <path>", "Output file path")
    .action(async (id: string, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const trajectory = await storage.get(id);

      if (!trajectory) {
        console.error(`Error: Trajectory not found: ${id}`);
        throw new Error("Trajectory not found");
      }

      let output: string;

      switch (options.format) {
        case "json":
          output = exportToJSON(trajectory);
          break;
        case "timeline":
          output = exportToTimeline(trajectory);
          break;
        case "md":
        case "markdown":
        default:
          output = exportToMarkdown(trajectory);
          break;
      }

      if (options.output) {
        await writeFile(options.output, output, "utf-8");
        console.log(`✓ Exported to ${options.output}`);
      } else {
        console.log(output);
      }
    });
}
