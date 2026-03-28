import type {
  Chapter,
  Decision,
  EventSignificance,
  Finding,
  Retrospective,
  Trajectory,
  TrajectoryEvent,
} from "../core/types.js";

const DEFAULT_MAX_TOKENS = 30000;
const CHARS_PER_TOKEN = 4;
const INCLUDED_SIGNIFICANCE = new Set<EventSignificance>([
  "medium",
  "high",
  "critical",
]);

interface SessionRender {
  header: string;
  agents: string;
  chapters: string[];
  decisions: string;
  findings: string;
  retrospective: string;
  filesAndCommits: string;
}

export function serializeForLLM(
  trajectories: Trajectory[],
  maxTokens = DEFAULT_MAX_TOKENS,
): string {
  const maxChars = Math.max(0, maxTokens * CHARS_PER_TOKEN);
  const sessions = trajectories.map(renderSession);

  let document = joinSessions(sessions);
  if (document.length <= maxChars || sessions.length === 0) {
    return document;
  }

  const fixedChars = sessions.reduce(
    (total, session) =>
      total +
      session.header.length +
      session.agents.length +
      session.decisions.length +
      session.findings.length +
      session.retrospective.length +
      session.filesAndCommits.length,
    0,
  );
  const chapterChars = sessions.reduce(
    (total, session) =>
      total +
      session.chapters.reduce((sum, chapter) => sum + chapter.length, 0),
    0,
  );

  const remainingChapterChars = maxChars - fixedChars;
  if (remainingChapterChars <= 0 || chapterChars === 0) {
    return truncateText(document, maxChars);
  }

  const ratio = Math.min(1, remainingChapterChars / chapterChars);
  const truncatedSessions = sessions.map((session) => ({
    ...session,
    chapters: truncateChapters(
      session.chapters,
      session.chapters.reduce((sum, chapter) => sum + chapter.length, 0),
      ratio,
    ),
  }));

  document = joinSessions(truncatedSessions);
  return document.length <= maxChars
    ? document
    : truncateText(document, maxChars);
}

function renderSession(trajectory: Trajectory): SessionRender {
  const sessionTitle = trajectory.task.title.trim() || trajectory.id;
  const duration = formatDuration(trajectory.startedAt, trajectory.completedAt);
  const header = [
    `## Session: ${sessionTitle} (${trajectory.status}, ${duration})`,
    trajectory.task.description
      ? `Description: ${trajectory.task.description}`
      : "",
    `Started: ${trajectory.startedAt}`,
    trajectory.completedAt ? `Completed: ${trajectory.completedAt}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .concat("\n");

  const agents =
    trajectory.agents.length > 0
      ? `Agents: ${trajectory.agents
          .map((agent) => `${agent.name} (${agent.role})`)
          .join(", ")}\n`
      : "Agents: none recorded\n";

  const chapters = trajectory.chapters.map(renderChapter);
  const decisions = renderDecisions(trajectory);
  const findings = renderFindings(trajectory);
  const retrospective = renderRetrospective(trajectory.retrospective);
  const filesAndCommits = [
    `Files changed: ${formatList(trajectory.filesChanged)}`,
    `Commits: ${formatList(trajectory.commits)}`,
  ]
    .join("\n")
    .concat("\n");

  return {
    header,
    agents,
    chapters,
    decisions,
    findings,
    retrospective,
    filesAndCommits,
  };
}

function renderChapter(chapter: Chapter): string {
  const lines = chapter.events
    .filter(shouldIncludeEvent)
    .map((event) => formatEvent(event));

  const chapterBody =
    lines.length > 0
      ? lines.map((line) => `- ${line}`).join("\n")
      : "- No medium/high/critical events captured";

  return [
    `### Chapter: ${chapter.title}`,
    `Agent: ${chapter.agentName}`,
    `Window: ${chapter.startedAt} -> ${chapter.endedAt ?? "ongoing"}`,
    chapterBody,
  ]
    .join("\n")
    .concat("\n");
}

function renderDecisions(trajectory: Trajectory): string {
  const seen = new Set<string>();
  const decisions: Decision[] = [];

  for (const chapter of trajectory.chapters) {
    for (const event of chapter.events) {
      if (event.type !== "decision") {
        continue;
      }

      const decision = asDecision(event.raw);
      if (!decision) {
        continue;
      }

      const key = `${decision.question}\n${decision.chosen}\n${decision.reasoning}`;
      if (!seen.has(key)) {
        seen.add(key);
        decisions.push(decision);
      }
    }
  }

  for (const decision of trajectory.retrospective?.decisions ?? []) {
    const key = `${decision.question}\n${decision.chosen}\n${decision.reasoning}`;
    if (!seen.has(key)) {
      seen.add(key);
      decisions.push(decision);
    }
  }

  if (decisions.length === 0) {
    return "Decisions:\n- None recorded\n";
  }

  return [
    "Decisions:",
    ...decisions.map((decision) =>
      [
        `- Question: ${decision.question}`,
        `  Chosen: ${decision.chosen}`,
        `  Reasoning: ${decision.reasoning}`,
      ].join("\n"),
    ),
  ]
    .join("\n")
    .concat("\n");
}

