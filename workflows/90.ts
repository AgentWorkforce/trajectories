import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("90-focus-management")
  .description(
    "Create trail-viewer/Sources/Services/FocusManagement.swift — FocusState enum and Tab key cycling modifier",
  )
  .pattern("pipeline")
  .channel("wf-90-focus-management")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI accessibility and focus management designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: FocusManagement.swift for the Trail Viewer macOS app.

Requirements:
- Import SwiftUI

- Define enum AppFocusRegion: Hashable, CaseIterable
  - case sidebar
  - case detail
  - case chat
  - case commandPalette

- Define a ViewModifier: FocusCycleModifier
  - @FocusState private var focusedRegion: AppFocusRegion?
  - body function:
    - Apply .focusable() to content
    - Handle Tab key press using .onKeyPress(.tab):
      - Cycle to next region in order: sidebar -> detail -> chat -> commandPalette -> sidebar
      - If no current focus, start with sidebar
      - If Shift+Tab (check modifiers), cycle backward
      - Return .handled
    - Apply focus ring style when region is focused:
      - .overlay of RoundedRectangle with Theme.blue at 0.3 opacity, lineWidth 2
      - Only show when the view's region matches focusedRegion

- Extension on View:
  - func focusCycleEnabled() -> some View
    - Returns self.modifier(FocusCycleModifier())

- Define a ViewModifier: FocusRingModifier
  - Property: isActive: Bool
  - Property: color: Color (default Theme.blue or Color.blue)
  - body function:
    - If isActive, overlay a RoundedRectangle(cornerRadius: 6) stroke
      with color.opacity(0.3), lineWidth: 2
    - Animate changes with .animation(.easeInOut(duration: 0.15), value: isActive)

- Extension on View:
  - func focusRing(isActive: Bool, color: Color = .blue) -> some View
    - Returns self.modifier(FocusRingModifier(isActive: isActive, color: color))

- Add a PreviewProvider demonstrating focus regions with colored boxes

Output the COMPLETE Swift file ready to write to disk.

IMPORTANT: Write your complete output to the file .relay/specs/90-focus-management.md on disk. This ensures clean handoff to the implementer.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/90-focus-management.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan"],
    command: "cat .relay/specs/90-focus-management.md",
    captureOutput: true,
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["read-spec"],
    task: `Create trail-viewer/Sources/Services/FocusManagement.swift from this spec:

{{steps.read-spec.output}}

Extract the Swift code and write it to trail-viewer/Sources/Services/FocusManagement.swift.
Create the directory trail-viewer/Sources/Services/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/FocusManagement.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Services/FocusManagement.swift && git commit -m "feat: add FocusManagement — Tab key cycling between app regions with focus rings"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("90-focus-management:", result.status);
