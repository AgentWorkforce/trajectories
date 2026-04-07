import { workflow } from "@agent-relay/sdk/workflows";

/**
 * Quick Look Preview — Press Space on a trajectory JSON in Finder to see
 * a beautifully formatted preview without opening the full app.
 *
 * Pattern: pipeline (Claude designs the preview → Codex implements)
 *
 * Since SPM doesn't support Quick Look extensions natively, we take a
 * dual approach:
 *   1. A Quick Look-style preview WITHIN the app (for the file detail modal)
 *   2. A standalone HTML generator that creates .html previews alongside
 *      trajectory JSON files — Finder's built-in Quick Look can render these
 *
 * Creates:
 *   trail-viewer/Sources/Services/QuickLookGenerator.swift
 *   trail-viewer/Sources/Views/TrajectoryPreviewCard.swift
 *   trail-viewer/server/src/preview-generator.ts
 */

const result = await workflow("97-quicklook-preview")
  .description(
    "Add Quick Look preview — formatted trajectory preview from Finder and in-app",
  )
  .pattern("dag")
  .channel("wf-97-quicklook")
  .maxConcurrency(3)
  .timeout(1_800_000)

  .agent("planner", {
    cli: "claude",
    role: "macOS Quick Look integration architect",
    preset: "lead",
    retries: 2,
  })
  .agent("impl-swift", {
    cli: "codex",
    role: "Swift implementer",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-ts", {
    cli: "codex",
    role: "TypeScript implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Design Quick Look trajectory preview for Trail Viewer. Output COMPLETE code for 3 files.

Trajectories are JSON files at .trajectories/completed/YYYY-MM/traj_xxx.json.
We want pressing Space on one in Finder to show a beautiful formatted preview.

Since we can't easily create a Quick Look extension with SPM, we use two approaches:

APPROACH 1: HTML preview files (for Finder Quick Look)
The server generates a .html file alongside each trajectory JSON. Finder's
built-in Quick Look renders HTML beautifully. The HTML should match the
app's "Beautiful Notebook" aesthetic.

APPROACH 2: In-app preview card (for the app itself)
A compact, card-style preview of a trajectory for use in hover tooltips,
command palette results, and drag-and-drop previews.

FILE 1: preview-generator.ts (server-side, TypeScript)
  Generates beautiful HTML preview files for trajectories.

  export async function generatePreview(trajectory: Trajectory, outputPath: string): Promise<void>

  The HTML should be a SINGLE self-contained file (inline CSS, no external deps):

  Design (matching "The Beautiful Notebook" — light, warm, book-like):
  - Background: #faf8f5 (warm off-white)
  - Font: Georgia/serif for headings, system-ui for body
  - Max width: 680px, centered, generous padding (40px sides)
  - Colors: #7eb8da (pastel blue) for accents, #f2d479 (golden yellow) for highlights

  Content:
  - Title in large serif (28px bold Georgia)
  - Status badge (colored pill: green/blue/red)
  - Metadata line: agents, dates, tags
  - Thin rule line
  - Chapters as sections:
    - "Chapter N: Title" in serif heading
    - Key events summary (decisions and findings only, skip noise)
    - Decision blocks with yellow left border, question + chosen answer
  - Retrospective section:
    - Decorative "✦" divider
    - Summary, confidence bar (CSS), learnings as bullet list
  - Footer: file paths, commits

  Also export:
  export async function generatePreviewsForAll(trajectoryDir: string): Promise<number>
    - Walk directory, generate HTML for each trajectory
    - Return count generated
    - Skip if HTML already exists and is newer than JSON

  The HTML should look professional enough to screenshot and share.

FILE 2: QuickLookGenerator.swift (macOS app)
  Calls the server endpoint to generate HTML previews.

  class QuickLookGenerator:
    static func generatePreviews(for trajectoryPath: String) async throws -> Int
      - POST /api/previews/generate { path: trajectoryPath }
      - Returns count of previews generated

    static func previewURL(for trajectoryId: String, in directory: String) -> URL?
      - Returns URL to the .html file if it exists
      - Path: .trajectories/completed/YYYY-MM/traj_xxx.html (same dir as JSON)

  Also add a server endpoint in a comment showing what to add to server routes:
    POST /api/previews/generate — calls generatePreviewsForAll()

FILE 3: TrajectoryPreviewCard.swift (SwiftUI, in-app preview)
  Compact card for in-app trajectory previews (used in command palette, tooltips).

  TrajectoryPreviewCard(summary: TrajectorySummary): View
  - Compact layout (280x180pt max):
    - Title in Typography.heading (2 lines max, truncated)
    - StatusBadge + agent count + chapter count row
    - Tags (max 3, then "+N more")
    - If has retrospective: 2-line summary preview in caption italic
    - Confidence percentage in small blue text
    - Relative timestamp at bottom
  - BookCard styling with subtle shadow
  - Use for: .popover(), CommandPalette result hover, drag preview

Output ALL 3 complete files with clear markers.

IMPORTANT: Write your complete output to the file .relay/specs/97-quicklook.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/97-quicklook.md",
    },
  })

  // Swift files (parallel)
  .step("impl-quicklook-gen", {
    agent: "impl-swift",
    dependsOn: ["plan"],
    task: `Create 2 Swift files from this spec:

{{steps.read-spec.output}}

1. trail-viewer/Sources/Services/QuickLookGenerator.swift
2. trail-viewer/Sources/Views/TrajectoryPreviewCard.swift

Write BOTH files to disk. Do NOT output to stdout.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/QuickLookGenerator.swift",
    },
  })

  // TypeScript file
  .step("impl-preview-gen", {
    agent: "impl-ts",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/preview-generator.ts from this spec:

{{steps.read-spec.output}}

Extract the preview-generator.ts code and write it to disk.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/preview-generator.ts",
    },
  })

  .step("verify", {
    type: "deterministic",
    dependsOn: ["impl-quicklook-gen", "impl-preview-gen"],
    command: `test -f trail-viewer/Sources/Services/QuickLookGenerator.swift && test -f trail-viewer/Sources/Views/TrajectoryPreviewCard.swift && test -f trail-viewer/server/src/preview-generator.ts && echo "All Quick Look files present"`,
    failOnError: true,
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["verify"],
    command:
      'cd trail-viewer && git add Sources/Services/QuickLookGenerator.swift Sources/Views/TrajectoryPreviewCard.swift server/src/preview-generator.ts && git commit -m "feat: add Quick Look preview — HTML previews for Finder + in-app preview card"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("97-quicklook-preview:", result.status);
