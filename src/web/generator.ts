/**
 * Static HTML generator for trajectory viewing
 */

import type {
  Chapter,
  Decision,
  Trajectory,
  TrajectoryEvent,
} from "../core/types.js";
import { styles } from "./styles.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startDate: string, endDate?: string): string {
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  const ms = end - start;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function getStatusClass(status: string): string {
  switch (status) {
    case "active":
      return "status-active";
    case "completed":
      return "status-completed";
    case "abandoned":
      return "status-abandoned";
    default:
      return "";
  }
}

function renderDecision(decision: Decision): string {
  const alternatives = decision.alternatives?.length
    ? `<div class="alternatives">
        <span class="alternatives-label">Considered:</span>
        ${decision.alternatives.map((a) => escapeHtml(typeof a === "string" ? a : a.option)).join(", ")}
       </div>`
    : "";

  return `
    <div class="decision">
      <div class="decision-title">${escapeHtml(decision.question)}: ${escapeHtml(decision.chosen)}</div>
      <div class="decision-reasoning">${escapeHtml(decision.reasoning)}</div>
      ${alternatives}
    </div>
  `;
}

function renderEvent(event: TrajectoryEvent): string {
  const time = formatDate(new Date(event.ts).toISOString());
  let content = "";
  let typeClass = "";
  const rawData = event.raw as Record<string, unknown> | undefined;

  switch (event.type) {
    case "decision":
      typeClass = "decision";
      content = `
        <strong>Decision:</strong> ${escapeHtml(event.content)}
        ${rawData?.reasoning ? `<div class="decision-reasoning">${escapeHtml(String(rawData.reasoning))}</div>` : ""}
      `;
      break;
    case "thinking":
      content = `<strong>Thinking:</strong> ${escapeHtml(event.content)}`;
      break;
    case "prompt":
      content = `<strong>Prompt:</strong> ${escapeHtml(event.content)}`;
      break;
    case "tool_call":
      content = `<strong>Tool:</strong> <code>${escapeHtml(event.content)}</code>`;
      break;
    case "tool_result":
      content = `<strong>Result:</strong> ${escapeHtml(event.content)}`;
      break;
    case "message_sent":
      content = `<strong>Sent:</strong> ${escapeHtml(event.content)}`;
      break;
    case "message_received":
      content = `<strong>Received:</strong> ${escapeHtml(event.content)}`;
      break;
    case "error":
      content = `<strong style="color: var(--error)">Error:</strong> ${escapeHtml(event.content)}`;
      break;
    case "note":
      content = escapeHtml(event.content);
      break;
    default:
      content = escapeHtml(event.content);
  }

  return `
    <div class="timeline-item ${typeClass}">
      <div class="timeline-time">${time}</div>
      <div class="timeline-content">${content}</div>
    </div>
  `;
}

