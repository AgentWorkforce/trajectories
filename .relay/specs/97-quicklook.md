# 97 — Quick Look Trajectory Preview

Three files that enable beautiful trajectory previews both in Finder (via generated HTML) and in-app (via SwiftUI card).

---

## FILE 1: `trail-viewer/server/src/preview-generator.ts`

```typescript
import { readdir, readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import type {
  Trajectory,
  Chapter,
  TrajectoryEvent,
  Decision,
  Retrospective,
} from "../../../../src/core/types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a self-contained HTML preview for a single trajectory.
 * The output is a single file with inline CSS — no external dependencies.
 */
export async function generatePreview(
  trajectory: Trajectory,
  outputPath: string
): Promise<void> {
  const html = renderHTML(trajectory);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf-8");
}

/**
 * Walk a trajectory directory, generate HTML previews for every JSON file.
 * Skips generation when the HTML is already newer than the JSON source.
 * Returns the number of previews generated.
 */
export async function generatePreviewsForAll(
  trajectoryDir: string
): Promise<number> {
  let count = 0;

  // Walk YYYY-MM sub-directories
  const months = await readdir(trajectoryDir, { withFileTypes: true });
  for (const month of months) {
    if (!month.isDirectory()) continue;
    const monthDir = join(trajectoryDir, month.name);
    const files = await readdir(monthDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const jsonPath = join(monthDir, file);
      const htmlPath = join(monthDir, file.replace(/\.json$/, ".html"));

      // Skip if HTML exists and is newer than JSON
      try {
        const [jsonStat, htmlStat] = await Promise.all([
          stat(jsonPath),
          stat(htmlPath),
        ]);
        if (htmlStat.mtimeMs > jsonStat.mtimeMs) continue;
      } catch {
        // HTML doesn't exist yet — generate it
      }

      try {
        const raw = await readFile(jsonPath, "utf-8");
        const trajectory: Trajectory = JSON.parse(raw);
        await generatePreview(trajectory, htmlPath);
        count++;
      } catch {
        // Skip malformed files silently
      }
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// HTML Renderer
// ---------------------------------------------------------------------------

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
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

function renderDecision(d: Decision): string {
  return `
    <div class="decision-block">
      <div class="decision-question">${esc(d.question)}</div>
      <div class="decision-chosen"><strong>Chosen:</strong> ${esc(d.chosen)}</div>
      ${d.reasoning ? `<div class="decision-reasoning">${esc(d.reasoning)}</div>` : ""}
    </div>`;
}

function renderChapter(chapter: Chapter, index: number): string {
  // Filter to only decisions and findings
  const keyEvents = chapter.events.filter(
    (e: TrajectoryEvent) =>
      e.type === "decision" || e.type === "finding" || e.significance === "high"
  );

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
          ? `<div class="events-summary">
              ${keyEvents
                .map(
                  (e: TrajectoryEvent) =>
                    `<div class="event-item ${e.type}">
                      <span class="event-type">${esc(e.type)}</span>
                      <span class="event-content">${esc(e.content)}</span>
                    </div>`
                )
                .join("")}
            </div>`
          : ""
      }
    </section>`;
}

function renderRetrospective(retro: Retrospective): string {
  const confidencePct = Math.round(retro.confidence * 100);
  return `
    <div class="retrospective">
      <div class="divider">✦</div>
      <h2>Retrospective</h2>
      <p class="retro-summary">${esc(retro.summary)}</p>

      <div class="confidence-row">
        <span class="confidence-label">Confidence</span>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width:${confidencePct}%"></div>
        </div>
        <span class="confidence-value">${confidencePct}%</span>
      </div>

      ${
        retro.learnings && retro.learnings.length > 0
          ? `<div class="learnings">
              <h3>Learnings</h3>
              <ul>${retro.learnings.map((l: string) => `<li>${esc(l)}</li>`).join("")}</ul>
            </div>`
          : ""
      }

      ${
        retro.challenges && retro.challenges.length > 0
          ? `<div class="challenges">
              <h3>Challenges</h3>
              <ul>${retro.challenges.map((c: string) => `<li>${esc(c)}</li>`).join("")}</ul>
            </div>`
          : ""
      }

      ${
        retro.decisions && retro.decisions.length > 0
          ? `<div class="retro-decisions">
              <h3>Key Decisions</h3>
              ${retro.decisions.map(renderDecision).join("")}
            </div>`
          : ""
      }
    </div>`;
}

