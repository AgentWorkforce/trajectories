/**
 * traj view command - Open trajectory in browser
 */

import type { Command } from "commander";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { FileStorage } from "../../storage/file.js";
import {
  generateTrajectoryHtml,
  generateIndexHtml,
} from "../../web/generator.js";

export function registerViewCommand(program: Command): void {
  program
    .command("view [id]")
    .description("Open trajectory in browser")
    .option("--all", "Generate index of all trajectories")
    .option("--output <dir>", "Output directory for generated files")
    .option("--no-open", "Generate files without opening browser")
    .action(async (id: string | undefined, options) => {
      const storage = new FileStorage();
      await storage.initialize();

      const outputDir = options.output || join(process.cwd(), ".trajectories", "html");
      await mkdir(outputDir, { recursive: true });

      if (options.all) {
        // Generate index + all trajectory pages
        const all = await storage.list();

        if (all.length === 0) {
          console.log("No trajectories to view");
          console.log('Start one with: traj start "Task description"');
          return;
        }

        // Generate index
        const indexHtml = generateIndexHtml(all);
        const indexPath = join(outputDir, "index.html");
        await writeFile(indexPath, indexHtml);

        // Generate individual pages
        for (const traj of all) {
          const html = generateTrajectoryHtml(traj);
          await writeFile(join(outputDir, `${traj.id}.html`), html);
        }

        console.log(`Generated ${all.length + 1} files in ${outputDir}`);

        if (options.open !== false) {
          openInBrowser(indexPath);
        }
        return;
      }

      // View specific trajectory or active one
      let trajectory;

      if (id) {
        trajectory = await storage.get(id);
        if (!trajectory) {
          console.error(`Trajectory not found: ${id}`);
          process.exitCode = 1;
          return;
        }
      } else {
        trajectory = await storage.getActive();
        if (!trajectory) {
          console.log("No active trajectory");
          console.log("Use: traj view <id> or traj view --all");
          return;
        }
      }

      const html = generateTrajectoryHtml(trajectory);
      const filePath = join(outputDir, `${trajectory.id}.html`);
      await writeFile(filePath, html);

      console.log(`Generated: ${filePath}`);

      if (options.open !== false) {
        openInBrowser(filePath);
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
