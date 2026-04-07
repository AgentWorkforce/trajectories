import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("10-section-elements")
  .description(
    "Create trail-viewer/Sources/Design/SectionElements.swift — SectionHeader, RuleLine, OrnamentDivider",
  )
  .pattern("pipeline")
  .channel("wf-10-section-elements")
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
    task: `Output the COMPLETE contents of a SectionElements.swift file for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — book-like section dividers and headings.

Requirements:

1. Import SwiftUI

2. SectionHeader: View
   - Properties: title: String, icon: String? = nil
   - Body:
     - VStack(alignment: .leading, spacing: Theme.spacingSM)
     - HStack with optional SF Symbol Image (systemName: icon, 14pt, Theme.blue) + title Text in .sectionTitle() modifier (18pt semibold serif)
     - Below: a RuleLine()
   - Padding: bottom Theme.spacingSM

3. RuleLine: View
   - A horizontal Rectangle, height 0.5, filled with Theme.borderLight
   - frame(maxWidth: .infinity)

4. OrnamentDivider: View
   - HStack with:
     - RuleLine (flexible)
     - Text with ornament character (use a small diamond or fleuron, like the string literal for a small ornamental mark, such as a centered dot or section mark)
     - RuleLine (flexible)
   - The center ornament: Text with a small decorative character in Theme.textTertiary, font .system(size: 10)
   - Padding: vertical Theme.spacingMD

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "SectionHeader" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Design/SectionElements.swift from this spec:

{{steps.plan.output}}

Extract the SectionElements.swift code and write it to trail-viewer/Sources/Design/SectionElements.swift.
Create the trail-viewer/Sources/Design directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/SectionElements.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/SectionElements.swift && git commit -m "feat: add SectionElements.swift — SectionHeader, RuleLine, OrnamentDivider"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("10-section-elements:", result.status);
