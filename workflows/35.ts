import { workflow } from "@agent-relay/sdk/workflows";

/**
 * Wave 9 — ALL 8 event type views in a single fan-out workflow.
 *
 * Pattern: FAN-OUT — One Claude designer plans all 8 event views at once,
 * then 4 Codex workers implement 2 files each in parallel.
 *
 * This replaces 8 separate pipeline workflows (old 35-42) because:
 * - Tasks are embarrassingly parallel (no inter-view dependencies)
 * - One planning step ensures consistent design language across all event types
 * - 4 workers × 2 files = 8 files, same result, half the planning time
 *
 * Creates (8 files):
 *   Events/EventCardBase.swift
 *   Events/NoteEventView.swift
 *   Events/FindingEventView.swift
 *   Events/ThinkingEventView.swift
 *   Events/ToolCallEventView.swift
 *   Events/ReflectionEventView.swift
 *   Events/ErrorEventView.swift
 *   Events/MessageEventView.swift
 *
 * Channel: wf-35-event-views (shared — all agents see each other's progress)
 */

const DESIGN_BRIEF = `
DESIGN: "The Beautiful Notebook" — LIGHT MODE, book aesthetic.
Warm paper backgrounds. Each event type gets a distinct visual treatment,
like different paragraph styles in a well-typeset book:
- Notes: simple body text with book icon
- Findings: indented blockquote with blue left border
- Thinking: collapsed/italic, like editorial margin notes
- Tool calls: monospace code boxes
- Decisions: pull-quote style (separate DecisionCard component)
- Reflections: highlighted annotation with yellow wash
- Errors: red-tinted alert box
- Messages: chat bubbles with agent avatars

All use Theme colors, Typography fonts, and Design components (SignificanceDot,
AgentAvatar, BookCard). All wrap in EventCardBase for consistent layout.
`;

