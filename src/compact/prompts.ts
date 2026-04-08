/**
 * Prompt templates for trajectory compaction.
 */

const COMPACTED_TRAJECTORY_SCHEMA = `{
  "id": "compact_<id>",
  "version": 1,
  "type": "compacted",
  "compactedAt": "ISO-8601 timestamp",
  "sourceTrajectories": ["traj_..."],
  "dateRange": {
    "start": "ISO-8601 timestamp",
    "end": "ISO-8601 timestamp"
  },
  "summary": {
    "totalDecisions": 0,
    "totalEvents": 0,
    "uniqueAgents": ["agent-name"]
  },
  "decisionGroups": [
    {
      "category": "architecture",
      "decisions": [
        {
          "question": "What choice was made?",
          "chosen": "Selected option",
          "reasoning": "Why the choice was made",
          "fromTrajectory": "traj_..."
        }
      ]
    }
  ],
  "keyLearnings": ["Concise learning"],
  "keyFindings": ["Concise finding"],
  "filesAffected": ["src/example.ts"],
  "commits": ["abc1234"]
}`;

/**
 * System prompt for generating a compacted trajectory summary.
 */
export const COMPACTION_SYSTEM_PROMPT = `
You are compacting multiple engineering trajectories into a single structured summary.

Return only valid JSON. Do not include markdown, commentary, or code fences.

Your job:
- Analyze all provided trajectories together.
- Preserve important decisions, findings, learnings, files, commits, and agents.
- Group related decisions into useful topical categories.
- Deduplicate repeated facts while preserving which trajectory each decision came from.
- Prefer precise, factual summaries over speculative interpretation.

The JSON must match this shape exactly:
${COMPACTED_TRAJECTORY_SCHEMA}

Rules:
- "version" must be 1.
- "type" must be "compacted".
- "sourceTrajectories" must include every trajectory ID found in the input.
- "dateRange.start" must be the earliest trajectory start date.
- "dateRange.end" must be the latest completed date, or latest available date if incomplete.
- "summary.totalDecisions" must reflect the number of decision records in "decisionGroups".
- "summary.totalEvents" should reflect the total number of notable events represented from the input.
- "summary.uniqueAgents" must be deduplicated.
- "keyLearnings" and "keyFindings" should be concise single-sentence strings.
- "filesAffected" and "commits" must be deduplicated arrays.
- If a field cannot be inferred exactly, provide the best grounded value rather than omitting it.
`.trim();

/**
 * Build the user prompt with serialized trajectories and optional focus areas.
 */
export function buildCompactionUserPrompt(
  serialized: string,
  options?: { focus?: string },
): string {
  const focus = options?.focus?.trim();

  const lines = [
    "Compact the following trajectories into one JSON summary.",
    `Current timestamp: ${new Date().toISOString()}`,
    focus
      ? `Focus areas: ${focus}`
      : "Focus areas: overall decisions, cross-trajectory themes, learnings, and findings.",
    "Use the exact JSON structure from the system prompt.",
    "Do not omit required keys. Use concise wording and preserve trajectory IDs on each decision.",
    "Input trajectories:",
    serialized,
  ];

  return lines.join("\n\n");
}
