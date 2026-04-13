export interface CompactedDecision {
  question: string;
  chosen: string;
  reasoning: string;
  impact: string;
}

export interface CompactedConvention {
  pattern: string;
  rationale: string;
  scope: string;
}

export interface CompactedLesson {
  lesson: string;
  context: string;
  recommendation: string;
}

export interface LLMCompactedOutput {
  narrative: string;
  decisions: CompactedDecision[];
  conventions: CompactedConvention[];
  lessons: CompactedLesson[];
  openQuestions: string[];
}

export interface CompactedTrajectoryMetadata {
  id: string;
  version: number;
  type: "compacted";
  compactedAt: string;
  sourceTrajectories: string[];
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalDecisions: number;
    totalEvents: number;
    uniqueAgents: string[];
  };
  filesAffected: string[];
  commits: string[];
}

export type CompactedTrajectory = CompactedTrajectoryMetadata &
  LLMCompactedOutput;

export function parseCompactionResponse(llmOutput: string): LLMCompactedOutput {
  const trimmed = llmOutput.trim();
  const parsedJson =
    parseJsonCandidate(trimmed) ??
    parseJsonCandidate(extractFirstMarkdownJsonBlock(trimmed)) ??
    parseJsonCandidate(extractBalancedJsonObject(trimmed));

  if (parsedJson) {
    return normalizeCompactionOutput(parsedJson, trimmed);
  }

  return normalizeCompactionOutput(extractFromProse(trimmed), trimmed);
}

export function mergeCompactionWithMetadata(
  metadata: CompactedTrajectoryMetadata,
  llmOutput: LLMCompactedOutput,
): CompactedTrajectory {
  return {
    ...metadata,
    ...llmOutput,
  };
}

function parseJsonCandidate(candidate: string | null): unknown | null {
  if (!candidate) {
    return null;
  }

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function extractFirstMarkdownJsonBlock(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : null;
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function extractFromProse(text: string): Partial<LLMCompactedOutput> {
  const sections = splitSections(text);
  const narrativeSection =
    sections.narrative ?? sections.summary ?? leadingNarrative(text);

  return {
    narrative: normalizeText(narrativeSection),
    decisions: parseDecisionSection(
      sections["key decisions"] ?? sections.decisions ?? "",
    ),
    conventions: parseConventionSection(
      sections["conventions established"] ?? sections.conventions ?? "",
    ),
    lessons: parseLessonSection(
      sections["lessons learned"] ?? sections.lessons ?? "",
    ),
    openQuestions: parseStringList(
      sections["open questions"] ?? sections.questions ?? "",
    ),
  };
}

function splitSections(text: string): Record<string, string> {
  const matches = [...text.matchAll(/^##+\s+(.+?)\s*$/gm)];
  const sections: Record<string, string> = {};

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const title = normalizeHeading(current[1]);
    const start =
      current.index === undefined ? 0 : current.index + current[0].length;
    const end = next?.index ?? text.length;
    sections[title] = text.slice(start, end).trim();
  }

  return sections;
}

function normalizeHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(\d+\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function leadingNarrative(text: string): string {
  const beforeHeading = text.split(/^##+\s+/m, 1)[0] ?? "";
  const withoutCode = beforeHeading.replace(/```[\s\S]*?```/g, "").trim();
  return withoutCode;
}

function normalizeCompactionOutput(
  raw: unknown,
  fallbackNarrativeSource: string,
): LLMCompactedOutput {
  const candidate = isRecord(raw) ? raw : {};

  const narrative = normalizeText(
    typeof candidate.narrative === "string"
      ? candidate.narrative
      : typeof candidate.summary === "string"
        ? candidate.summary
        : typeof candidate.overview === "string"
          ? candidate.overview
          : leadingNarrative(fallbackNarrativeSource),
  );

  return {
    narrative:
      narrative ||
      normalizeText(fallbackNarrativeSource) ||
      "No narrative provided.",
    decisions: normalizeDecisionArray(candidate.decisions),
    conventions: normalizeConventionArray(candidate.conventions),
    lessons: normalizeLessonArray(candidate.lessons),
    openQuestions: normalizeStringArray(
      candidate.openQuestions ??
        candidate.open_questions ??
        candidate.questions,
    ),
  };
}

function normalizeDecisionArray(value: unknown): CompactedDecision[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          question: normalizeText(entry),
          chosen: "",
          reasoning: "",
          impact: "",
        };
      }

      if (!isRecord(entry)) {
        return null;
      }

      return {
        question: readString(entry, ["question", "prompt", "topic"]),
        chosen: readString(entry, ["chosen", "decision", "answer"]),
        reasoning: readString(entry, ["reasoning", "why", "rationale"]),
        impact: readString(entry, ["impact", "result", "outcome"]),
      };
    })
    .filter((entry): entry is CompactedDecision => {
      return entry !== null && hasContent(Object.values(entry));
    });
}

function normalizeConventionArray(value: unknown): CompactedConvention[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          pattern: normalizeText(entry),
          rationale: "",
          scope: "",
        };
      }

      if (!isRecord(entry)) {
        return null;
      }

      return {
        pattern: readString(entry, ["pattern", "rule", "convention"]),
        rationale: readString(entry, ["rationale", "reasoning", "why"]),
        scope: readString(entry, ["scope", "appliesTo", "applies_to"]),
      };
    })
    .filter((entry): entry is CompactedConvention => {
      return entry !== null && hasContent(Object.values(entry));
    });
}

