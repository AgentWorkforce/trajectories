import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("04-theme-colors")
  .description(
    "Create trail-viewer/Sources/Design/Theme.swift — full color palette and spacing tokens",
  )
  .pattern("pipeline")
  .channel("wf-04-theme-colors")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI design system architect",
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
    task: `Output the COMPLETE contents of a Theme.swift file for the Trail Viewer macOS app design system.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:

1. Import SwiftUI

2. Add a Color(hex:) extension at the top:
   - extension Color with init(hex: String) initializer
   - Parses 6-character hex string into RGB components
   - Falls back to clear if parsing fails

3. Define enum Theme (no cases — pure namespace) with static Color properties:

   Page & Surface:
   - pageBg = #faf8f5 (warm paper)
   - sidebarBg = #f0ece4 (slightly darker paper)
   - cardBg = #ffffff (white cards)
   - cardHover = #f8f6f2 (subtle hover)
   - border = #d4cfc7 (warm gray border)
   - borderLight = #e8e4dc (lighter border)

   Text:
   - textPrimary = #2c2825 (near-black warm)
   - textSecondary = #6b6560 (medium warm gray)
   - textTertiary = #9b9590 (light warm gray)

   Blue (interactive/structural):
   - blue = #7eb8da (pastel blue)
   - blueLight = #b8d9ec (lighter blue)
   - blueMuted = #e8f1f7 (very light blue bg)

   Yellow (highlights):
   - yellow = #f2d479 (golden yellow)
   - yellowLight = #f7e6a8 (lighter yellow)
   - yellowMuted = #fdf5e0 (very light yellow bg)

   Status colors:
   - statusActive = #8fae8b (sage green)
   - statusCompleted = #7eb8da (same blue)
   - statusAbandoned = #c87f6b (terracotta)

   Significance levels:
   - significanceHigh = #e8845a (warm orange)
   - significanceMedium = #f2d479 (yellow)
   - significanceLow = #b8d9ec (light blue)

   Error/Success:
   - error = #c87f6b (terracotta red)
   - errorBg = #fdf0ec
   - success = #8fae8b (sage green)
   - successBg = #f0f5ef

4. Static dictionary agentColors: [String: Color] mapping agent names to pastel colors:
   - "agent1": #7eb8da, "agent2": #8fae8b, "agent3": #c9a0dc,
   - "agent4": #f2d479, "agent5": #e8845a, "agent6": #82c4c3

5. Static func agentColor(for name: String) -> Color that returns a consistent color based on the name's hash, using the agentColors values array.

6. Spacing scale (static lets of type CGFloat):
   - spacingXS = 4, spacingSM = 8, spacingBase = 12, spacingMD = 16,
   - spacingLG = 24, spacingXL = 36, spacingXXL = 56

7. Corner radii:
   - radiusSM: CGFloat = 3, radiusMD: CGFloat = 6, radiusLG: CGFloat = 10

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "pageBg" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Design/Theme.swift from this spec:

{{steps.plan.output}}

Extract the Theme.swift code and write it to trail-viewer/Sources/Design/Theme.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/Theme.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/Theme.swift && git commit -m "feat: add Theme.swift — full color palette, spacing, and radii tokens"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("04-theme-colors:", result.status);
