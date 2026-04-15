/**
 * trail compact command
 *
 * Compresses multiple trajectories into a single compacted summary.
 * Useful for reducing context after PR merges by organizing similar
 * decisions into grouped, understandable summaries.
 *
 * Default behavior: compact only trajectories that haven't been compacted yet.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { getCompactionConfig } from "../../compact/config.js";
import { generateCompactionMarkdown } from "../../compact/markdown.js";
import {
  type CompactedTrajectoryMetadata,
  type LLMCompactedOutput,
  mergeCompactionWithMetadata,
  parseCompactionResponse,
} from "../../compact/parser.js";
import { buildCompactionPrompt } from "../../compact/prompts.js";
import {
  AnthropicProvider,
  CLIProvider,
  type CompactionLLM,
  type Message,
  OpenAIProvider,
  resolveProvider,
} from "../../compact/provider.js";
import { serializeForLLM } from "../../compact/serializer.js";
import { generateRandomId } from "../../core/id.js";
import type { Decision, Trajectory } from "../../core/types.js";
import { FileStorage, getSearchPaths } from "../../storage/file.js";

/**
 * A group of related decisions
 */
interface DecisionGroup {
  category: string;
  decisions: Array<{
    question: string;
    chosen: string;
    reasoning: string;
    fromTrajectory: string;
  }>;
}

/**
 * Compacted trajectory summary — extends the shared metadata type from parser.ts
 * with mechanical compaction fields and optional LLM output.
 */
interface CompactedTrajectory extends CompactedTrajectoryMetadata {
  decisionGroups: DecisionGroup[];
  keyLearnings: string[];
  keyFindings: string[];
  workflowId?: string;
  narrative?: string;
  decisions?: LLMCompactedOutput["decisions"];
  conventions?: LLMCompactedOutput["conventions"];
  lessons?: LLMCompactedOutput["lessons"];
  openQuestions?: string[];
}

/**
 * Index entry with compaction tracking
 */
interface IndexEntry {
  title: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  path: string;
  compactedInto?: string;
}

interface TrajectoryIndex {
  version: number;
  lastUpdated: string;
  trajectories: Record<string, IndexEntry>;
}

interface CompactCommandOptions {
  since?: string;
  until?: string;
  ids?: string;
  workflow?: string;
  pr?: string;
  branch?: string;
  commits?: string;
  all?: boolean;
  llm?: boolean;
  mechanical?: boolean;
  focus?: string;
  markdown?: boolean;
  discardSources?: boolean;
  dryRun?: boolean;
  output?: string;
}

interface DiscardSourcesSummary {
  removedIndexEntries: number;
  deletedJsonFiles: number;
  deletedMarkdownFiles: number;
  deletedTraceFiles: number;
}

interface LLMCompactionPlan {
  messages: Message[];
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  focusAreas: string[];
}

