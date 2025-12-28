/**
 * trail export command
 */

import type { Command } from "commander";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { FileStorage } from "../../storage/file.js";
import { exportToMarkdown } from "../../export/markdown.js";
import { exportToJSON } from "../../export/json.js";
import { exportToTimeline } from "../../export/timeline.js";
import { generateTrajectoryHtml } from "../../web/generator.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export [id]")
    .description("Export a trajectory")
    .option("-f, --format <format>", "Export format (md, json, timeline, html)", "md")
    .option("-o, --output <path>", "Output file path")
    .option("--open", "Open in browser (html format only)")
    .action(async (id: string | undefined, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      // If no ID provided, use active trajectory
      let trajectory;
      if (id) {
        trajectory = await storage.get(id);
        if (!trajectory) {
          console.error(`Error: Trajectory not found: ${id}`);
          throw new Error("Trajectory not found");
        }
      } else {
        trajectory = await storage.getActive();
        if (!trajectory) {
          console.error("Error: No active trajectory and no ID provided");
          console.error("Usage: trail export <id> or trail export (with active trajectory)");
          throw new Error("No trajectory specified");
        }
      }

      let output: string;

      switch (options.format) {
        case "json":
          output = exportToJSON(trajectory);
          break;
        case "timeline":
          output = exportToTimeline(trajectory);
          break;
        case "html":
          output = generateTrajectoryHtml(trajectory);
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

        if (options.open && options.format === "html") {
          openInBrowser(options.output);
        }
      } else if (options.open && options.format === "html") {
        // Write to temp location and open
        const outputDir = join(process.cwd(), ".trajectories", "html");
        await mkdir(outputDir, { recursive: true });
        const filePath = join(outputDir, `${trajectory.id}.html`);
        await writeFile(filePath, output, "utf-8");
        console.log(`✓ Generated: ${filePath}`);
        openInBrowser(filePath);
      } else {
        console.log(output);
      }
    });
}

function openInBrowser(path: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === "darwin") {
    command = `open "${path}"`;
  } else if (platform === "win32") {
    command = `start "" "${path}"`;
  } else {
    command = `xdg-open "${path}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log(`Open manually: file://${path}`);
    }
  });
}
