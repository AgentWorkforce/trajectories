import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("06-animations")
  .description(
    "Create trail-viewer/Sources/Design/Animations.swift — shared animation constants and transitions",
  )
  .pattern("pipeline")
  .channel("wf-06-animations")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI animation architect",
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
    task: `Output the COMPLETE contents of an Animations.swift file for the Trail Viewer macOS app.

Requirements:

1. Import SwiftUI

2. Define enum Animations (no cases — pure namespace) with static animation constants:

   - easeIn: Animation = .easeIn(duration: 0.15)
   - easeOut: Animation = .easeOut(duration: 0.2)
   - spring: Animation = .spring(response: 0.3, dampingFraction: 0.8)
   - collapse: Animation = .easeInOut(duration: 0.25)
   - shimmer: Animation = .linear(duration: 1.5).repeatForever(autoreverses: false)
   - gentleBounce: Animation = .spring(response: 0.4, dampingFraction: 0.7)
   - quickFade: Animation = .easeOut(duration: 0.12)

3. Static transition helpers:
   - slideIn: AnyTransition = .move(edge: .trailing).combined(with: .opacity)
   - slideOut: AnyTransition = .move(edge: .leading).combined(with: .opacity)
   - fadeScale: AnyTransition = .opacity.combined(with: .scale(scale: 0.95))
   - cardAppear: AnyTransition = .opacity.combined(with: .offset(y: 8))

4. A ViewModifier struct ShimmerEffect that creates a gradient sweep animation:
   - Uses a @State var isAnimating = false
   - Overlay with a LinearGradient (clear -> white at 0.3 opacity -> clear)
   - Offset animates from left to right using Animations.shimmer
   - Clips to the view shape
   - Starts animating in onAppear

5. View extension: .shimmer() that applies the ShimmerEffect modifier

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "Animations" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Design/Animations.swift from this spec:

{{steps.plan.output}}

Extract the Animations.swift code and write it to trail-viewer/Sources/Design/Animations.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/Animations.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/Animations.swift && git commit -m "feat: add Animations.swift — shared animation constants and shimmer effect"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("06-animations:", result.status);
