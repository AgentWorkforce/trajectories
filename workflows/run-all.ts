#!/usr/bin/env npx tsx
/**
 * Trail Viewer — Master Workflow Executor
 *
 * Runs all 95 workflows across 23 waves, respecting dependencies
 * and maximizing parallelism within each wave.
 *
 * Usage:
 *   npx tsx workflows/run-all.ts                    # run everything
 *   npx tsx workflows/run-all.ts --from=7           # resume from wave 7
 *   npx tsx workflows/run-all.ts --wave=9           # run only wave 9
 *   npx tsx workflows/run-all.ts --dry-run           # just print the plan
 *   npx tsx workflows/run-all.ts --list              # list all workflows
 *   npx tsx workflows/run-all.ts --server-only       # only server waves (17-21)
 *   npx tsx workflows/run-all.ts --app-only          # only app waves (1-16)
 *
 * Each workflow uses: Claude (lead/planner) + Codex (worker/implementer)
 */

import { type ChildProcess, execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Wave Definitions ────────────────────────────────────────────────────

interface WaveConfig {
  id: number;
  name: string;
  workflows: number[];
  parallel: boolean;
  commitMessage: string;
  category: "app" | "server" | "polish";
}

const waves: WaveConfig[] = [
  // ── App Foundation ──────────────────────────────────────────────────
  {
    id: 1,
    name: "Project Scaffold",
    workflows: [1, 2, 3],
    parallel: true,
    commitMessage: "chore: scaffold Trail Viewer macOS app",
    category: "app",
  },
  {
    id: 2,
    name: "Design Tokens",
    workflows: [4, 5, 6, 7],
    parallel: true,
    commitMessage: "feat: add design tokens — colors, typography, animations",
    category: "app",
  },
  {
    id: 3,
    name: "Design Components",
    workflows: [8, 9, 10, 11, 12, 13],
    parallel: true,
    commitMessage:
      "feat: add design components — cards, badges, skeleton, toast",
    category: "app",
  },
  {
    id: 4,
    name: "Data Models",
    workflows: [14, 15, 16, 17],
    parallel: true,
    commitMessage: "feat: add Codable data models",
    category: "app",
  },
  {
    id: 5,
    name: "Services",
    workflows: [18, 19, 20, 21],
    parallel: true,
    commitMessage: "feat: add API client, relay, CLI detector, server manager",
    category: "app",
  },
  {
    id: 6,
    name: "State Stores",
    workflows: [22, 23, 24, 25],
    parallel: true,
    commitMessage: "feat: add observable stores",
    category: "app",
  },

  // ── App Views ───────────────────────────────────────────────────────
  {
    id: 7,
    name: "Sidebar Views",
    workflows: [26, 27, 28, 29, 30],
    parallel: true,
    commitMessage: "feat: add trajectory list sidebar",
    category: "app",
  },
  {
    id: 8,
    name: "Detail Header & Navigation",
    workflows: [31, 32, 33, 34],
    parallel: true,
    commitMessage: "feat: add detail header, chapter nav, timeline rail",
    category: "app",
  },
  {
    id: 9,
    name: "Event Type Views (fan-out)",
    workflows: [35], // single fan-out workflow replaces 35-42
    parallel: true,
    commitMessage: "feat: add all 8 event type views (fan-out pattern)",
    category: "app",
  },
  {
    id: 10,
    name: "Decision & Retrospective",
    workflows: [43, 44, 45],
    parallel: true,
    commitMessage:
      "feat: add decision card, retrospective view, confidence meter",
    category: "app",
  },
  {
    id: 11,
    name: "Chapter & Detail Container",
    workflows: [46, 47, 48],
    parallel: false,
    commitMessage: "feat: add chapter view and detail container",
    category: "app",
  },
  {
    id: 12,
    name: "Chat Components (fan-out)",
    workflows: [49], // single fan-out workflow replaces 49-54
    parallel: true,
    commitMessage: "feat: add all 6 chat components (fan-out pattern)",
    category: "app",
  },
  {
    id: 13,
    name: "Chat Container",
    workflows: [55, 56, 57],
    parallel: false,
    commitMessage: "feat: add persona selector, empty states, chat panel",
    category: "app",
  },
  {
    id: 14,
    name: "Overlays & Settings",
    workflows: [58, 59, 60, 61, 62],
    parallel: true,
    commitMessage: "feat: add command palette, welcome, settings views",
    category: "app",
  },
  {
    id: 15,
    name: "App Integration (hub-spoke)",
    workflows: [63], // single hub-spoke workflow replaces 63-66
    parallel: false,
    commitMessage:
      "feat: wire all views — hub-spoke integration with lead review",
    category: "app",
  },
  {
    id: 16,
    name: "Export & File Detail",
    workflows: [67, 68, 69],
    parallel: true,
    commitMessage:
      "feat: add export sheet, file detail modal, search highlighting",
    category: "app",
  },

  // ── Server ──────────────────────────────────────────────────────────
  {
    id: 17,
    name: "Server Scaffold",
    workflows: [70, 71, 72],
    parallel: true,
    commitMessage: "chore: scaffold TypeScript server",
    category: "server",
  },
  {
    id: 18,
    name: "Trajectory API",
    workflows: [73, 74, 75, 76],
    parallel: true,
    commitMessage: "feat: add trajectory service, formatter, REST routes",
    category: "server",
  },
  {
    id: 19,
    name: "Chat Infrastructure",
    workflows: [77, 78, 79, 80, 81],
    parallel: false,
    commitMessage: "feat: add chat session, personas, relay integration",
    category: "server",
  },
  {
    id: 20,
    name: "WebSocket Bridge",
    workflows: [82, 83, 84],
    parallel: false,
    commitMessage: "feat: add WebSocket bridge and final server wiring",
    category: "server",
  },
  {
    id: 21,
    name: "Testing & Launch",
    workflows: [85, 86, 87, 88],
    parallel: true,
    commitMessage: "feat: add mock data, tests, and launch script",
    category: "server",
  },

  // ── Polish ──────────────────────────────────────────────────────────
  {
    id: 22,
    name: "Accessibility & Polish",
    workflows: [89, 90, 91, 92],
    parallel: true,
    commitMessage: "feat: add accessibility, relative time, clipboard service",
    category: "polish",
  },
  {
    id: 23,
    name: "macOS Native Integration",
    workflows: [96, 97],
    parallel: true,
    commitMessage: "feat: add Spotlight indexing + Quick Look preview",
    category: "polish",
  },
  {
    id: 24,
    name: "Final Verification",
    workflows: [93, 94, 95],
    parallel: true,
    commitMessage: "chore: verify builds and run smoke tests",
    category: "polish",
  },
];

// ── Workflow filename mapping ───────────────────────────────────────────

function workflowFilename(id: number): string {
  const padded = String(id).padStart(2, "0");
  return `${padded}.ts`;
}

function workflowPath(id: number): string {
  return resolve(__dirname, workflowFilename(id));
}

// ── Runner ──────────────────────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function runWorkflow(
  id: number,
): Promise<{ id: number; exitCode: number; duration: number }> {
  const filepath = workflowPath(id);
  const filename = workflowFilename(id);
  const start = Date.now();

  if (!existsSync(filepath)) {
    log(`  ⚠ ${filename} not found — skipping`);
    return Promise.resolve({ id, exitCode: 0, duration: 0 });
  }

  return new Promise((resolve) => {
    log(`  ▸ Starting ${filename}`);
    const child = spawn("agent-relay", ["run", filepath], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", (code) => {
      const dur = Math.round((Date.now() - start) / 1000);
      const icon = code === 0 ? "✓" : "✗";
      log(`  ${icon} ${filename} (${dur}s)`);
      resolve({ id, exitCode: code ?? 1, duration: dur });
    });

    child.on("error", (err) => {
      const dur = Math.round((Date.now() - start) / 1000);
      log(`  ✗ ${filename} — ${err.message}`);
      resolve({ id, exitCode: 1, duration: dur });
    });
  });
}

