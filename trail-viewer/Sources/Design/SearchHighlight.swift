import SwiftUI

// MARK: - HighlightedText View

/// A standalone view that renders text with search query matches highlighted
/// in a warm golden yellow, consistent with the light-mode notebook design.
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

    var result = Text("")
    var currentIndex = text.startIndex

    while let range = text.range(
        of: query,
        options: .caseInsensitive,
        range: currentIndex..<text.endIndex
    ) {
        if currentIndex < range.lowerBound {
            let prefix = String(text[currentIndex..<range.lowerBound])
            result = result + Text(prefix)
        }

        let match = String(text[range])
        result = result + Text(match)
            .foregroundColor(Theme.textPrimary)
            .underline(color: Theme.yellow)

        currentIndex = range.upperBound
    }

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
            HighlightedText(
                text: "Hello world, this is a search test",
                query: "search"
            )

            HighlightedText(
                text: "No highlights when query is empty",
                query: ""
            )

            HighlightedText(
                text: "The cat sat on the mat while another cat watched",
                query: "cat"
            )

            HighlightedText(
                text: "Swift is great. SWIFT is powerful. swift is fun.",
                query: "swift"
            )
        }
        .font(.body)
        .padding(24)
        .background(Theme.pageBg)
        .previewDisplayName("SearchHighlight - The Beautiful Notebook")
    }
}
