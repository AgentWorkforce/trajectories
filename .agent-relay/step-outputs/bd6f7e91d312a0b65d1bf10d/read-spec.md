# SearchHighlight.swift — Complete Implementation Spec

## File: TrailViewer/Components/SearchHighlight.swift

```swift
import SwiftUI

// MARK: - HighlightedText View

/// A standalone view that renders text with search query matches highlighted
/// in a warm golden yellow, consistent with "The Beautiful Notebook" light-mode design.
struct HighlightedText: View {
    let text: String
    let query: String

    var body: some View {
        if query.isEmpty {
            Text(text)
        } else {
            highlightedText(text, query: query)
        }
    }
}

// MARK: - SearchHighlight ViewModifier

/// A ViewModifier that replaces its content with highlighted text when a search
/// query matches. If the query is empty or not found, the original content is
/// returned unchanged.
struct SearchHighlight: ViewModifier {
    let text: String
    let query: String

    func body(content: Content) -> some View {
        if query.isEmpty || text.range(of: query, options: .caseInsensitive) == nil {
            content
        } else {
            highlightedText(text, query: query)
        }
    }
}

// MARK: - Highlight Helper

/// Builds a composed `Text` view by splitting on query matches (case-insensitive)
/// and applying a golden yellow background to each match segment.
///
/// Approach: walk through the string finding each occurrence of `query`,
/// concatenating plain segments and highlighted segments via `Text` + `Text`.
func highlightedText(_ text: String, query: String) -> Text {
    guard !query.isEmpty else {
        return Text(text)
    }

    let lowercasedText = text.lowercased()
    let lowercasedQuery = query.lowercased()

    var result = Text("")
    var currentIndex = text.startIndex

    while let range = lowercasedText.range(
        of: lowercasedQuery,
        range: currentIndex..<text.endIndex
    ) {
        // Convert the range found in lowercased text to the original text indices
        let originalRange = range.lowerBound..<range.upperBound

        // Append the plain text before this match
        if currentIndex < originalRange.lowerBound {
            let prefix = String(text[currentIndex..<originalRange.lowerBound])
            result = result + Text(prefix)
        }

        // Append the highlighted match (using original casing)
        let match = String(text[originalRange])
        result = result + Text(match)
            .foregroundColor(Theme.textPrimary)
            .background(Theme.yellow)

        currentIndex = originalRange.upperBound
    }

    // Append any remaining text after the last match
    if currentIndex < text.endIndex {
        let suffix = String(text[currentIndex..<text.endIndex])
        result = result + Text(suffix)
    }

    return result
}

// MARK: - View Extension

extension View {
    /// Convenience modifier that highlights occurrences of `query` within `text`.
    /// Replaces the view content with highlighted text when matches are found.
    func searchHighlight(text: String, query: String) -> some View {
        modifier(SearchHighlight(text: text, query: query))
    }
}

// MARK: - Preview

struct SearchHighlight_Previews: PreviewProvider {
    static var previews: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Single match
            HighlightedText(
                text: "Hello world, this is a search test",
                query: "search"
            )

            // Empty query — plain text, no highlight
            HighlightedText(
                text: "No highlights when query is empty",
                query: ""
            )

            // Multiple matches
            HighlightedText(
                text: "The cat sat on the mat while another cat watched",
                query: "cat"
            )

            // Case-insensitive matching
            HighlightedText(
                text: "Swift is great. SWIFT is powerful. swift is fun.",
                query: "swift"
            )
        }
        .font(.body)
        .padding(24)
        .background(Theme.backgroundPrimary)
        .previewDisplayName("SearchHighlight — The Beautiful Notebook")
    }
}
```

## Design Notes

- **Theme.yellow** = `Color(hex: "#f2d479")` — warm golden highlight consistent with the notebook aesthetic
- **Theme.textPrimary** — keeps highlighted text readable against the yellow background
- **Theme.backgroundPrimary** — light book-like background for the preview
- Uses the **Text concatenation approach** (Option 2 from requirements) for simplicity and broad SwiftUI compatibility
- Case-insensitive matching via `lowercased()` comparison while preserving original casing in output
- The `highlightedText` helper is a free function so both `HighlightedText` view and `SearchHighlight` modifier can share it