function renderFindings(trajectory: Trajectory): string {
  const findings = trajectory.chapters.flatMap((chapter) =>
    chapter.events
      .filter((event) => event.type === "finding")
      .map((event) => asFinding(event.raw, event.content)),
  );

  if (findings.length === 0) {
    return "Findings:\n- None recorded\n";
  }

  return [
    "Findings:",
    ...findings.map((finding) =>
      [
        `- What: ${finding.what}`,
        `  Where: ${finding.where}`,
        `  Significance: ${finding.significance}`,
      ].join("\n"),
    ),
  ]
    .join("\n")
    .concat("\n");
}

function renderRetrospective(retrospective?: Retrospective): string {
  if (!retrospective) {
    return "Retrospective:\n- None recorded\n";
  }

  const lines = [
    "Retrospective:",
    `- Summary: ${retrospective.summary}`,
    `  Approach: ${retrospective.approach}`,
  ];

  if (retrospective.challenges && retrospective.challenges.length > 0) {
    lines.push(`  Challenges: ${retrospective.challenges.join("; ")}`);
  }

  if (retrospective.learnings && retrospective.learnings.length > 0) {
    lines.push(`  Learnings: ${retrospective.learnings.join("; ")}`);
  }

  if (retrospective.suggestions && retrospective.suggestions.length > 0) {
    lines.push(`  Suggestions: ${retrospective.suggestions.join("; ")}`);
  }

  if (retrospective.timeSpent) {
    lines.push(`  Time spent: ${retrospective.timeSpent}`);
  }

  return lines.join("\n").concat("\n");
}

function shouldIncludeEvent(event: TrajectoryEvent): boolean {
  if (event.type === "tool_call" || event.type === "tool_result") {
    return false;
  }

  return INCLUDED_SIGNIFICANCE.has(resolveSignificance(event));
}

function resolveSignificance(event: TrajectoryEvent): EventSignificance {
  if (event.significance) {
    return event.significance;
  }

  switch (event.type) {
    case "decision":
    case "finding":
    case "error":
      return "high";
    case "reflection":
    case "note":
    case "message_sent":
    case "message_received":
      return "medium";
    default:
      return "low";
  }
}

function formatEvent(event: TrajectoryEvent): string {
  if (event.type === "decision") {
    const decision = asDecision(event.raw);
    if (decision) {
      return `[decision/${resolveSignificance(event)}] ${decision.question} -> ${decision.chosen}`;
    }
  }

  if (event.type === "finding") {
    const finding = asFinding(event.raw, event.content);
    return `[finding/${resolveSignificance(event)}] ${finding.what} @ ${finding.where}`;
  }

  return `[${event.type}/${resolveSignificance(event)}] ${event.content}`;
}

function asDecision(raw: unknown): Decision | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<Decision>;
  if (
    typeof candidate.question !== "string" ||
    typeof candidate.chosen !== "string" ||
    typeof candidate.reasoning !== "string"
  ) {
    return null;
  }

  return {
    question: candidate.question,
    chosen: candidate.chosen,
    reasoning: candidate.reasoning,
    alternatives: Array.isArray(candidate.alternatives)
      ? candidate.alternatives
      : [],
    confidence: candidate.confidence,
  };
}

function asFinding(raw: unknown, fallbackContent: string): Finding {
  if (!raw || typeof raw !== "object") {
    return {
      what: fallbackContent,
      where: "unknown",
      significance: "Not structured",
      category: "other",
    };
  }

  const candidate = raw as Partial<Finding>;
  return {
    what:
      typeof candidate.what === "string" && candidate.what.trim().length > 0
        ? candidate.what
        : fallbackContent,
    where:
      typeof candidate.where === "string" && candidate.where.trim().length > 0
        ? candidate.where
        : "unknown",
    significance:
      typeof candidate.significance === "string" &&
      candidate.significance.trim().length > 0
        ? candidate.significance
        : "Not structured",
    category: candidate.category ?? "other",
    suggestedAction:
      typeof candidate.suggestedAction === "string"
        ? candidate.suggestedAction
        : undefined,
    confidence: candidate.confidence,
  };
}

function truncateChapters(
  chapters: string[],
  totalChapterChars: number,
  ratio: number,
): string[] {
  if (ratio >= 1 || totalChapterChars === 0) {
    return chapters;
  }

  let remaining = Math.floor(totalChapterChars * ratio);

  return chapters.map((chapter, index) => {
    if (remaining <= 0) {
      return "### Chapter: Truncated\n- Omitted due to token budget\n";
    }

    const proportionalTarget =
      index === chapters.length - 1
        ? remaining
        : Math.floor(chapter.length * ratio);
    const allowance = Math.max(0, Math.min(chapter.length, proportionalTarget));
    remaining -= allowance;

    return truncateText(chapter, allowance);
  });
}

function joinSessions(sessions: SessionRender[]): string {
  return sessions
    .map((session) =>
      [
        session.header,
        session.agents,
        ...session.chapters,
        session.decisions,
        session.findings,
        session.retrospective,
        session.filesAndCommits,
      ]
        .filter(Boolean)
        .join("\n")
        .trim(),
    )
    .join("\n\n");
}

function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0) {
    return "";
  }

  if (text.length <= maxChars) {
    return text;
  }

  if (maxChars <= 16) {
    return text.slice(0, maxChars);
  }

  return `${text.slice(0, maxChars - 16).trimEnd()}\n[truncated]\n`;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt ?? startedAt).getTime();
  const elapsedMs = Math.max(0, end - start);
  const minutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return completedAt ? "0m" : "ongoing";
}