export function registerCompactCommand(program: Command): void {
  program
    .command("compact")
    .description(
      "Compact trajectories into a summarized form (default: uncompacted only)",
    )
    .option(
      "--since <date>",
      "Include trajectories since this date (ISO format or relative like '7d')",
    )
    .option(
      "--until <date>",
      "Include trajectories until this date (ISO format)",
    )
    .option("--ids <ids>", "Comma-separated list of trajectory IDs to compact")
    .option(
      "--workflow <id>",
      "Compact trajectories with the specified workflow ID",
    )
    .option("--pr <number>", "Compact trajectories associated with a PR number")
    .option(
      "--branch <name>",
      "Compact trajectories with commits not in the specified branch (e.g., main)",
    )
    .option(
      "--commits <shas>",
      "Comma-separated commit SHAs to match trajectories against",
    )
    .option("--all", "Include all trajectories, even previously compacted ones")
    .option("--llm", "Use LLM-based compaction when a provider is available")
    .option("--no-llm", "Disable LLM-based compaction")
    .option("--mechanical", "Force the original mechanical compaction flow")
    .option(
      "--focus <areas>",
      "Comma-separated focus areas to emphasize in LLM compaction",
    )
    .option("--markdown", "Also write a Markdown companion file")
    .option("--no-markdown", "Skip writing a Markdown companion file")
    .option(
      "--discard-sources",
      "After saving the compaction, delete source trajectory JSON/MD/trace files and remove their index entries",
    )
    .option("--dry-run", "Preview what would be compacted without saving")
    .option("--output <path>", "Output path for compacted trajectory")
    .action(async (options: CompactCommandOptions) => {
      const trajectories = await loadTrajectories(options);

      if (trajectories.length === 0) {
        if (
          options.all ||
          options.since ||
          options.ids ||
          options.workflow ||
          options.pr ||
          options.branch ||
          options.commits
        ) {
          console.log("No trajectories found matching criteria");
        } else {
          console.log(
            "No uncompacted trajectories found. Use --all to include previously compacted.",
          );
        }
        return;
      }

      console.log(`Compacting ${trajectories.length} trajectories...\n`);

      const config = getCompactionConfig();
      const provider = await resolveProvider(config);
      const useLLM = shouldUseLLM(options, provider !== null);
      const markdownEnabled = options.markdown !== false;
      const mechanicalCompacted = compactTrajectories(
        trajectories,
        options.workflow,
      );

      if (!useLLM || provider === null) {
        if (options.llm && provider === null && !options.mechanical) {
          console.log(
            "No LLM provider detected; falling back to mechanical compaction.\n",
          );
        }

        if (options.dryRun) {
          console.log("=== DRY RUN - Preview ===\n");
          printCompactedSummary(mechanicalCompacted);
          return;
        }

        const outputPath =
          options.output ||
          getDefaultOutputPath(mechanicalCompacted, options.workflow);
        saveCompactionArtifacts(
          mechanicalCompacted,
          outputPath,
          markdownEnabled,
        );
        if (options.discardSources) {
          const discardSummary = discardSourceTrajectories(trajectories);
          printDiscardSummary(discardSummary);
        } else {
          await markTrajectoriesAsCompacted(
            trajectories,
            mechanicalCompacted.id,
          );
        }

        console.log(`\nCompacted trajectory saved to: ${outputPath}`);
        if (markdownEnabled) {
          console.log(
            `Markdown summary saved to: ${getMarkdownOutputPath(outputPath)}`,
          );
        }
        printCompactedSummary(mechanicalCompacted);
        return;
      }

      const llmPlan = buildLLMCompactionPlan(
        trajectories,
        parseFocusAreas(options.focus),
        config.maxInputTokens,
        config.maxOutputTokens,
      );

      console.log(
        `Using ${getProviderLabel(provider)} compaction${config.model ? ` with model ${config.model}` : ""}.`,
      );
      console.log(
        `Estimated: ~${llmPlan.estimatedInputTokens} input tokens, ~${llmPlan.estimatedOutputTokens} output tokens`,
      );

      if (options.dryRun) {
        printLLMDryRun(llmPlan, config.model, options.workflow);
        return;
      }

      const llmOutput = await provider.complete(llmPlan.messages, {
        maxTokens: config.maxOutputTokens,
        temperature: config.temperature,
        jsonMode: provider instanceof OpenAIProvider,
      });
      const llmCompacted = parseCompactionResponse(llmOutput);
      const mergedCompaction = mergeCompactionWithMetadata(
        {
          id: mechanicalCompacted.id,
          version: mechanicalCompacted.version,
          type: mechanicalCompacted.type,
          compactedAt: mechanicalCompacted.compactedAt,
          sourceTrajectories: mechanicalCompacted.sourceTrajectories,
          dateRange: mechanicalCompacted.dateRange,
          summary: mechanicalCompacted.summary,
          filesAffected: mechanicalCompacted.filesAffected,
          commits: mechanicalCompacted.commits,
        },
        llmCompacted,
      );
      const compacted: CompactedTrajectory = {
        ...mechanicalCompacted,
        ...mergedCompaction,
      };

      const outputPath =
        options.output || getDefaultOutputPath(compacted, options.workflow);
      saveCompactionArtifacts(compacted, outputPath, markdownEnabled);
      if (options.discardSources) {
        const discardSummary = discardSourceTrajectories(trajectories);
        printDiscardSummary(discardSummary);
      } else {
        await markTrajectoriesAsCompacted(trajectories, compacted.id);
      }

      console.log(`\nCompacted trajectory saved to: ${outputPath}`);
      if (markdownEnabled) {
        console.log(
          `Markdown summary saved to: ${getMarkdownOutputPath(outputPath)}`,
        );
      }
      printCompactedSummary(compacted);
    });
}