function renderChapter(chapter: Chapter, index: number): string {
  const events = chapter.events.map(renderEvent).join("");

  return `
    <div class="chapter">
      <div class="chapter-title">
        Chapter ${index + 1}: ${escapeHtml(chapter.title)}
      </div>
      <div class="chapter-agent">Agent: ${escapeHtml(chapter.agentName)}</div>
      ${
        chapter.events.length > 0
          ? `
        <h3 class="collapsible" onclick="this.classList.toggle('open')">Events (${chapter.events.length})</h3>
        <div class="collapsible-content">
          <div class="timeline">${events}</div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function renderRetrospective(trajectory: Trajectory): string {
  if (!trajectory.retrospective) {
    return "";
  }

  const retro = trajectory.retrospective;
  const confidencePercent = Math.round(retro.confidence * 100);

  const approach = retro.approach
    ? `<div><strong>Approach:</strong><p>${escapeHtml(retro.approach)}</p></div>`
    : "";

  const learnings = retro.learnings?.length
    ? `<div><strong>Learnings:</strong><ul class="list">${retro.learnings.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul></div>`
    : "";

  const challenges = retro.challenges?.length
    ? `<div><strong>Challenges:</strong><ul class="list">${retro.challenges.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul></div>`
    : "";

  const suggestions = retro.suggestions?.length
    ? `<div><strong>Suggestions:</strong><ul class="list">${retro.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>`
    : "";

  return `
    <div class="retrospective">
      <h3>📝 Retrospective</h3>
      <p>${escapeHtml(retro.summary)}</p>

      <div class="confidence">
        <span>Confidence:</span>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
        </div>
        <span>${confidencePercent}%</span>
      </div>

      ${approach}
      ${learnings}
      ${challenges}
      ${suggestions}
    </div>
  `;
}

export function generateTrajectoryHtml(trajectory: Trajectory): string {
  const statusClass = getStatusClass(trajectory.status);
  const duration = formatDuration(trajectory.startedAt, trajectory.completedAt);

  // Extract all decisions from chapters
  const decisions: Decision[] = trajectory.chapters.flatMap((ch) =>
    ch.events
      .filter((e) => e.type === "decision" && e.raw)
      .map((e) => e.raw as Decision)
      .filter(
        (d): d is Decision => d !== undefined && typeof d.question === "string",
      ),
  );

  const decisionsHtml = decisions.length
    ? `
      <h2 class="collapsible open" onclick="this.classList.toggle('open')">
        Key Decisions (${decisions.length})
      </h2>
      <div class="collapsible-content">
        ${decisions.map(renderDecision).join("")}
      </div>
    `
    : "";

  const chaptersHtml = trajectory.chapters.length
    ? `
      <h2 class="collapsible open" onclick="this.classList.toggle('open')">
        Chapters (${trajectory.chapters.length})
      </h2>
      <div class="collapsible-content">
        ${trajectory.chapters.map(renderChapter).join("")}
      </div>
    `
    : "";

  const filesHtml = trajectory.filesChanged.length
    ? `
      <h2>Files Changed (${trajectory.filesChanged.length})</h2>
      <div class="files-changed">
        ${trajectory.filesChanged.map((f) => escapeHtml(f)).join("<br>")}
      </div>
    `
    : "";

  const commitsHtml = trajectory.commits.length
    ? `
      <h2>Commits (${trajectory.commits.length})</h2>
      <div class="files-changed">
        ${trajectory.commits.map((c) => `<code>${escapeHtml(c)}</code>`).join("<br>")}
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(trajectory.task.title)} - Trajectory</title>
  <style>${styles}</style>
</head>
<body>
  <div class="header">
    <h1>🛤️ ${escapeHtml(trajectory.task.title)}</h1>
    <div class="meta">
      <div class="meta-item">
        <span class="meta-label">ID</span>
        <span class="meta-value"><code>${trajectory.id}</code></span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Status</span>
        <span class="meta-value"><span class="status ${statusClass}">${trajectory.status}</span></span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Duration</span>
        <span class="meta-value">${duration}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Started</span>
        <span class="meta-value">${formatDate(trajectory.startedAt)}</span>
      </div>
      ${
        trajectory.task.source
          ? `
      <div class="meta-item">
        <span class="meta-label">Source</span>
        <span class="meta-value">${escapeHtml(trajectory.task.source.system)}:${escapeHtml(trajectory.task.source.id)}</span>
      </div>
      `
          : ""
      }
      <div class="meta-item">
        <span class="meta-label">Agents</span>
        <span class="meta-value">${trajectory.agents.map((a) => escapeHtml(a.name)).join(", ") || "—"}</span>
      </div>
    </div>
  </div>

  ${renderRetrospective(trajectory)}
  ${decisionsHtml}
  ${chaptersHtml}
  ${filesHtml}
  ${commitsHtml}

  <script>
    // Initialize all collapsible sections
    document.querySelectorAll('.collapsible.open').forEach(el => {
      el.nextElementSibling?.style && (el.nextElementSibling.style.display = 'block');
    });
  </script>
</body>
</html>`;
}

export function generateIndexHtml(trajectories: Trajectory[]): string {
  // Group by status
  const active = trajectories.filter((t) => t.status === "active");
  const completed = trajectories.filter((t) => t.status === "completed");
  const abandoned = trajectories.filter((t) => t.status === "abandoned");

  function renderCard(t: Trajectory): string {
    const duration = formatDuration(t.startedAt, t.completedAt);
    const statusClass = getStatusClass(t.status);

    return `
      <a href="${t.id}.html" class="trajectory-card">
        <div class="trajectory-card-title">${escapeHtml(t.task.title)}</div>
        <div class="trajectory-card-meta">
          <span class="status ${statusClass}">${t.status}</span>
          <span>${duration}</span>
          <span>${t.chapters.length} chapters</span>
        </div>
      </a>
    `;
  }

  function renderGroup(title: string, items: Trajectory[]): string {
    if (items.length === 0) return "";
    return `
      <div class="group-header">${title} (${items.length})</div>
      <div class="trajectory-list">
        ${items.map(renderCard).join("")}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trajectories</title>
  <style>${styles}</style>
</head>
<body>
  <div class="header">
    <h1>🛤️ Trajectories</h1>
    <p>${trajectories.length} total trajectories</p>
  </div>

  ${renderGroup("Active", active)}
  ${renderGroup("Completed", completed)}
  ${renderGroup("Abandoned", abandoned)}

  ${trajectories.length === 0 ? '<p class="empty">No trajectories yet. Start one with <code>trail start "Task name"</code></p>' : ""}
</body>
</html>`;
}
