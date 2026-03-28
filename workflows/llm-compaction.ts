/**
 * llm-compaction.ts
 *
 * Workflow: Replace the mechanical compaction in compact.ts with
 * LLM-powered intelligent summarization.
 *
 * Current state: compactTrajectories() does keyword-based decision grouping
 * and string deduplication. No understanding of what actually happened.
 *
 * Target state: An LLM reads raw trajectory data (chapters, events, decisions,
 * findings, retrospectives) and produces:
 *   1. A narrative summary of what was accomplished
 *   2. Key decisions with real reasoning (not keyword-matched categories)
 *   3. Extracted conventions/patterns that should inform future work
 *   4. Lessons learned from failures/challenges
 *   5. A compact .md file that's actually useful to read
 *
 * The LLM compaction should work with any provider (OpenAI, Anthropic, local)
 * via a simple chat completion interface.
 *
 * Run: agent-relay run workflows/llm-compaction.ts
 */

import { workflow } from "@agent-relay/sdk/workflows";

const TRAJ_ROOT = "/Users/khaliqgant/Projects/Agent Workforce/trajectories";

async function main() {
  const result = await workflow("llm-compaction")
    .description(
      "Replace mechanical trajectory compaction with LLM-powered intelligent summarization",
    )
    .pattern("dag")
    .channel("wf-llm-compaction")
    .maxConcurrency(4)
    .timeout(3_600_000)

    .agent("architect", {
      cli: "claude",
      role: "Designs the LLM compaction system",
    })
    .agent("llm-builder", {
      cli: "codex",
      preset: "worker",
      role: "Builds the LLM compaction engine",
    })
    .agent("prompt-builder", {
      cli: "codex",
      preset: "worker",
      role: "Builds prompts and output parsing",
    })
    .agent("cli-builder", {
      cli: "codex",
      preset: "worker",
      role: "Updates the CLI compact command",
    })
    .agent("reviewer", { cli: "claude", role: "Reviews the implementation" })

    .step("design-llm-compaction", {
      agent: "architect",
      task: `Design the LLM-powered trajectory compaction system.

Read these files:
- ${TRAJ_ROOT}/src/cli/commands/compact.ts (current mechanical compaction — ~400 lines)
- ${TRAJ_ROOT}/src/core/types.ts (Trajectory, Chapter, TrajectoryEvent, Decision, Finding, Retrospective types)
- ${TRAJ_ROOT}/src/core/trajectory.ts (trajectory lifecycle)

Current problems with compactTrajectories():
1. Groups decisions by keyword matching ("architecture", "api", "database") — misses nuance
2. Just dedupes learnings as strings — doesn't synthesize
3. Produces a JSON blob — not a readable document
4. No understanding of what was attempted vs what worked
5. No extraction of reusable patterns/conventions

Design the replacement:

1. **LLM Provider Interface** (${TRAJ_ROOT}/src/compact/provider.ts):
   - CompactionLLM interface: { complete(messages, options): string }
   - OpenAIProvider, AnthropicProvider, LocalProvider implementations
   - Config from env: TRAJECTORIES_LLM_PROVIDER, TRAJECTORIES_LLM_MODEL, API key
   - Fallback: if no LLM configured, use current mechanical compaction

2. **Trajectory Serializer** (${TRAJ_ROOT}/src/compact/serializer.ts):
   - serializeForLLM(trajectories): string — converts raw trajectories to a
     structured text format the LLM can read efficiently
   - Strips noise (raw tool call data, low-significance events)
   - Keeps: decisions, findings, errors, high-significance events, retrospectives
   - Budgets tokens: truncate chapters beyond a max (configurable)
   - Includes file-level context: "Files changed: src/auth.ts, src/db/schema.ts"

3. **Compaction Prompts** (${TRAJ_ROOT}/src/compact/prompts.ts):
   - COMPACTION_SYSTEM_PROMPT: role definition for the summarizer
   - COMPACTION_USER_PROMPT: template with serialized trajectories
   - Output format: structured JSON with narrative sections
   - Prompt engineering for consistency: "You are reviewing N agent work sessions..."

4. **Output Parser** (${TRAJ_ROOT}/src/compact/parser.ts):
   - Parse LLM JSON response into CompactedTrajectory
   - Validate required fields
   - Fallback: if LLM returns invalid JSON, extract what we can

5. **Compacted Output Format** — enhanced from current:
   - narrative: string — 2-3 paragraph summary of what happened
   - decisions: Array<{ question, chosen, reasoning, impact }> — LLM-analyzed
   - conventions: Array<{ pattern, rationale, scope }> — extracted conventions
   - lessons: Array<{ lesson, context, recommendation }> — synthesized learnings
   - openQuestions: string[] — things left unresolved
   - filesAffected: string[] — keep as-is
   - commits: string[] — keep as-is

6. **Markdown Output** (${TRAJ_ROOT}/src/compact/markdown.ts):
   - Generate a readable .md file alongside the JSON
   - Sections: Summary, Key Decisions, Conventions Established, Lessons Learned, Open Questions
   - This is what humans actually read

Output: interfaces, file structure, prompt outline, token budget strategy.
Keep output under 100 lines. End with DESIGN_COMPACTION_COMPLETE.`,
      verification: {
        type: "output_contains",
        value: "DESIGN_COMPACTION_COMPLETE",
      },
      timeout: 300_000,
    })

    .step("create-llm-engine", {
      agent: "llm-builder",
      dependsOn: ["design-llm-compaction"],
      task: `Build the LLM compaction engine.

Design: {{steps.design-llm-compaction.output}}

Create in ${TRAJ_ROOT}/src/compact/:

1. provider.ts — LLM provider interface + implementations:
   - CompactionLLM interface: complete(messages: Message[], options?: CompletionOptions): Promise<string>
   - Message: { role: 'system' | 'user' | 'assistant', content: string }
   - CompletionOptions: { maxTokens?: number, temperature?: number, jsonMode?: boolean }
   - OpenAIProvider: uses fetch to POST /v1/chat/completions (no SDK dep)
     Env: OPENAI_API_KEY, TRAJECTORIES_LLM_MODEL (default: gpt-4o)
   - AnthropicProvider: uses fetch to POST /v1/messages
     Env: ANTHROPIC_API_KEY, TRAJECTORIES_LLM_MODEL (default: claude-sonnet-4-20250514)
   - resolveProvider(): auto-detect from env vars, fallback to null
   - No new npm dependencies — raw fetch only

2. serializer.ts — Trajectory → LLM-readable text:
   - serializeForLLM(trajectories: Trajectory[], maxTokens?: number): string
   - For each trajectory:
     - Header: "## Session: {title} ({status}, {duration})"
     - Agents: who participated and their roles
     - Chapters: title + high/medium/critical events only (skip low)
     - Decisions: full question + chosen + reasoning
     - Findings: what + where + significance
     - Retrospective: summary + approach + challenges + learnings
     - Files changed + commits
   - Token budgeting: estimate ~4 chars per token
     If total > maxTokens (default 30000), truncate chapters proportionally
   - Skip: raw tool call data, tool results, low-significance events

3. index.ts — Re-export everything

End with LLM_ENGINE_COMPLETE.`,
      verification: { type: "output_contains", value: "LLM_ENGINE_COMPLETE" },
      timeout: 900_000,
    })

    .step("create-prompts-parser", {
      agent: "prompt-builder",
      dependsOn: ["design-llm-compaction"],
      task: `Build the compaction prompts and output parser.

Design: {{steps.design-llm-compaction.output}}

Create in ${TRAJ_ROOT}/src/compact/:

1. prompts.ts — Compaction prompt templates:

   COMPACTION_SYSTEM_PROMPT:
   "You are a technical analyst reviewing agent work sessions (trajectories).
    Your job is to produce a concise, insightful summary that captures:
    - What was accomplished and how
    - Key decisions and their reasoning
    - Patterns/conventions established that should be followed in future work
    - Lessons learned from challenges and failures
    - Open questions or unresolved issues
    
    Be specific. Reference actual file paths, function names, and technical details.
    Don't be generic — this summary replaces the raw data."

   buildCompactionPrompt(serializedTrajectories: string, options?: PromptOptions): Message[]
   - Constructs system + user messages
   - User message includes the serialized trajectories
   - Requests structured JSON output matching CompactedOutput schema
   - Includes output schema in the prompt for format guidance

   PromptOptions: { focusAreas?: string[], maxOutputTokens?: number }

2. parser.ts — Parse LLM response:
   - parseCompactionResponse(llmOutput: string): LLMCompactedOutput
   - LLMCompactedOutput: {
       narrative: string,
       decisions: Array<{ question, chosen, reasoning, impact }>,
       conventions: Array<{ pattern, rationale, scope }>,
       lessons: Array<{ lesson, context, recommendation }>,
       openQuestions: string[],
     }
   - Try JSON.parse first
   - If fails: try extracting JSON from markdown code blocks
   - If fails: try extracting sections from prose (regex for ## headers)
   - Validate: narrative required, decisions/conventions/lessons arrays
   - Merge with mechanical data (files, commits, agents) for full CompactedTrajectory

3. markdown.ts — Generate readable .md:
   - generateCompactionMarkdown(compacted: CompactedTrajectory & LLMCompactedOutput): string
   - Format:
     # Trajectory Compaction: {dateRange}
     
     ## Summary
     {narrative}
     
     ## Key Decisions ({count})
     | Question | Decision | Impact |
     |----------|----------|--------|
     
     ## Conventions Established
     - **{pattern}**: {rationale} (scope: {scope})
     
     ## Lessons Learned
     - {lesson} — {recommendation}
     
     ## Open Questions
     - {question}
     
     ## Stats
     - Sessions: {count}, Agents: {names}, Files: {count}, Commits: {count}
     - Date range: {start} - {end}

End with PROMPTS_PARSER_COMPLETE.`,
      verification: {
        type: "output_contains",
        value: "PROMPTS_PARSER_COMPLETE",
      },
      timeout: 900_000,
    })

    .step("update-cli", {
      agent: "cli-builder",
      dependsOn: ["create-llm-engine", "create-prompts-parser"],
      task: `Update the CLI compact command to use LLM compaction.

Modify ${TRAJ_ROOT}/src/cli/commands/compact.ts:

1. Add --llm flag (default: true if LLM provider detected, false otherwise)
2. Add --mechanical flag to force old behavior
3. Add --focus <areas> flag: comma-separated focus areas for the LLM
4. Add --markdown flag (default: true): also output .md file

Updated flow:
a) Load trajectories (existing loadTrajectories — keep as-is)
b) If --mechanical or no LLM provider: use existing compactTrajectories()
c) If LLM available:
   1. serializeForLLM(trajectories) → text
   2. buildCompactionPrompt(text, options) → messages
   3. provider.complete(messages) → llmOutput
   4. parseCompactionResponse(llmOutput) → llmCompacted
   5. Merge with mechanical data (files, commits, agents)
   6. Save JSON to .trajectories/compacted/
   7. Save .md alongside if --markdown
   8. Print summary

d) Keep dry-run working with LLM (show prompt + estimated tokens)
e) Show cost estimate: "Estimated: ~{tokens} input tokens, ~{output} output tokens"

Also create:
- ${TRAJ_ROOT}/src/compact/config.ts — Configuration:
  - getCompactionConfig(): reads from env or .trajectories/config.json
  - Config: { provider, model, maxInputTokens, maxOutputTokens, temperature }
  - Defaults: provider=auto, maxInput=30000, maxOutput=4000, temperature=0.3

Add tests:
- ${TRAJ_ROOT}/tests/compact/llm-compact.test.ts
  - Test serializer with sample trajectories
  - Test parser with sample LLM output
  - Test markdown generation
  - Test fallback to mechanical when no LLM

End with CLI_UPDATE_COMPLETE.`,
      verification: { type: "output_contains", value: "CLI_UPDATE_COMPLETE" },
      timeout: 900_000,
    })

    .step("review-compaction", {
      agent: "reviewer",
      dependsOn: ["update-cli"],
      task: `Review the LLM compaction system.

Files:
- ${TRAJ_ROOT}/src/compact/provider.ts
- ${TRAJ_ROOT}/src/compact/serializer.ts
- ${TRAJ_ROOT}/src/compact/prompts.ts
- ${TRAJ_ROOT}/src/compact/parser.ts
- ${TRAJ_ROOT}/src/compact/markdown.ts
- ${TRAJ_ROOT}/src/compact/config.ts
- ${TRAJ_ROOT}/src/compact/index.ts
- ${TRAJ_ROOT}/src/cli/commands/compact.ts (modified)
- ${TRAJ_ROOT}/tests/compact/llm-compact.test.ts

Verify:
1. No new npm dependencies (raw fetch only for LLM calls)
2. Graceful fallback: no API key → mechanical compaction
3. Token budgeting prevents exceeding model context window
4. Parser handles malformed LLM output without crashing
5. Prompt is specific enough to get useful output, not generic summaries
6. Markdown output is clean and readable
7. Dry-run shows prompt + cost estimate without calling LLM
8. Config can be set via env vars OR .trajectories/config.json
9. Existing mechanical compaction still works with --mechanical flag
10. Tests cover serializer, parser, markdown, and fallback

Fix issues. Keep output under 50 lines. End with COMPACTION_REVIEW_COMPLETE.`,
      verification: {
        type: "output_contains",
        value: "COMPACTION_REVIEW_COMPLETE",
      },
      timeout: 300_000,
    })

    .step("commit", {
      agent: "llm-builder",
      dependsOn: ["review-compaction"],
      task: `In ${TRAJ_ROOT}:
1. git checkout -b feat/llm-compaction
2. git add src/compact/ src/cli/commands/compact.ts tests/compact/
3. git commit -m "feat: LLM-powered trajectory compaction

Replaces mechanical keyword-based compaction with intelligent LLM summarization.

New compact/ module:
  - provider.ts: OpenAI + Anthropic providers (raw fetch, no deps)
  - serializer.ts: trajectory → LLM-readable text with token budgeting
  - prompts.ts: system + user prompts for compaction
  - parser.ts: parse LLM JSON output with fallbacks
  - markdown.ts: generate readable .md summaries
  - config.ts: env vars or .trajectories/config.json

CLI updates:
  - trail compact now uses LLM by default (if API key present)
  - --mechanical flag for old behavior
  - --focus <areas> for targeted summaries
  - --markdown flag (default: true) for .md output
  - Dry-run shows prompt + cost estimate

Output includes:
  - Narrative summary (what happened, how)
  - Key decisions with reasoning and impact
  - Extracted conventions/patterns for future work
  - Synthesized lessons from challenges
  - Open questions / unresolved issues

Backwards compatible: falls back to mechanical if no LLM provider."
4. git push origin feat/llm-compaction

Report commit hash. End with COMMIT_COMPLETE.`,
      verification: { type: "output_contains", value: "COMMIT_COMPLETE" },
      timeout: 120_000,
    })

    .onError("retry", { maxRetries: 1, retryDelayMs: 10_000 })
    .run({ cwd: process.cwd() });

  console.log("LLM compaction complete:", result.status);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