async function loadTrajectories(options: {
  since?: string;
  until?: string;
  ids?: string;
  workflow?: string;
  pr?: string;
  branch?: string;
  commits?: string;
  all?: boolean;
}): Promise<Trajectory[]> {
  const trajectories: Trajectory[] = [];
  const targetIds = options.ids
    ? options.ids.split(",").map((s) => s.trim())
    : null;

  // Parse date filters
  const sinceDate = options.since ? parseRelativeDate(options.since) : null;
  const untilDate = options.until ? new Date(options.until) : null;

  // Get commits on current branch not in target branch
  const branchCommits = options.branch
    ? getBranchCommits(options.branch)
    : null;

  // Parse --commits into a set with both full and short forms
  const targetCommits = options.commits
    ? new Set(
        options.commits.split(",").flatMap((sha) => {
          const trimmed = sha.trim();
          if (!trimmed) return [];
          return [trimmed, trimmed.slice(0, 7)];
        }),
      )
    : null;

  // Get compaction state from index
  const compactedIds = options.all
    ? new Set<string>()
    : getCompactedTrajectoryIds();

  const searchPaths = getSearchPaths();
  const seenIds = new Set<string>();

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) continue;

    // Set env var only for the synchronous FileStorage constructor, then
    // immediately restore to avoid leaking state across async boundaries.
    const originalDataDir = process.env.TRAJECTORIES_DATA_DIR;
    process.env.TRAJECTORIES_DATA_DIR = searchPath;
    const storage = new FileStorage();
    if (originalDataDir !== undefined) {
      process.env.TRAJECTORIES_DATA_DIR = originalDataDir;
    } else {
      // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset (assignment stores string "undefined")
      delete process.env.TRAJECTORIES_DATA_DIR;
    }

    await storage.initialize();

    const summaries = await storage.list({
      status: "completed",
      limit: Number.MAX_SAFE_INTEGER,
    });

    for (const summary of summaries) {
      if (seenIds.has(summary.id)) continue;

      // Skip already compacted (unless --all)
      if (compactedIds.has(summary.id)) continue;

      // Filter by IDs if specified
      if (targetIds && !targetIds.includes(summary.id)) continue;

      // Filter by date range
      const startDate = new Date(summary.startedAt);
      if (sinceDate && startDate < sinceDate) continue;
      if (untilDate && startDate > untilDate) continue;

      // Load full trajectory
      const trajectory = await storage.get(summary.id);
      if (trajectory) {
        seenIds.add(summary.id);

        // Filter by workflow if specified
        if (options.workflow && trajectory.workflowId !== options.workflow) {
          continue;
        }

        // Filter by PR if specified
        if (options.pr) {
          const escaped = options.pr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // Match "#N" or "PR #N" / "PR N" patterns, requiring word boundaries
          // to avoid false matches on words containing "pr" (e.g., "Improve")
          const prPattern = new RegExp(
            `#${escaped}\\b|\\bPR\\s*#?\\s*${escaped}\\b`,
            "i",
          );
          const matchesPR =
            prPattern.test(trajectory.task.title) ||
            prPattern.test(trajectory.task.description || "") ||
            trajectory.commits.some((c) => prPattern.test(c));

          if (!matchesPR) continue;
        }

        // Filter by branch if specified
        if (branchCommits) {
          const hasMatchingCommit = trajectory.commits.some(
            (c) => branchCommits.has(c.slice(0, 7)) || branchCommits.has(c),
          );
          if (!hasMatchingCommit && trajectory.commits.length > 0) continue;
          // Include trajectories with no commits (they might still be relevant)
        }

        // Filter by commits if specified
        if (targetCommits) {
          const hasMatchingCommit = trajectory.commits.some(
            (c) => targetCommits.has(c) || targetCommits.has(c.slice(0, 7)),
          );
          if (!hasMatchingCommit) continue;
        }

        trajectories.push(trajectory);
      }
    }
  }

  return trajectories;
}

