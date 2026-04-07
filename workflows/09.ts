import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("09-badges")
  .description(
    "Create trail-viewer/Sources/Design/Badges.swift — StatusBadge, TagPill, SignificanceDot, AgentAvatar",
  )
  .pattern("pipeline")
  .channel("wf-09-badges")
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
    task: `Output the COMPLETE contents of a Badges.swift file for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — subtle, warm, book-like aesthetic.

Requirements:

1. Import SwiftUI

2. StatusBadge: View
   - Property: status: String
   - Renders a capsule-shaped badge with:
     - Small colored circle (6pt) on the left (statusColor computed property)
     - Status text in CaptionStyle (11pt medium)
     - Horizontal padding 8, vertical padding 4
     - Background: status color at 0.1 opacity in a Capsule
   - statusColor computed: "active" -> Theme.statusActive, "completed" -> Theme.statusCompleted, "abandoned" -> Theme.statusAbandoned, default -> Theme.textTertiary

3. TagPill: View
   - Property: tag: String
   - Renders text in small font (11pt) with:
     - Theme.blue foreground
     - Theme.blueMuted background
     - Horizontal padding 8, vertical padding 3
     - Capsule clip shape

4. SignificanceDot: View
   - Property: level: String
   - Renders an 8pt circle filled with significance color
   - Computed: "high" -> Theme.significanceHigh, "medium" -> Theme.significanceMedium, "low" -> Theme.significanceLow, default -> Theme.borderLight

5. AgentAvatar: View
   - Properties: name: String, size: CGFloat = 28
   - Renders a circle with:
     - Background: Theme.agentColor(for: name)
     - White initial letter (first character of name, uppercased) in bold, size = size * 0.45
     - Frame: size x size
     - Clip to Circle shape

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "StatusBadge" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Design/Badges.swift from this spec:

{{steps.plan.output}}

Extract the Badges.swift code and write it to trail-viewer/Sources/Design/Badges.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/Badges.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/Badges.swift && git commit -m "feat: add Badges.swift — StatusBadge, TagPill, SignificanceDot, AgentAvatar"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("09-badges:", result.status);
