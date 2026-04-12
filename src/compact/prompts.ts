export interface Message {
  role: "system" | "user";
  content: string;
}

export interface PromptOptions {
  focusAreas?: string[];
  maxOutputTokens?: number;
}

export const COMPACTION_SYSTEM_PROMPT = `You are a technical analyst reviewing agent work sessions (trajectories).
Your job is to produce a concise, insightful summary that captures:
- What was accomplished and how
- Key decisions and their reasoning
- Patterns/conventions established that should be followed in future work
- Lessons learned from challenges and failures
- Open questions or unresolved issues

Be specific. Reference actual file paths, function names, and technical details.
Don't be generic - this summary replaces the raw data.`;

export const COMPACTED_OUTPUT_SCHEMA = `{
  "narrative": "string",
  "decisions": [
    {
      "question": "string",
      "chosen": "string",
      "reasoning": "string",
      "impact": "string"
    }
  ],
  "conventions": [
    {
      "pattern": "string",
      "rationale": "string",
      "scope": "string"
    }
  ],
  "lessons": [
    {
      "lesson": "string",
      "context": "string",
      "recommendation": "string"
    }
  ],
  "openQuestions": ["string"]
}`;

export function buildCompactionPrompt(
  serializedTrajectories: string,
  options: PromptOptions = {},
): Message[] {
  const focusAreas =
    options.focusAreas && options.focusAreas.length > 0
      ? options.focusAreas.map((area) => `- ${area}`).join("\n")
      : [
          "- What work was attempted, completed, or abandoned",
          "- Why specific technical decisions were made",
          "- Which conventions should carry forward",
          "- What broke, what worked, and what should change next time",
        ].join("\n");

  const maxOutputInstruction = options.maxOutputTokens
    ? `Keep the full response within approximately ${options.maxOutputTokens} tokens while preserving technical specificity.`
    : "Keep the response concise, dense with signal, and avoid filler.";

  const userPrompt = [
    "Review the following serialized agent trajectories and return a single JSON object.",
    "The JSON must match this schema exactly:",
    COMPACTED_OUTPUT_SCHEMA,
    "",
    "Requirements:",
    "- Output raw JSON only. Do not wrap it in markdown fences.",
    "- `narrative` should be 2-3 tight paragraphs.",
    "- `decisions`, `conventions`, and `lessons` must always be arrays, even if empty.",
    "- Prefer concrete file paths, symbols, commands, and implementation details over generic summaries.",
    maxOutputInstruction,
    "",
    "Focus areas:",
    focusAreas,
    "",
    "Serialized trajectories:",
    serializedTrajectories.trim(),
  ].join("\n");

  return [
    {
      role: "system",
      content: COMPACTION_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];
}