/**
 * Get commits that are on the current branch but not in the target branch
 */
function getBranchCommits(targetBranch: string): Set<string> {
  const commits = new Set<string>();

  try {
    // Get commits on HEAD that are not in target branch
    const output = execFileSync(
      "git",
      ["log", `${targetBranch}..HEAD`, "--format=%H"],
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    for (const line of output.trim().split("\n")) {
      if (line) {
        commits.add(line);
        commits.add(line.slice(0, 7)); // Also add short hash
      }
    }
  } catch {
    // Not in a git repo or branch doesn't exist
    console.warn(
      `Warning: Could not get commits for branch comparison with ${targetBranch}`,
    );
  }

  return commits;
}

/**
 * Get IDs of trajectories that have already been compacted
 */
function getCompactedTrajectoryIds(): Set<string> {
  const compacted = new Set<string>();
  const searchPaths = getSearchPaths();

  for (const searchPath of searchPaths) {
    const indexPath = join(searchPath, "index.json");
    if (!existsSync(indexPath)) continue;

    try {
      const indexContent = readFileSync(indexPath, "utf-8");
      const index = JSON.parse(indexContent) as TrajectoryIndex;

      for (const [id, entry] of Object.entries(index.trajectories || {})) {
        if (entry.compactedInto) {
          compacted.add(id);
        }
      }
    } catch {
      // Index doesn't exist or is malformed
    }
  }

  return compacted;
}

/**
 * Mark trajectories as having been compacted into a specific compaction
 */
async function markTrajectoriesAsCompacted(
  trajectories: Trajectory[],
  compactedIntoId: string,
): Promise<void> {
  const searchPaths = getSearchPaths();

  for (const searchPath of searchPaths) {
    const indexPath = join(searchPath, "index.json");
    if (!existsSync(indexPath)) continue;

    try {
      const indexContent = readFileSync(indexPath, "utf-8");
      const index = JSON.parse(indexContent) as TrajectoryIndex;

      let updated = false;
      for (const traj of trajectories) {
        if (index.trajectories[traj.id]) {
          index.trajectories[traj.id].compactedInto = compactedIntoId;
          updated = true;
        }
      }

      if (updated) {
        index.lastUpdated = new Date().toISOString();
        writeFileSync(indexPath, JSON.stringify(index, null, 2));
      }
    } catch {
      // Index doesn't exist or is malformed
    }
  }
}

/**
 * Remove raw source trajectories after a durable compacted artifact has
 * been written. This keeps compaction as the long-lived record and makes
 * the index reflect only material that should remain visible.
 */
function discardSourceTrajectories(
  trajectories: Trajectory[],
): DiscardSourcesSummary {
  const sourceIds = new Set(trajectories.map((trajectory) => trajectory.id));
  const summary: DiscardSourcesSummary = {
    removedIndexEntries: 0,
    deletedJsonFiles: 0,
    deletedMarkdownFiles: 0,
    deletedTraceFiles: 0,
  };

  for (const searchPath of getSearchPaths()) {
    const indexPath = join(searchPath, "index.json");
    if (!existsSync(indexPath)) continue;

    let index: TrajectoryIndex;
    try {
      const indexContent = readFileSync(indexPath, "utf-8");
      const parsedIndex = JSON.parse(indexContent) as unknown;
      if (!isTrajectoryIndex(parsedIndex)) {
        continue;
      }
      index = parsedIndex;
    } catch {
      // Keep behavior consistent with markTrajectoriesAsCompacted: malformed
      // indexes are ignored instead of blocking an already-saved compaction.
      continue;
    }

    let updated = false;
    for (const id of sourceIds) {
      const entry = index.trajectories[id];
      if (!entry) continue;

      if (deleteFileIfExists(entry.path)) {
        summary.deletedJsonFiles += 1;
      }
      if (deleteFileIfExists(getMarkdownOutputPath(entry.path))) {
        summary.deletedMarkdownFiles += 1;
      }
      if (deleteFileIfExists(getTraceOutputPath(entry.path))) {
        summary.deletedTraceFiles += 1;
      }

      delete index.trajectories[id];
      summary.removedIndexEntries += 1;
      updated = true;
    }

    if (updated) {
      index.lastUpdated = new Date().toISOString();
      writeFileSync(indexPath, JSON.stringify(index, null, 2));
    }
  }

  return summary;
}

function deleteFileIfExists(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }

  unlinkSync(path);
  return true;
}