function renderHTML(trajectory: Trajectory): string {
  const agentNames = trajectory.agents.map((a) => a.name).join(", ");
  const tagList = trajectory.tags.length
    ? trajectory.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(trajectory.task.title)} — Trail Viewer</title>
<style>
  /* === The Beautiful Notebook === */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #faf8f5;
    color: #2c2825;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .page {
    max-width: 680px;
    margin: 0 auto;
    padding: 48px 40px 64px;
  }

  /* Header */
  h1 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 28px;
    font-weight: 700;
    color: #2c2825;
    line-height: 1.3;
    margin-bottom: 12px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
    color: #6b6560;
    margin-bottom: 8px;
  }

  .status-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 3px 10px;
    border-radius: 999px;
  }

  .tags-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 24px;
  }

  .tag {
    font-size: 11px;
    color: #7eb8da;
    background: #e8f1f7;
    padding: 2px 8px;
    border-radius: 999px;
  }

  hr {
    border: none;
    border-top: 1px solid #e8e4dc;
    margin: 24px 0;
  }

  /* Chapters */
  .chapter { margin-bottom: 32px; }

  .chapter h2 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    font-weight: 600;
    color: #2c2825;
    margin-bottom: 8px;
  }

  .chapter-meta {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #9b9590;
    margin-bottom: 12px;
  }

  .events-summary { margin-top: 8px; }

  .event-item {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 0;
    font-size: 14px;
    border-bottom: 1px solid #f0ece4;
  }

  .event-type {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #9b9590;
    min-width: 64px;
    flex-shrink: 0;
  }

  .event-item.decision .event-type { color: #7eb8da; }
  .event-item.finding .event-type  { color: #8fae8b; }

  .event-content { color: #2c2825; }

  /* Decision blocks */
  .decision-block {
    border-left: 3px solid #f2d479;
    padding: 12px 16px;
    margin: 12px 0;
    background: #fdf5e0;
    border-radius: 0 6px 6px 0;
  }

  .decision-question {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 6px;
  }

  .decision-chosen {
    font-size: 14px;
    margin-bottom: 4px;
  }

  .decision-reasoning {
    font-size: 13px;
    color: #6b6560;
    font-style: italic;
  }

  /* Retrospective */
  .retrospective { margin-top: 40px; }

  .divider {
    text-align: center;
    font-size: 18px;
    color: #d4cfc7;
    margin-bottom: 16px;
    letter-spacing: 8px;
  }

  .retrospective h2 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .retro-summary {
    font-size: 15px;
    line-height: 1.7;
    margin-bottom: 20px;
  }

  .retrospective h3 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 16px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: #2c2825;
  }

  .retrospective ul {
    padding-left: 20px;
    font-size: 14px;
    color: #2c2825;
  }

  .retrospective li {
    margin-bottom: 6px;
    line-height: 1.5;
  }

  /* Confidence bar */
  .confidence-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .confidence-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b6560;
    min-width: 80px;
  }

  .confidence-bar {
    flex: 1;
    height: 8px;
    background: #e8e4dc;
    border-radius: 4px;
    overflow: hidden;
  }

  .confidence-fill {
    height: 100%;
    background: linear-gradient(90deg, #7eb8da, #8fae8b);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .confidence-value {
    font-size: 14px;
    font-weight: 600;
    color: #7eb8da;
    min-width: 36px;
    text-align: right;
  }

  /* Footer */
  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e8e4dc;
    font-size: 12px;
    color: #9b9590;
  }

  .footer-section { margin-bottom: 8px; }

  .footer-label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .footer-list {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 11px;
    word-break: break-all;
  }
</style>
</head>
<body>
<div class="page">
  <h1>${esc(trajectory.task.title)}</h1>

  <div class="meta-row">
    ${renderStatusBadge(trajectory.status)}
    <span>${esc(agentNames || "—")}</span>
    <span>${formatDate(trajectory.startedAt)}</span>
    ${trajectory.completedAt ? `<span>→ ${formatDate(trajectory.completedAt)}</span>` : ""}
  </div>

  ${tagList ? `<div class="tags-row">${tagList}</div>` : ""}

  ${trajectory.task.description ? `<p style="font-size:14px;color:#6b6560;margin-bottom:24px">${esc(trajectory.task.description)}</p>` : ""}

  <hr>

  ${trajectory.chapters.map((ch, i) => renderChapter(ch, i)).join("")}

  ${trajectory.retrospective ? renderRetrospective(trajectory.retrospective) : ""}

  <div class="footer">
    ${
      trajectory.commits.length > 0
        ? `<div class="footer-section">
            <span class="footer-label">Commits: </span>
            <span class="footer-list">${trajectory.commits.map(esc).join(", ")}</span>
          </div>`
        : ""
    }
    ${
      trajectory.filesChanged.length > 0
        ? `<div class="footer-section">
            <span class="footer-label">Files changed: </span>
            <span class="footer-list">${trajectory.filesChanged.map(esc).join(", ")}</span>
          </div>`
        : ""
    }
    <div class="footer-section" style="margin-top:16px;color:#d4cfc7">
      Generated by Trail Viewer · ${esc(trajectory.id)}
    </div>
  </div>
</div>
</body>
</html>`;
}
```

---

## FILE 2: `trail-viewer/Sources/QuickLook/QuickLookGenerator.swift`

```swift
import Foundation

/// Coordinates with the Trail Viewer server to generate and locate
/// HTML preview files for Finder Quick Look.
///
/// Usage:
///   let count = try await QuickLookGenerator.generatePreviews(
///       for: "~/.trajectories/completed"
///   )
///
/// Server endpoint to add to routes (trail-viewer/server/src/server.ts):
///
///   // POST /api/previews/generate
///   // Body: { "path": "/absolute/path/to/.trajectories/completed" }
///   // Returns: { "count": <number of previews generated> }
///   //
///   // import { generatePreviewsForAll } from "./preview-generator.js";
///   //
///   // app.post("/api/previews/generate", async (c) => {
///   //     const { path } = await c.req.json<{ path: string }>();
///   //     const count = await generatePreviewsForAll(path);
///   //     return c.json({ count });
///   // });
///
class QuickLookGenerator {

    // MARK: - Types

    private struct GenerateRequest: Encodable {
        let path: String
    }

    private struct GenerateResponse: Decodable {
        let count: Int
    }

    // MARK: - Configuration

    private static var serverBaseURL: URL {
        AppConfiguration.serverBaseURL
    }

    // MARK: - Generate Previews

    /// Ask the server to generate HTML preview files for all trajectories
    /// in the given directory.
    ///
    /// - Parameter trajectoryPath: Absolute path to the trajectories directory
    ///   (e.g. `/Users/me/.trajectories/completed`).
    /// - Returns: The number of preview files generated.
    static func generatePreviews(for trajectoryPath: String) async throws -> Int {
        let url = serverBaseURL.appendingPathComponent("/api/previews/generate")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(GenerateRequest(path: trajectoryPath))

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw APIError.serverError(status, "Preview generation failed")
        }

        let decoded = try JSONDecoder().decode(GenerateResponse.self, from: data)
        return decoded.count
    }

    // MARK: - Locate Preview

    /// Returns the URL to the HTML preview file for a trajectory, if it exists.
    ///
    /// The HTML file lives alongside the JSON file in the same directory:
    /// `.trajectories/completed/YYYY-MM/traj_xxx.html`
    ///
    /// - Parameters:
    ///   - trajectoryId: The trajectory ID (e.g. `traj_gtzye0t83h5a`).
    ///   - directory: The completed-trajectories root directory.
    /// - Returns: A file URL to the HTML preview, or `nil` if not found.
    static func previewURL(for trajectoryId: String, in directory: String) -> URL? {
        let fileManager = FileManager.default
        let baseURL = URL(fileURLWithPath: directory)

        // Scan YYYY-MM subdirectories for the matching HTML file
        guard let months = try? fileManager.contentsOfDirectory(
            at: baseURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return nil
        }

        for monthDir in months {
            let htmlFile = monthDir.appendingPathComponent("\(trajectoryId).html")
            if fileManager.fileExists(atPath: htmlFile.path) {
                return htmlFile
            }
        }

        return nil
    }
}
```

---

## FILE 3: `trail-viewer/Sources/Views/TrajectoryPreviewCard.swift`

```swift
import SwiftUI

/// Compact trajectory preview card for use in command palette results,
/// hover tooltips, and drag-and-drop previews.
///
/// Maximum size: 280×180pt. Uses BookCard styling with the
/// "Beautiful Notebook" aesthetic.
struct TrajectoryPreviewCard: View {
    let summary: TrajectorySummary

    var body: some View {
        BookCard {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                // Title — 2 lines max
                Text(summary.title)
                    .modifier(Typography.heading())
                    .lineLimit(2)
                    .truncationMode(.tail)

                // Status + counts row
                HStack(spacing: Theme.spacingSM) {
                    StatusBadge(status: summary.status.rawValue)

                    Label("\(summary.agents.count)", systemImage: "person.2")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.textSecondary)

                    Label("\(summary.chapterCount)", systemImage: "book")
                        .font(.system(size: 11))
                        .foregroundColor(Theme.textSecondary)

                    Spacer()
                }

                // Tags — max 3, then "+N more"
                if let tags = summary.tags, !tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(tags.prefix(3), id: \.self) { tag in
                            TagPill(tag: tag)
                        }
                        if tags.count > 3 {
                            Text("+\(tags.count - 3) more")
                                .font(.system(size: 10))
                                .foregroundColor(Theme.textTertiary)
                        }
                    }
                }

                Spacer(minLength: 0)

                // Relative timestamp
                Text(summary.updatedAt, style: .relative)
                    .modifier(Typography.caption())
                    .foregroundColor(Theme.textTertiary)
            }
        }
        .frame(maxWidth: 280, maxHeight: 180)
        .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
    }
}

#if DEBUG
struct TrajectoryPreviewCard_Previews: PreviewProvider {
    static var previews: some View {
        TrajectoryPreviewCard(
            summary: TrajectorySummary(
                id: "traj_preview123",
                title: "Implement Quick Look preview for trajectories",
                status: .completed,
                chapterCount: 3,
                eventCount: 12,
                agents: ["Claude", "Worker-1"],
                tags: ["feature", "ui", "macos", "preview"],
                createdAt: Date().addingTimeInterval(-3600),
                updatedAt: Date()
            )
        )
        .padding(20)
        .background(Theme.pageBg)
    }
}
#endif
```

---

## Integration Notes

### Server route to add (`trail-viewer/server/src/server.ts`):

```typescript
import { generatePreviewsForAll } from "./preview-generator.js";

// Add alongside existing routes:
app.post("/api/previews/generate", async (c) => {
  const { path } = await c.req.json<{ path: string }>();
  const count = await generatePreviewsForAll(path);
  return c.json({ count });
});
```

### Design decisions:

1. **Single HTML file** — no external CSS/JS/fonts. Finder Quick Look renders it directly. The design mirrors the app's warm notebook aesthetic with matching hex colors from `Theme.swift`.

2. **Noise filtering** — Chapter event rendering skips low-significance tool calls and only surfaces decisions, findings, and high-significance events. This keeps Quick Look previews scannable.

3. **Incremental generation** — `generatePreviewsForAll` checks mtime to skip already-current previews, making it safe to call repeatedly.

4. **SwiftUI card reuse** — `TrajectoryPreviewCard` composes existing `BookCard`, `StatusBadge`, `TagPill`, and `Typography` components. No new design primitives needed.

5. **Preview location convention** — HTML files sit alongside their JSON source: `.trajectories/completed/2026-02/traj_xxx.html`. This makes Finder navigation intuitive — selecting either file in the same folder works.
