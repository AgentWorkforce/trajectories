import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("46-chapter-view")
  .description(
    "Create trail-viewer/Sources/Views/Detail/ChapterView.swift — chapter container with timeline, events, and collapsible sections",
  )
  .pattern("pipeline")
  .channel("wf-46-chapter-view")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI chapter view architect",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "Swift implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a SwiftUI file: ChapterView.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct ChapterView: View
- Properties:
  - chapter: Chapter model (assume it has: id, number (Int), title (String), agentName (String), events ([TrajectoryEvent]), startTime (Date?), endTime (Date?))
  - initiallyExpanded: Bool = true
- @State private var isExpanded: Bool (initialized from initiallyExpanded)
- Assume TrajectoryEvent has: id, type (EventType), content (String), timestamp (Date), agentName (String?), significance (EventSignificance), confidence (Double?), toolName (String?), toolResult (String?)
- Assume EventType enum has cases: note, finding, thinking, toolCall, reflection, error, messageSent, messageReceived, decision
- Layout (VStack, alignment: .leading, spacing: spacingMD ~12pt):
  1. Chapter header (tappable to toggle collapse):
     - "CHAPTER {number}" label in Typography.caption, Theme.textTertiary, uppercased, letter-spacing
     - chapter.title in Typography.sectionTitle (serif .design(.serif), ~18pt)
     - HStack: AgentAvatar(name: agentName) + agent name in Typography.caption
     - Time range: "startTime — endTime" or just startTime in Typography.caption, Theme.textTertiary
     - Chevron indicator (chevron.down when expanded, chevron.right when collapsed)
     - Event count summary: "{events.count} events" in Typography.caption when collapsed
  2. RuleLine divider
  3. Events section (shown when isExpanded):
     - Use TimelineRail with the chapter's events
     - For each event, wrap in EventCardBase and switch on event.type to render the correct view:
       - .note -> NoteEventView(event:)
       - .finding -> FindingEventView(event:)
       - .thinking -> ThinkingEventView(event:)
       - .toolCall -> ToolCallEventView(event:)
       - .reflection -> ReflectionEventView(event:)
       - .error -> ErrorEventView(event:)
       - .messageSent, .messageReceived -> MessageEventView(event:)
       - .decision -> DecisionCard (extract decision data from event)
       - default -> NoteEventView as fallback
     - Animate show/hide with .transition(.opacity) and .animation(.easeInOut(duration: 0.3), value: isExpanded)
  4. Toggle isExpanded on tap of the header area
- Padding: spacingLG vertical between chapters
- Assume all event views, TimelineRail, EventCardBase, AgentAvatar, Theme, Typography, RuleLine are available
- Add a PreviewProvider with a mock chapter containing 3-4 events of different types

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "ChapterView" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Detail/ChapterView.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Detail/ChapterView.swift.
Create the directory trail-viewer/Sources/Views/Detail/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Detail/ChapterView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Detail/ChapterView.swift && git commit -m "feat: add ChapterView — collapsible chapter with timeline and event type routing"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("46-chapter-view:", result.status);