function isTrajectoryIndex(value: unknown): value is TrajectoryIndex {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TrajectoryIndex>;
  return (
    candidate.trajectories !== null &&
    typeof candidate.trajectories === "object" &&
    !Array.isArray(candidate.trajectories)
  );
}

function getTraceOutputPath(outputPath: string): string {
  return outputPath.endsWith(".json")
    ? outputPath.slice(0, -".json".length).concat(".trace.json")
    : `${outputPath}.trace.json`;
}

function printDiscardSummary(summary: DiscardSourcesSummary): void {
  console.log(
    `Discarded source trajectories: ${summary.removedIndexEntries} index entries, ${summary.deletedJsonFiles} JSON files, ${summary.deletedMarkdownFiles} Markdown files, ${summary.deletedTraceFiles} trace files`,
  );
}

function parseRelativeDate(input: string): Date {
  // Handle relative dates like "7d", "2w", "1m"
  const match = input.match(/^(\d+)([dwmh])$/);
  if (match) {
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case "h":
        return new Date(now.getTime() - amount * 60 * 60 * 1000);
      case "d":
        return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
      case "w":
        return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
      case "m":
        return new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
    }
  }

  // Otherwise try to parse as ISO date
  return new Date(input);
}

function compactTrajectories(
  trajectories: Trajectory[],
  workflowId?: string,
): CompactedTrajectory {
  const allDecisions: Array<{
    decision: Decision;
    fromTrajectory: string;
    timestamp: number;
  }> = [];
  const allLearnings: string[] = [];
  const allFindings: string[] = [];
  const allFiles = new Set<string>();
  const allCommits = new Set<string>();
  const allAgents = new Set<string>();
  let totalEvents = 0;

  // Extract data from all trajectories
  for (const traj of trajectories) {
    // Collect agents
    for (const agent of traj.agents) {
      allAgents.add(agent.name);
    }

    // Collect files and commits
    for (const file of traj.filesChanged) {
      allFiles.add(file);
    }
    for (const commit of traj.commits) {
      allCommits.add(commit);
    }

    // Extract decisions from chapters
    for (const chapter of traj.chapters) {
      totalEvents += chapter.events.length;

      for (const event of chapter.events) {
        if (event.type === "decision" && event.raw) {
          const decision = event.raw as Decision;
          allDecisions.push({
            decision,
            fromTrajectory: traj.id,
            timestamp: event.ts,
          });
        }

        if (event.type === "finding" && event.content) {
          allFindings.push(event.content);
        }
      }
    }

    // Extract learnings from retrospective
    if (traj.retrospective?.learnings) {
      allLearnings.push(...traj.retrospective.learnings);
    }

    // Also extract decisions from retrospective
    if (traj.retrospective?.decisions) {
      for (const decision of traj.retrospective.decisions) {
        allDecisions.push({
          decision,
          fromTrajectory: traj.id,
          timestamp: new Date(traj.completedAt || traj.startedAt).getTime(),
        });
      }
    }
  }

  // Group decisions by category/topic
  const decisionGroups = groupDecisions(allDecisions);

  // Dedupe learnings
  const uniqueLearnings = [...new Set(allLearnings)];

  // Calculate date range
  const dates = trajectories.map((t) => new Date(t.startedAt).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(
    Math.max(
      ...trajectories.map((t) =>
        new Date(t.completedAt || t.startedAt).getTime(),
      ),
    ),
  );

  return {
    id: `compact_${generateRandomId()}`,
    version: 1,
    type: "compacted",
    compactedAt: new Date().toISOString(),
    workflowId,
    sourceTrajectories: trajectories.map((t) => t.id),
    dateRange: {
      start: minDate.toISOString(),
      end: maxDate.toISOString(),
    },
    summary: {
      totalDecisions: allDecisions.length,
      totalEvents,
      uniqueAgents: [...allAgents],
    },
    decisionGroups,
    keyLearnings: uniqueLearnings,
    keyFindings: [...new Set(allFindings)],
    filesAffected: [...allFiles],
    commits: [...allCommits],
  };
}

function groupDecisions(
  decisions: Array<{
    decision: Decision;
    fromTrajectory: string;
    timestamp: number;
  }>,
): DecisionGroup[] {
  // Simple categorization based on keywords in the question/reasoning
  const categories: Record<string, DecisionGroup> = {};

  const categoryKeywords: Record<string, string[]> = {
    architecture: [
      "architecture",
      "structure",
      "pattern",
      "design",
      "module",
      "component",
    ],
    api: ["api", "endpoint", "rest", "graphql", "http", "request", "response"],
    database: ["database", "schema", "migration", "query", "sql", "model"],
    testing: ["test", "spec", "coverage", "assertion", "mock"],
    security: [
      "security",
      "auth",
      "permission",
      "token",
      "credential",
      "encrypt",
    ],
    performance: ["performance", "optimize", "cache", "speed", "memory"],
    tooling: ["tool", "config", "build", "lint", "format", "ci", "cd"],
    naming: ["name", "rename", "convention", "format"],
    compliance: ["spec", "standard", "compliance", "convention", "align"],
  };

  for (const { decision, fromTrajectory } of decisions) {
    const text = `${decision.question} ${decision.reasoning}`.toLowerCase();

    let matchedCategory = "other";
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => text.includes(kw))) {
        matchedCategory = category;
        break;
      }
    }

    if (!categories[matchedCategory]) {
      categories[matchedCategory] = {
        category: matchedCategory,
        decisions: [],
      };
    }

    categories[matchedCategory].decisions.push({
      question: decision.question,
      chosen: decision.chosen,
      reasoning: decision.reasoning,
      fromTrajectory,
    });
  }

  // Sort categories by number of decisions
  return Object.values(categories).sort(
    (a, b) => b.decisions.length - a.decisions.length,
  );
}

