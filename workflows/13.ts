import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("13-toast-view")
  .description(
    "Create trail-viewer/Sources/Design/ToastView.swift — toast notifications with auto-dismiss",
  )
  .pattern("pipeline")
  .channel("wf-13-toast-view")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI component architect",
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
    task: `Output the COMPLETE contents of a ToastView.swift file for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — subtle, warm notifications.

Requirements:

1. Import SwiftUI

2. ToastStyle enum: info, success, error
   - Computed properties:
     - color: info -> Theme.blue, success -> Theme.success, error -> Theme.error
     - backgroundColor: info -> Theme.blueMuted, success -> Theme.successBg, error -> Theme.errorBg
     - icon: info -> "info.circle.fill", success -> "checkmark.circle.fill", error -> "exclamationmark.triangle.fill"

3. ToastItem: Identifiable
   - id: UUID = UUID()
   - message: String
   - style: ToastStyle

4. ToastView: View
   - Properties: message: String, style: ToastStyle
   - Body: small rounded card (HStack):
     - SF Symbol Image(systemName: style.icon) in style.color, 14pt
     - Text(message) in .bodySmall() style, Theme.textPrimary
     - Spacing: Theme.spacingSM
   - Padding: horizontal Theme.spacingBase, vertical Theme.spacingSM
   - Background: style.backgroundColor
   - Border: style.color.opacity(0.3), 0.5pt, rounded with Theme.radiusMD
   - Shadow: .black.opacity(0.08), radius 8, y 4
   - Transition: Animations.fadeScale

5. ToastContainer: View (overlay for managing toast stack)
   - @State private var toasts: [ToastItem] = []
   - Body: VStack(spacing: Theme.spacingSM) listing toasts with ForEach, id-based animation
   - Positioned at top-trailing via frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
   - Padding: Theme.spacingMD
   - Each toast auto-dismisses after 3.5 seconds using Task { try await Task.sleep(for: .seconds(3.5)); remove toast with animation }
   - Public method: show(message: String, style: ToastStyle) that appends to toasts array with Animations.spring animation
   - The toasts array is managed via a static shared instance or an @Observable class ToastManager

6. ToastManager: Observable class
   - @Published var toasts: [ToastItem] = []
   - func show(message: String, style: ToastStyle = .info)
   - func dismiss(_ id: UUID)
   - Auto-dismiss timer per toast (3.5s)

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "ToastView" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Design/ToastView.swift from this spec:

{{steps.plan.output}}

Extract the ToastView.swift code and write it to trail-viewer/Sources/Design/ToastView.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/ToastView.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/ToastView.swift && git commit -m "feat: add ToastView.swift — toast notifications with auto-dismiss"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("13-toast-view:", result.status);