function normalizeLessonArray(value: unknown): CompactedLesson[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          lesson: normalizeText(entry),
          context: "",
          recommendation: "",
        };
      }

      if (!isRecord(entry)) {
        return null;
      }

      return {
        lesson: readString(entry, ["lesson", "learning", "takeaway"]),
        context: readString(entry, ["context", "situation", "when"]),
        recommendation: readString(entry, [
          "recommendation",
          "suggestion",
          "nextStep",
          "next_step",
        ]),
      };
    })
    .filter((entry): entry is CompactedLesson => {
      return entry !== null && hasContent(Object.values(entry));
    });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? normalizeText(entry) : ""))
    .filter(Boolean);
}

function parseDecisionSection(section: string): CompactedDecision[] {
  const tableDecisions = parseMarkdownTable(section).map((row) => ({
    question: row[0] ?? "",
    chosen: row[1] ?? "",
    reasoning: row[2] ?? "",
    impact: row[3] ?? row[2] ?? "",
  }));

  if (tableDecisions.length > 0) {
    return tableDecisions.filter((entry) => hasContent(Object.values(entry)));
  }

  return parseListItems(section)
    .map((item) => {
      const fields = parseFieldMap(item);
      return {
        question:
          fields.question ??
          fields.prompt ??
          fields.topic ??
          fields.title ??
          item,
        chosen: fields.chosen ?? fields.decision ?? fields.answer ?? "",
        reasoning: fields.reasoning ?? fields.rationale ?? fields.why ?? "",
        impact: fields.impact ?? fields.outcome ?? fields.result ?? "",
      };
    })
    .filter((entry) => hasContent(Object.values(entry)));
}

function parseConventionSection(section: string): CompactedConvention[] {
  return parseListItems(section)
    .map((item) => {
      const emphasized = item.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
      const scopeMatch = item.match(/\((?:scope|applies to):\s*([^)]+)\)\s*$/i);
      const withoutScope = scopeMatch
        ? item.slice(0, scopeMatch.index).trim()
        : item;

      if (emphasized) {
        return {
          pattern: normalizeText(emphasized[1]),
          rationale: normalizeText(
            withoutScope.replace(/^\*\*(.+?)\*\*:\s*/, ""),
          ),
          scope: normalizeText(scopeMatch?.[1] ?? ""),
        };
      }

      const fields = parseFieldMap(item);
      return {
        pattern: fields.pattern ?? fields.convention ?? fields.rule ?? item,
        rationale: fields.rationale ?? fields.reasoning ?? fields.why ?? "",
        scope: fields.scope ?? fields.applies ?? "",
      };
    })
    .filter((entry) => hasContent(Object.values(entry)));
}

function parseLessonSection(section: string): CompactedLesson[] {
  return parseListItems(section)
    .map((item) => {
      const fields = parseFieldMap(item);
      const dashParts = item.split(/\s[—-]\s/, 2);

      return {
        lesson:
          fields.lesson ??
          fields.learning ??
          fields.takeaway ??
          dashParts[0] ??
          item,
        context: fields.context ?? "",
        recommendation:
          fields.recommendation ??
          fields.suggestion ??
          fields.nextstep ??
          dashParts[1] ??
          "",
      };
    })
    .filter((entry) => hasContent(Object.values(entry)));
}

function parseStringList(section: string): string[] {
  return parseListItems(section).map(normalizeText).filter(Boolean);
}

function parseMarkdownTable(section: string): string[][] {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 2) {
    return [];
  }

  return lines
    .slice(1)
    .filter((line) => !/^\|?\s*:?-{3,}/.test(line.replace(/\|/g, "")))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => normalizeText(cell)),
    );
}

function parseListItems(section: string): string[] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*] |\d+\.\s/.test(line))
    .map((line) => line.replace(/^[-*]\s+|\d+\.\s+/, "").trim())
    .filter(Boolean);
}

function parseFieldMap(item: string): Record<string, string> {
  const normalized = item.replace(/\s+\|\s+/g, "; ");
  const segments = normalized.split(/;\s+/);
  const fields: Record<string, string> = {};

  for (const segment of segments) {
    const match = segment.match(/^([A-Za-z ]+):\s*(.+)$/);
    if (!match) {
      continue;
    }

    const key = match[1].toLowerCase().replace(/\s+/g, "");
    fields[key] = normalizeText(match[2]);
  }

  return fields;
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return normalizeText(value);
    }
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function hasContent(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}
