# RetrospectiveView.swift — Complete Implementation Spec

## File Path
`TrailViewer/Views/Detail/RetrospectiveView.swift`

## Complete Swift File

```swift
import SwiftUI

// MARK: - RetrospectiveView

struct RetrospectiveView: View {
    let retrospective: Retrospective

    var body: some View {
        VStack(alignment: .leading, spacing: Typography.spacingLG) {

            // 1. Ornament divider
            OrnamentDivider(symbol: "\u{2726}")

            // 2. Chapter title — centered
            Text("Retrospective")
                .font(Typography.chapterTitle)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .foregroundColor(Theme.textPrimary)

            // 3. Summary paragraph
            Text(retrospective.summary)
                .font(Typography.body)
                .foregroundColor(Theme.textPrimary)

            // 4. Approach section (optional)
            if let approach = retrospective.approach {
                Text("Approach")
                    .font(Typography.sectionTitle)
                    .foregroundColor(Theme.textPrimary)

                Text(approach)
                    .font(Typography.body)
                    .foregroundColor(Theme.textPrimary)
            }

            // 5. Confidence meter
            ConfidenceMeter(value: retrospective.confidence, label: "Overall Confidence")

            // 6. Challenges section (if non-empty)
            if !retrospective.challenges.isEmpty {
                Text("Challenges")
                    .font(Typography.sectionTitle)
                    .foregroundColor(Theme.textPrimary)

                ForEach(retrospective.challenges, id: \.self) { challenge in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 8, height: 8)
                            .padding(.top, 6)

                        Text(challenge)
                            .font(Typography.body)
                            .foregroundColor(Theme.textPrimary)
                    }
                }
            }

            // 7. Learnings section (if non-empty)
            if !retrospective.learnings.isEmpty {
                Text("Learnings")
                    .font(Typography.sectionTitle)
                    .foregroundColor(Theme.textPrimary)

                ForEach(retrospective.learnings, id: \.self) { learning in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "lightbulb.fill")
                            .foregroundColor(Theme.blue)
                            .font(.system(size: 14))
                            .padding(.top, 3)

                        Circle()
                            .fill(Theme.blue)
                            .frame(width: 8, height: 8)
                            .padding(.top, 6)

                        Text(learning)
                            .font(Typography.body)
                            .foregroundColor(Theme.textPrimary)
                    }
                }
            }

            // 8. Suggestions section (if non-empty)
            if !retrospective.suggestions.isEmpty {
                Text("Suggestions")
                    .font(Typography.sectionTitle)
                    .foregroundColor(Theme.textPrimary)

                ForEach(Array(retrospective.suggestions.enumerated()), id: \.offset) { index, suggestion in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(index + 1)")
                            .font(Typography.caption.italic())
                            .foregroundColor(Theme.textSecondary)
                            .frame(width: 20, alignment: .trailing)
                            .padding(.top, 2)

                        Text(suggestion)
                            .font(Typography.body.italic())
                            .foregroundColor(Theme.textPrimary)
                    }
                }
            }

            // 9. Time spent (optional)
            if let timeSpent = retrospective.timeSpent {
                Text(formattedDuration(timeSpent))
                    .font(Typography.caption)
                    .foregroundColor(Theme.textTertiary)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, Typography.spacingMD)
            }
        }
        .padding(Typography.spacingXXL)
        .background(Theme.yellowMuted)
        .cornerRadius(8)
    }

    // MARK: - Helpers

    private func formattedDuration(_ interval: TimeInterval) -> String {
        let totalMinutes = Int(interval) / 60
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60

        if hours > 0 && minutes > 0 {
            return "Completed in \(hours)h \(minutes)m"
        } else if hours > 0 {
            return "Completed in \(hours)h"
        } else {
            return "Completed in \(minutes)m"
        }
    }
}

// MARK: - Preview

struct RetrospectiveView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            RetrospectiveView(
                retrospective: Retrospective(
                    summary: "The agent successfully completed the multi-file refactoring task, restructuring the authentication module from a monolithic service into three focused components. All 47 tests pass, and the public API surface remains unchanged.",
                    approach: "Adopted an incremental extraction strategy: first identified seams in the existing AuthService, then extracted TokenManager and SessionStore as standalone types, wiring them back through dependency injection. Each extraction was validated against the existing test suite before proceeding to the next.",
                    confidence: 0.87,
                    challenges: [
                        "Circular dependency between AuthService and SessionStore required introducing a protocol to break the cycle.",
                        "Legacy callback-based token refresh did not compose well with the new async/await surface.",
                        "Three tests relied on internal implementation details and had to be rewritten against the public API."
                    ],
                    learnings: [
                        "Protocol-based boundaries make incremental extraction significantly safer — each step stays compilable.",
                        "Async wrapper adapters for legacy callbacks should live in an extension, not inline, to keep the main type clean.",
                        "Test coupling to internals is a reliable signal that the module boundary is in the wrong place."
                    ],
                    suggestions: [
                        "Consider adding integration tests that exercise the full auth flow end-to-end, not just unit-level checks.",
                        "The TokenManager refresh interval is currently hardcoded — extract it to configuration for easier tuning.",
                        "SessionStore could benefit from an in-memory cache to reduce redundant keychain reads on rapid re-auth."
                    ],
                    timeSpent: 9240 // 2h 34m
                )
            )
            .padding(24)
        }
        .frame(width: 700, height: 900)
        .background(Theme.backgroundPrimary)
    }
}
```

## Design Notes

- **Light mode / book-like**: Yellow muted wash gives a warm parchment feel, consistent with "The Beautiful Notebook" direction.
- **Typography hierarchy**: chapterTitle for the heading, sectionTitle for subsection labels, body for content, caption for metadata.
- **Bullet styling**: Orange circles for challenges (warning tone), blue lightbulb + circle for learnings (insight tone), numbered italic for suggestions (forward-looking tone).
- **Spacing**: spacingLG (~20pt) between sections, spacingXXL (~32pt) padding inside the card.
- **ConfidenceMeter**: Used directly as specified. If unavailable, an inline fallback can be swapped in:
  ```swift
  // Inline fallback if ConfidenceMeter not yet available:
  VStack(alignment: .leading, spacing: 4) {
      Text("Overall Confidence")
          .font(Typography.caption)
          .foregroundColor(Theme.textSecondary)
      GeometryReader { geo in
          ZStack(alignment: .leading) {
              RoundedRectangle(cornerRadius: 4)
                  .fill(Theme.borderLight)
                  .frame(height: 8)
              RoundedRectangle(cornerRadius: 4)
                  .fill(Theme.blue)
                  .frame(width: geo.size.width * retrospective.confidence, height: 8)
          }
      }
      .frame(height: 8)
  }
  ```