const result = await workflow("35-event-views-fanout")
  .description(
    "Fan-out: design all 8 event type views together, implement in parallel",
  )
  .pattern("fan-out")
  .channel("wf-35-event-views")
  .maxConcurrency(5)
  .timeout(2_400_000)

  // ── Agents ────────────────────────────────────────────────────────
  .agent("designer", {
    cli: "claude",
    role: "Event view system designer — designs all 8 views for visual consistency",
    preset: "lead",
    retries: 2,
  })
  .agent("impl-1", {
    cli: "codex",
    role: "SwiftUI implementer (EventCardBase + NoteEventView)",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-2", {
    cli: "codex",
    role: "SwiftUI implementer (FindingEventView + ThinkingEventView)",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-3", {
    cli: "codex",
    role: "SwiftUI implementer (ToolCallEventView + ReflectionEventView)",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-4", {
    cli: "codex",
    role: "SwiftUI implementer (ErrorEventView + MessageEventView)",
    preset: "worker",
    retries: 2,
  })

  // ── Single planning step designs ALL 8 views ──────────────────────
  .step("design-all", {
    agent: "designer",
    task: `Design ALL 8 event type views for Trail Viewer. Output COMPLETE Swift code for all 8 files.

${DESIGN_BRIEF}

FILE 1: EventCardBase.swift — Generic wrapper for all event types.
  EventCardBase<Content: View>: View. Takes event: TrajectoryEvent + @ViewBuilder content.
  Layout: SignificanceDot on left, content center, timestamp right.
  Optional agent badge (if agentName differs from chapter agent).
  Optional confidence percentage. spacingMD vertical spacing.

FILE 2: NoteEventView.swift — NoteEventView(event: TrajectoryEvent).
  book.fill icon (16pt, textTertiary) + content in body text. Minimal.

FILE 3: FindingEventView.swift — FindingEventView(event: TrajectoryEvent).
  3pt left border in Theme.blue. Slightly indented. Content in body.

FILE 4: ThinkingEventView.swift — ThinkingEventView(event: TrajectoryEvent).
  Collapsed by default: "Thinking..." in italic textTertiary.
  @State isExpanded. Tap to expand full content. Animate with easeInOut 0.2s.

FILE 5: ToolCallEventView.swift — ToolCallEventView(event: TrajectoryEvent).
  terminal.fill icon + tool name in code font. Content in monospace on sidebarBg box.
  Collapsible for long output.

FILE 6: ReflectionEventView.swift — ReflectionEventView(event: TrajectoryEvent).
  yellowMuted background wash. Content slightly italic. Like a marginal annotation.

FILE 7: ErrorEventView.swift — ErrorEventView(event: TrajectoryEvent).
  sigCritical at 0.1 opacity background. exclamationmark.triangle icon. Red left border (3pt).

FILE 8: MessageEventView.swift — MessageEventView(event: TrajectoryEvent).
  message_sent: right-aligned, blueMuted bg, "You" label.
  message_received: left-aligned, cardBg, AgentAvatar + name.

CONSISTENCY RULES (apply to ALL views):
- All wrap their content for use inside EventCardBase
- All use Theme colors and Typography fonts
- All import from the Design/ folder
- Assume TrajectoryEvent has: id, type, content, timestamp, agentName?, significance, confidence?
- Each file is self-contained with its own struct + PreviewProvider

Output ALL 8 complete Swift files with clear FILE markers.

IMPORTANT: Write your complete output to the file .relay/specs/35-event-views.md on disk. This ensures clean handoff to the implementers.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/35-event-views.md",
    },
  })

  // ── Read spec cleanly from file (no PTY garble) ───────────────────
  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["design-all"],
    command: "cat .relay/specs/35-event-views.md",
    captureOutput: true,
  })

  // ── 4 workers fan out in parallel, each implements 2 files ────────

  .step("impl-base-note", {
    agent: "impl-1",
    dependsOn: ["read-spec"],
    task: `Create 2 files from this spec:

{{steps.read-spec.output}}

1. trail-viewer/Sources/Views/Detail/Events/EventCardBase.swift
2. trail-viewer/Sources/Views/Detail/Events/NoteEventView.swift

Create the Events/ directory if needed. Extract the code for each file and write to disk.
IMPORTANT: Write BOTH files to disk. Do NOT output to stdout.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/Events/EventCardBase.swift",
    },
  })

  .step("impl-finding-thinking", {
    agent: "impl-2",
    dependsOn: ["read-spec"],
    task: `Create 2 files from this spec:

{{steps.read-spec.output}}

1. trail-viewer/Sources/Views/Detail/Events/FindingEventView.swift
2. trail-viewer/Sources/Views/Detail/Events/ThinkingEventView.swift

Create the Events/ directory if needed. Extract the code for each file and write to disk.
IMPORTANT: Write BOTH files to disk. Do NOT output to stdout.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/Events/FindingEventView.swift",
    },
  })

  .step("impl-tool-reflection", {
    agent: "impl-3",
    dependsOn: ["read-spec"],
    task: `Create 2 files from this spec:

{{steps.read-spec.output}}

1. trail-viewer/Sources/Views/Detail/Events/ToolCallEventView.swift
2. trail-viewer/Sources/Views/Detail/Events/ReflectionEventView.swift

Create the Events/ directory if needed. Extract the code for each file and write to disk.
IMPORTANT: Write BOTH files to disk. Do NOT output to stdout.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/Events/ToolCallEventView.swift",
    },
  })

  .step("impl-error-message", {
    agent: "impl-4",
    dependsOn: ["read-spec"],
    task: `Create 2 files from this spec:

{{steps.read-spec.output}}

1. trail-viewer/Sources/Views/Detail/Events/ErrorEventView.swift
2. trail-viewer/Sources/Views/Detail/Events/MessageEventView.swift

Create the Events/ directory if needed. Extract the code for each file and write to disk.
IMPORTANT: Write BOTH files to disk. Do NOT output to stdout.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/Events/ErrorEventView.swift",
    },
  })

  // ── Verify all 8 files ────────────────────────────────────────────
  .step("verify-all", {
    type: "deterministic",
    dependsOn: [
      "impl-base-note",
      "impl-finding-thinking",
      "impl-tool-reflection",
      "impl-error-message",
    ],
    command: `cd trail-viewer && for f in Sources/Views/Detail/Events/EventCardBase.swift Sources/Views/Detail/Events/NoteEventView.swift Sources/Views/Detail/Events/FindingEventView.swift Sources/Views/Detail/Events/ThinkingEventView.swift Sources/Views/Detail/Events/ToolCallEventView.swift Sources/Views/Detail/Events/ReflectionEventView.swift Sources/Views/Detail/Events/ErrorEventView.swift Sources/Views/Detail/Events/MessageEventView.swift; do
      if [ ! -f "$f" ]; then echo "MISSING: $f"; exit 1; fi
    done && echo "All 8 event view files present"`,
    failOnError: true,
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["verify-all"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/Events/ && git commit -m "feat: add all 8 event type views (fan-out pattern)"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("35-event-views-fanout:", result.status);
