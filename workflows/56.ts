import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("56-chat-empty-states")
  .description(
    "Create trail-viewer/Sources/Views/Chat/ChatEmptyStates.swift — empty state views for chat panel",
  )
  .pattern("pipeline")
  .channel("wf-56-chat-empty-states")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI empty state designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: ChatEmptyStates.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define THREE separate view structs in this one file:

1. NoTrajectorySelectedState: View
   - Uses the reusable EmptyState component (from Design/ folder)
   - EmptyState(
       icon: "bubble.left.and.text.bubble.right",
       title: "No Trajectory Selected",
       subtitle: "Select a trajectory from the sidebar to start a discussion"
     )
   - Centered in available space
   - Theme.pageBg background

2. NoSessionStartedState: View
   - Property: personaCount: Int (number of available personas)
   - Property: onStartSession: () -> Void
   - A BookCard container (from Design/ folder):
     - VStack(alignment: .center, spacing: Theme.spacingMD):
       - Image(systemName: "text.bubble.fill") in 32pt, Theme.blue
       - Text("Ask agents about this trajectory") in Typography.heading (serif)
       - Text("\\(personaCount) AI personas available to discuss") in Typography.caption, Theme.textTertiary
       - Button(action: onStartSession):
         - Text("Start Discussion")
         - .font(Typography.body.bold())
         - .foregroundColor(.white)
         - .padding(.horizontal, Theme.spacingLG)
         - .padding(.vertical, Theme.spacingSM)
         - .background(Theme.blue)
         - .clipShape(RoundedRectangle(cornerRadius: 8))
       - .buttonStyle(.plain)
     - .padding(Theme.spacingLG)
   - Centered in available space

3. NoMessagesHint: View
   - Simple centered hint:
     - VStack(spacing: Theme.spacingSM):
       - Image(systemName: "arrow.down.circle") in 20pt, Theme.textTertiary
       - Text("Start the conversation below") in Typography.caption, Theme.textTertiary
     - .frame(maxWidth: .infinity, maxHeight: .infinity)
     - Subtle opacity: 0.7

- Assume Theme, Typography, EmptyState, BookCard are available
- Add a PreviewProvider showing all three states

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/56-chat-empty-states.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/56-chat-empty-states.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/56-chat-empty-states.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Views/Chat/ChatEmptyStates.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Chat/ChatEmptyStates.swift.
Create the directory trail-viewer/Sources/Views/Chat/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Chat/ChatEmptyStates.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Chat/ChatEmptyStates.swift && git commit -m "feat: add ChatEmptyStates — three empty state views for chat panel"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("56-chat-empty-states:", result.status);