async function runWave(wave: WaveConfig): Promise<boolean> {
  log(`\n${"═".repeat(64)}`);
  log(
    `  Wave ${wave.id}: ${wave.name} (${wave.workflows.length} workflows, ${wave.parallel ? "parallel" : "sequential"})`,
  );
  log(`${"═".repeat(64)}`);

  let results: { id: number; exitCode: number; duration: number }[];

  if (wave.parallel) {
    results = await Promise.all(wave.workflows.map(runWorkflow));
  } else {
    results = [];
    for (const wfId of wave.workflows) {
      const result = await runWorkflow(wfId);
      results.push(result);
      if (result.exitCode !== 0) {
        log(`  ⚠ Workflow ${wfId} failed — stopping wave`);
        break;
      }
    }
  }

  const failed = results.filter((r) => r.exitCode !== 0);
  const wallTime = Math.max(...results.map((r) => r.duration), 0);

  if (failed.length > 0) {
    log(
      `  ✗ Wave ${wave.id} FAILED: workflows ${failed.map((f) => f.id).join(", ")}`,
    );
    return false;
  }

  // Commit wave
  try {
    execSync(
      `git add -A && git diff --cached --quiet || git commit -m "${wave.commitMessage}"`,
      { cwd: process.cwd(), stdio: "pipe" },
    );
  } catch {}

  log(`  ✓ Wave ${wave.id} complete (${wallTime}s wall time)`);
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isList = args.includes("--list");
  const serverOnly = args.includes("--server-only");
  const appOnly = args.includes("--app-only");
  const fromWave = Number.parseInt(
    args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "1",
  );
  const singleWave = args.find((a) => a.startsWith("--wave="))?.split("=")[1];

  const totalWorkflows = waves.reduce((n, w) => n + w.workflows.length, 0);

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║             Trail Viewer — Master Build Executor              ║",
  );
  console.log(
    "║                                                                ║",
  );
  console.log(
    `║  ${totalWorkflows} workflows · ${waves.length} waves · Claude leads + Codex workers       ║`,
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );

  // ── List mode ─────────────────────────────────────────────────────
  if (isList) {
    for (const wave of waves) {
      console.log(
        `\nWave ${wave.id}: ${wave.name} [${wave.category}] ${wave.parallel ? "(parallel)" : "(sequential)"}`,
      );
      for (const wfId of wave.workflows) {
        const exists = existsSync(workflowPath(wfId));
        const icon = exists ? "  ✓" : "  ○";
        console.log(`${icon} ${workflowFilename(wfId)}`);
      }
    }
    const existCount = waves
      .flatMap((w) => w.workflows)
      .filter((id) => existsSync(workflowPath(id))).length;
    console.log(`\n${existCount}/${totalWorkflows} workflow files exist`);
    return;
  }

  // ── Filter waves ──────────────────────────────────────────────────
  let targetWaves = waves;
  if (serverOnly) targetWaves = waves.filter((w) => w.category === "server");
  if (appOnly) targetWaves = waves.filter((w) => w.category === "app");
  if (singleWave)
    targetWaves = waves.filter((w) => w.id === Number.parseInt(singleWave));

  // ── Dry run ───────────────────────────────────────────────────────
  if (isDryRun) {
    console.log("\n  DRY RUN — showing execution plan:\n");
    for (const wave of targetWaves) {
      if (wave.id < fromWave) continue;
      const mode = wave.parallel ? "║ parallel" : "→ sequential";
      console.log(`  Wave ${String(wave.id).padStart(2)}: ${wave.name}`);
      for (const wfId of wave.workflows) {
        const exists = existsSync(workflowPath(wfId));
        console.log(
          `    ${mode} ${workflowFilename(wfId)} ${exists ? "" : "(missing)"}`,
        );
      }
    }
    return;
  }

  // ── Execute ───────────────────────────────────────────────────────
  const overallStart = Date.now();
  const results: { wave: number; name: string; success: boolean }[] = [];

  for (const wave of targetWaves) {
    if (wave.id < fromWave) {
      log(`  Skipping Wave ${wave.id} (--from=${fromWave})`);
      continue;
    }

    const success = await runWave(wave);
    results.push({ wave: wave.id, name: wave.name, success });

    if (!success) {
      log(
        `\n⚠ Build stopped at Wave ${wave.id}. Fix and resume with: --from=${wave.id}`,
      );
      break;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - overallStart) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  console.log(`\n${"═".repeat(64)}`);
  console.log("  BUILD SUMMARY");
  console.log("═".repeat(64));
  for (const r of results) {
    console.log(
      `  ${r.success ? "✓" : "✗"} Wave ${String(r.wave).padStart(2)}: ${r.name}`,
    );
  }
  console.log(`\n  Total time: ${mins}m ${secs}s`);

  if (results.every((r) => r.success)) {
    console.log(
      "\n  Build complete! Run: cd trail-viewer && ./launch.sh --mock",
    );
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
