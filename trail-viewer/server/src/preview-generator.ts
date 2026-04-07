import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  Chapter,
  Decision,
  Retrospective,
  Trajectory,
  TrajectoryEvent,
} from "../../../src/core/types.js";

export async function generatePreview(
  trajectory: Trajectory,
  outputPath: string,
): Promise<void> {
  const html = renderHTML(trajectory);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf-8");
}

export async function generatePreviewsForAll(
  trajectoryDir: string,
): Promise<number> {
  const jsonPaths = await collectJsonFiles(trajectoryDir);
  let count = 0;

  for (const jsonPath of jsonPaths) {
    const htmlPath = jsonPath.replace(/\.json$/i, ".html");

    try {
      const [jsonStat, htmlStat] = await Promise.all([
        stat(jsonPath),
        stat(htmlPath),
      ]);

      if (htmlStat.mtimeMs >= jsonStat.mtimeMs) {
        continue;
      }
    } catch {
      // Missing HTML is expected on first generation.
    }

    try {
      const raw = await readFile(jsonPath, "utf-8");
      const trajectory = JSON.parse(raw) as Trajectory;
      await generatePreview(trajectory, htmlPath);
      count++;
    } catch {
      // Skip malformed or unreadable trajectory files.
    }
  }

  return count;
}

async function collectJsonFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso?: string): string {
  if (!iso) {
    return "Unknown date";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return esc(iso);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "#7eb8da";
    case "active":
      return "#8fae8b";
    case "abandoned":
      return "#c87f6b";
    default:
      return "#9b9590";
  }
}

function renderStatusBadge(status: string): string {
  const color = statusColor(status);
  return `<span class="status-badge" style="background:${color}15;color:${color};border:1px solid ${color}40">${esc(status)}</span>`;
}

function isDecision(value: unknown): value is Decision {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Decision>;
  return (
    typeof candidate.question === "string" &&
    typeof candidate.chosen === "string" &&
    typeof candidate.reasoning === "string"
  );
}

function chapterDecisions(chapter: Chapter): Decision[] {
  const decisions: Decision[] = [];

  for (const event of chapter.events) {
    if (event.type === "decision" && isDecision(event.raw)) {
      decisions.push(event.raw);
    }
  }

  return decisions;
}

function renderDecision(decision: Decision): string {
  return `
    <div class="decision-block">
      <div class="decision-question">${esc(decision.question)}</div>
      <div class="decision-chosen"><strong>Chosen:</strong> ${esc(decision.chosen)}</div>
      ${decision.reasoning ? `<div class="decision-reasoning">${esc(decision.reasoning)}</div>` : ""}
    </div>`;
}

function renderEventSummary(event: TrajectoryEvent): string {
  const label = event.type === "finding" ? "Finding" : "Decision";

  return `
    <div class="event-item ${esc(event.type)}">
      <span class="event-type">${label}</span>
      <span class="event-content">${esc(event.content)}</span>
    </div>`;
}

function renderChapter(chapter: Chapter, index: number): string {
  const keyEvents = chapter.events.filter(
    (event) =>
      event.type === "decision" ||
      event.type === "finding" ||
      event.significance === "high" ||
      event.significance === "critical",
  );

  const decisions = chapterDecisions(chapter);

  return `
    <section class="chapter">
      <h2>Chapter ${index + 1}: ${esc(chapter.title)}</h2>
      <div class="chapter-meta">
        <span>Agent: ${esc(chapter.agentName)}</span>
        <span>${formatDate(chapter.startedAt)}</span>
        ${chapter.endedAt ? `<span>→ ${formatDate(chapter.endedAt)}</span>` : ""}
      </div>
      ${
        keyEvents.length > 0
          ? `<div class="events-summary">${keyEvents.map(renderEventSummary).join("")}</div>`
          : `<p class="empty-copy">No major findings or decisions were recorded for this chapter.</p>`
      }
      ${
        decisions.length > 0
          ? `<div class="chapter-decisions">
              <div class="section-kicker">Decisions</div>
              ${decisions.map(renderDecision).join("")}
            </div>`
          : ""
      }
    </section>`;
}

