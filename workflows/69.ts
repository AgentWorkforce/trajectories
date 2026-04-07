import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("69-search-highlight")
  .description(
    "Create trail-viewer/Sources/Design/SearchHighlight.swift — ViewModifier to highlight matching text in yellow",
  )
  .pattern("pipeline")
  .channel("wf-69-search-highlight")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI text styling architect",
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
    task: `Output the COMPLETE contents of a SwiftUI file: SearchHighlight.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI

1. Define struct SearchHighlight: ViewModifier
   - Properties:
     - text: String (the full text content to display)
     - query: String (the search query to highlight)
   - func body(content: Content) -> some View:
     - If query is empty or not found in text: return content unchanged
     - Else: return Text with highlighted matches using AttributedString
   - Implementation approach:
     - Build an AttributedString from the text
     - Find all ranges of the query (case-insensitive) in the text
     - For each matching range, apply:
       - .backgroundColor = Theme.yellow (#f2d479) — golden yellow highlight
       - .foregroundColor = Theme.textPrimary (keep text readable)
     - Return Text(attributedString) instead of the original content
     - Use String.range(of:options:range:) in a loop to find all occurrences

2. Alternative simpler approach using Text concatenation:
   - Split the text by the query (case-insensitive)
   - Rebuild as: segment + highlighted(query) + segment + highlighted(query) + ...
   - Where highlighted = Text(match).background(Theme.yellow)
   - This avoids AttributedString complexity

3. Define a helper function for highlighted Text:
   - func highlightedText(_ text: String, query: String) -> Text
   - Returns a composed Text view with yellow background on matches
   - Case-insensitive matching

4. View extension for convenient usage:
   - extension View {
       func searchHighlight(text: String, query: String) -> some View {
         modifier(SearchHighlight(text: text, query: query))
       }
     }

5. Also provide a standalone helper view:
   - struct HighlightedText: View
     - Properties: text: String, query: String
     - body: builds the highlighted Text using the concatenation approach
     - If query is empty: plain Text(text)

- Assume Theme is available from Design/ folder (Theme.yellow = Color(hex: "#f2d479"))
- Add a PreviewProvider showing:
  - HighlightedText(text: "Hello world, this is a search test", query: "search")
  - HighlightedText with empty query
  - HighlightedText with multiple matches

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "SearchHighlight" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Design/SearchHighlight.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Design/SearchHighlight.swift.
Create the directory trail-viewer/Sources/Design/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Design/SearchHighlight.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Design/SearchHighlight.swift && git commit -m "feat: add SearchHighlight — ViewModifier and HighlightedText for yellow search match highlighting"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("69-search-highlight:", result.status);