function shouldUseLLM(
  options: Pick<CompactCommandOptions, "llm" | "mechanical">,
  providerAvailable: boolean,
): boolean {
  if (options.mechanical) {
    return false;
  }

  if (options.llm === false) {
    return false;
  }

  if (options.llm === true) {
    return providerAvailable;
  }

  return providerAvailable;
}

function buildLLMCompactionPlan(
  trajectories: Trajectory[],
  focusAreas: string[],
  maxInputTokens: number,
  maxOutputTokens: number,
): LLMCompactionPlan {
  const serialized = serializeForLLM(trajectories, maxInputTokens);
  const messages = buildCompactionPrompt(serialized, {
    focusAreas,
    maxOutputTokens,
  });

  return {
    messages,
    estimatedInputTokens: estimateTokens(
      messages.map((message) => message.content).join("\n\n"),
    ),
    estimatedOutputTokens: maxOutputTokens,
    focusAreas,
  };
}

function parseFocusAreas(focus?: string): string[] {
  if (!focus) {
    return [];
  }

  return focus
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function printLLMDryRun(
  plan: LLMCompactionPlan,
  model: string | undefined,
  workflowId?: string,
): void {
  console.log("=== DRY RUN - LLM Prompt Preview ===\n");
  console.log(
    `Estimated: ~${plan.estimatedInputTokens} input tokens, ~${plan.estimatedOutputTokens} output tokens`,
  );
  if (model) {
    console.log(`Configured model: ${model}`);
  }
  if (workflowId) {
    console.log(`Workflow: ${workflowId}`);
  }
  if (plan.focusAreas.length > 0) {
    console.log(`Focus: ${plan.focusAreas.join(", ")}`);
  }
  console.log("");

  for (const message of plan.messages) {
    console.log(`[${message.role.toUpperCase()}]`);
    console.log(message.content);
    console.log("");
  }
}

function getProviderLabel(provider: CompactionLLM): string {
  if (provider instanceof OpenAIProvider) {
    return "OpenAI";
  }

  if (provider instanceof AnthropicProvider) {
    return "Anthropic";
  }

  if (provider instanceof CLIProvider) {
    return `CLI (${provider.cliName})`;
  }

  return "LLM";
}

function getDefaultOutputPath(
  compacted: CompactedTrajectory,
  workflowId?: string,
): string {
  const trajDir = process.env.TRAJECTORIES_DATA_DIR || ".trajectories";
  const compactedDir = join(trajDir, "compacted");

  if (!existsSync(compactedDir)) {
    mkdirSync(compactedDir, { recursive: true });
  }

  if (workflowId) {
    return join(compactedDir, `workflow-${workflowId}.json`);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  return join(compactedDir, `${compacted.id}_${dateStr}.json`);
}

function saveCompactionArtifacts(
  compacted: CompactedTrajectory,
  outputPath: string,
  markdownEnabled: boolean,
): void {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outputPath, JSON.stringify(compacted, null, 2));

  if (markdownEnabled) {
    writeFileSync(
      getMarkdownOutputPath(outputPath),
      renderCompactionMarkdown(compacted),
    );
  }
}

function getMarkdownOutputPath(outputPath: string): string {
  return outputPath.endsWith(".json")
    ? outputPath.slice(0, -".json".length).concat(".md")
    : `${outputPath}.md`;
}

function renderCompactionMarkdown(compacted: CompactedTrajectory): string {
  if (compacted.narrative) {
    return generateCompactionMarkdown(
      compacted as Parameters<typeof generateCompactionMarkdown>[0],
    );
  }

  const decisionGroups =
    compacted.decisionGroups.length > 0
      ? compacted.decisionGroups
          .map((group) => {
            const decisions =
              group.decisions.length > 0
                ? group.decisions
                    .map(
                      (decision) =>
                        `- ${decision.question} -> ${decision.chosen} (${decision.fromTrajectory})`,
                    )
                    .join("\n")
                : "- None";
            return `## ${capitalize(group.category)}\n${decisions}`;
          })
          .join("\n\n")
      : "## Decision Groups\n- None";
  const learnings =
    compacted.keyLearnings.length > 0
      ? compacted.keyLearnings.map((learning) => `- ${learning}`).join("\n")
      : "- None";
  const findings =
    compacted.keyFindings.length > 0
      ? compacted.keyFindings.map((finding) => `- ${finding}`).join("\n")
      : "- None";

  return [
    `# Trajectory Compaction: ${formatDate(compacted.dateRange.start)} - ${formatDate(compacted.dateRange.end)}`,
    "",
    "## Summary",
    `- Sessions: ${compacted.sourceTrajectories.length}`,
    ...(compacted.workflowId ? [`- Workflow: ${compacted.workflowId}`] : []),
    `- Decisions: ${compacted.summary.totalDecisions}`,
    `- Events: ${compacted.summary.totalEvents}`,
    `- Agents: ${compacted.summary.uniqueAgents.join(", ") || "None"}`,
    `- Files: ${compacted.filesAffected.length}`,
    `- Commits: ${compacted.commits.length}`,
    "",
    decisionGroups,
    "",
    "## Key Learnings",
    learnings,
    "",
    "## Key Findings",
    findings,
  ].join("\n");
}

function printCompactedSummary(compacted: CompactedTrajectory): void {
  console.log("=== Compacted Trajectory Summary ===\n");
  console.log(`ID: ${compacted.id}`);
  if (compacted.workflowId) {
    console.log(`Workflow: ${compacted.workflowId}`);
  }
  console.log(`Source trajectories: ${compacted.sourceTrajectories.length}`);
  console.log(
    `Date range: ${formatDate(compacted.dateRange.start)} - ${formatDate(compacted.dateRange.end)}`,
  );
  console.log(`Total decisions: ${compacted.summary.totalDecisions}`);
  console.log(`Total events: ${compacted.summary.totalEvents}`);
  console.log(`Agents: ${compacted.summary.uniqueAgents.join(", ")}`);
  console.log("");

  if (compacted.narrative) {
    console.log("=== Narrative ===\n");
    console.log(compacted.narrative);
    console.log("");

    if (compacted.decisions && compacted.decisions.length > 0) {
      console.log("=== Key Decisions ===\n");
      for (const decision of compacted.decisions.slice(0, 5)) {
        console.log(`  - ${decision.question}`);
        console.log(`    Chosen: ${decision.chosen}`);
        if (decision.impact) {
          console.log(`    Impact: ${decision.impact}`);
        }
      }
      if (compacted.decisions.length > 5) {
        console.log(`  ... and ${compacted.decisions.length - 5} more`);
      }
      console.log("");
    }

    if (compacted.openQuestions && compacted.openQuestions.length > 0) {
      console.log("=== Open Questions ===\n");
      for (const question of compacted.openQuestions.slice(0, 5)) {
        console.log(`  - ${question}`);
      }
      if (compacted.openQuestions.length > 5) {
        console.log(`  ... and ${compacted.openQuestions.length - 5} more`);
      }
      console.log("");
    }
  } else {
    console.log("=== Decision Groups ===\n");
    for (const group of compacted.decisionGroups) {
      console.log(
        `${capitalize(group.category)} (${group.decisions.length} decisions):`,
      );
      for (const decision of group.decisions.slice(0, 3)) {
        console.log(`  - ${decision.question}`);
        console.log(`    Chose: ${decision.chosen}`);
      }
      if (group.decisions.length > 3) {
        console.log(`  ... and ${group.decisions.length - 3} more`);
      }
      console.log("");
    }

    if (compacted.keyLearnings.length > 0) {
      console.log("=== Key Learnings ===\n");
      for (const learning of compacted.keyLearnings.slice(0, 5)) {
        console.log(`  - ${learning}`);
      }
      if (compacted.keyLearnings.length > 5) {
        console.log(`  ... and ${compacted.keyLearnings.length - 5} more`);
      }
      console.log("");
    }
  }

  if (compacted.filesAffected.length > 0) {
    console.log(`Files affected: ${compacted.filesAffected.length}`);
  }
  if (compacted.commits.length > 0) {
    console.log(`Commits: ${compacted.commits.length}`);
  }
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