function renderRetrospective(retrospective: Retrospective): string {
  const confidencePct = Math.max(
    0,
    Math.min(100, Math.round(retrospective.confidence * 100)),
  );

  return `
    <section class="retrospective">
      <div class="divider">✦</div>
      <h2>Retrospective</h2>
      <p class="retro-summary">${esc(retrospective.summary)}</p>

      <div class="confidence-row">
        <span class="confidence-label">Confidence</span>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width:${confidencePct}%"></div>
        </div>
        <span class="confidence-value">${confidencePct}%</span>
      </div>

      ${
        retrospective.learnings && retrospective.learnings.length > 0
          ? `<div class="retro-list">
              <h3>Learnings</h3>
              <ul>${retrospective.learnings.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
            </div>`
          : ""
      }

      ${
        retrospective.challenges && retrospective.challenges.length > 0
          ? `<div class="retro-list">
              <h3>Challenges</h3>
              <ul>${retrospective.challenges.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
            </div>`
          : ""
      }

      ${
        retrospective.decisions && retrospective.decisions.length > 0
          ? `<div class="retro-decisions">
              <h3>Key Decisions</h3>
              ${retrospective.decisions.map(renderDecision).join("")}
            </div>`
          : ""
      }
    </section>`;
}

function renderHTML(trajectory: Trajectory): string {
  const agentNames = trajectory.agents
    .map((agent: Trajectory["agents"][number]) => agent.name)
    .join(", ");
  const tags = trajectory.tags
    .map((tag: string) => `<span class="tag">${esc(tag)}</span>`)
    .join("");
  const description = trajectory.task.description
    ? `<p class="description">${esc(trajectory.task.description)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(trajectory.task.title)} — Trail Viewer</title>
<style>
  * { box-sizing: border-box; }

  :root {
    --paper: #faf8f5;
    --ink: #2c2825;
    --muted: #6b6560;
    --subtle: #9b9590;
    --rule: #e8e4dc;
    --accent: #7eb8da;
    --accent-soft: #e8f1f7;
    --highlight: #f2d479;
    --highlight-soft: #fdf5e0;
    --success: #8fae8b;
    --danger: #c87f6b;
  }

  html, body {
    margin: 0;
    min-height: 100%;
  }

  body {
    background:
      radial-gradient(circle at top left, rgba(126, 184, 218, 0.12), transparent 28%),
      radial-gradient(circle at top right, rgba(242, 212, 121, 0.16), transparent 24%),
      var(--paper);
    color: var(--ink);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    padding: 32px 16px;
  }

  .page {
    max-width: 680px;
    margin: 0 auto;
    padding: 48px 40px 64px;
    background: rgba(255, 255, 255, 0.52);
    border: 1px solid rgba(232, 228, 220, 0.9);
    border-radius: 24px;
    box-shadow: 0 24px 60px rgba(77, 66, 53, 0.08);
    backdrop-filter: blur(3px);
  }

  h1, h2, h3 {
    font-family: Georgia, "Times New Roman", serif;
    letter-spacing: -0.01em;
    margin: 0;
  }

  h1 {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.25;
    margin-bottom: 12px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .description {
    font-size: 14px;
    color: var(--muted);
    margin: 0 0 24px;
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 24px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-soft);
  }

  hr {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 24px 0 28px;
  }

  .chapter {
    margin-bottom: 36px;
  }

  .chapter h2,
  .retrospective h2 {
    font-size: 21px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .chapter-meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--subtle);
    margin-bottom: 14px;
  }

  .events-summary {
    margin-top: 8px;
    border-top: 1px solid rgba(232, 228, 220, 0.72);
  }

  .event-item {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(240, 236, 228, 0.95);
    font-size: 14px;
  }

  .event-type {
    min-width: 70px;
    flex-shrink: 0;
    color: var(--subtle);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .event-item.decision .event-type { color: var(--accent); }
  .event-item.finding .event-type { color: var(--success); }
  .event-content { color: var(--ink); }

  .section-kicker {
    color: var(--subtle);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 16px 0 8px;
  }

  .decision-block {
    border-left: 3px solid var(--highlight);
    background: var(--highlight-soft);
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin: 12px 0;
  }

  .decision-question {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .decision-chosen {
    font-size: 14px;
    margin-bottom: 4px;
  }

  .decision-reasoning {
    color: var(--muted);
    font-size: 13px;
    font-style: italic;
  }

  .empty-copy {
    color: var(--subtle);
    font-size: 13px;
    margin: 0;
  }

  .retrospective {
    margin-top: 44px;
  }

  .divider {
    text-align: center;
    color: #d4cfc7;
    font-size: 18px;
    letter-spacing: 8px;
    margin-bottom: 16px;
  }

  .retro-summary {
    font-size: 15px;
    line-height: 1.7;
    margin: 0 0 20px;
  }

  .retrospective h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 18px 0 8px;
  }

  .retro-list ul {
    margin: 0;
    padding-left: 20px;
  }

  .retro-list li {
    margin-bottom: 6px;
    font-size: 14px;
  }

  .confidence-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .confidence-label {
    min-width: 80px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .confidence-bar {
    height: 8px;
    flex: 1;
    overflow: hidden;
    background: var(--rule);
    border-radius: 999px;
  }

  .confidence-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--success));
    border-radius: 999px;
  }

  .confidence-value {
    min-width: 40px;
    color: var(--accent);
    font-size: 14px;
    font-weight: 700;
    text-align: right;
  }

  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid var(--rule);
    color: var(--subtle);
    font-size: 12px;
  }

  .footer-section {
    margin-bottom: 8px;
  }

  .footer-label {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .footer-list {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 11px;
    word-break: break-word;
  }

  @media (max-width: 720px) {
    body {
      padding: 12px;
    }

    .page {
      padding: 28px 20px 36px;
      border-radius: 18px;
    }

    .meta-row,
    .chapter-meta,
    .confidence-row {
      gap: 8px;
    }

    .event-item {
      display: block;
    }

    .event-type {
      display: block;
      margin-bottom: 4px;
    }
  }
</style>
</head>
<body>
  <main class="page">
    <h1>${esc(trajectory.task.title)}</h1>

    <div class="meta-row">
      ${renderStatusBadge(trajectory.status)}
      <span>${esc(agentNames || "—")}</span>
      <span>${formatDate(trajectory.startedAt)}</span>
      ${trajectory.completedAt ? `<span>→ ${formatDate(trajectory.completedAt)}</span>` : ""}
    </div>

    ${trajectory.tags.length > 0 ? `<div class="tags-row">${tags}</div>` : ""}
    ${description}

    <hr>

    ${trajectory.chapters.map((chapter: Chapter, index: number) => renderChapter(chapter, index)).join("")}
    ${trajectory.retrospective ? renderRetrospective(trajectory.retrospective) : ""}

    <footer class="footer">
      ${
        trajectory.filesChanged.length > 0
          ? `<div class="footer-section">
              <span class="footer-label">Files changed: </span>
              <span class="footer-list">${trajectory.filesChanged.map((file: string) => esc(file)).join(", ")}</span>
            </div>`
          : ""
      }
      ${
        trajectory.commits.length > 0
          ? `<div class="footer-section">
              <span class="footer-label">Commits: </span>
              <span class="footer-list">${trajectory.commits.map((commit: string) => esc(commit)).join(", ")}</span>
            </div>`
          : ""
      }
      <div class="footer-section" style="margin-top:16px;color:#d4cfc7">
        Generated by Trail Viewer · ${esc(trajectory.id)}
      </div>
    </footer>
  </main>
</body>
</html>`;
}
