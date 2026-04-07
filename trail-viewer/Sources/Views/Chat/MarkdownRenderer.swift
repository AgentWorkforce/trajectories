import SwiftUI

// Converts a small subset of Markdown into an AttributedString for chat bubbles.
struct MarkdownRenderer {

    // MARK: - Public

    static func render(_ text: String) -> AttributedString {
        var result = AttributedString()
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var index = 0

        while index < lines.count {
            let line = lines[index]

            if line.hasPrefix("```") {
                let language = String(line.dropFirst(3)).trimmingCharacters(in: .whitespacesAndNewlines)
                var codeLines: [String] = []
                index += 1

                while index < lines.count && !lines[index].hasPrefix("```") {
                    codeLines.append(lines[index])
                    index += 1
                }

                if index < lines.count {
                    index += 1
                }

                var block = AttributedString(codeLines.joined(separator: "\n"))
                block.font = .system(size: 12, design: .monospaced)
                block.foregroundColor = Theme.textPrimary
                block.backgroundColor = Theme.sidebarBg

                if !language.isEmpty {
                    block.inlinePresentationIntent = .code
                }

                result.append(block)

                if index < lines.count {
                    result.append(AttributedString("\n"))
                }

                continue
            }

            result.append(parseInline(line))

            if index < lines.count - 1 {
                result.append(AttributedString("\n"))
            }

            index += 1
        }

        return result
    }

    // MARK: - Inline parsing

    private static func parseInline(_ text: String) -> AttributedString {
        var result = AttributedString()
        let scanner = Scanner(string: text)
        scanner.charactersToBeSkipped = nil
        var buffer = ""

        while !scanner.isAtEnd {
            let remaining = String(text[scanner.currentIndex...])

            if remaining.hasPrefix("**") {
                flushBuffer(&buffer, into: &result)
                scanner.currentIndex = text.index(scanner.currentIndex, offsetBy: 2)

                if let content = scanUntil(scanner: scanner, delimiter: "**", in: text) {
                    var attributed = AttributedString(content)
                    attributed.font = .system(size: 13.5, weight: .semibold)
                    attributed.foregroundColor = Theme.textPrimary
                    result.append(attributed)
                }

                continue
            }

            if remaining.hasPrefix("*") && !remaining.hasPrefix("**") {
                flushBuffer(&buffer, into: &result)
                scanner.currentIndex = text.index(after: scanner.currentIndex)

                if let content = scanUntil(scanner: scanner, delimiter: "*", in: text) {
                    var attributed = AttributedString(content)
                    attributed.font = .system(size: 13.5).italic()
                    attributed.foregroundColor = Theme.textSecondary
                    result.append(attributed)
                }

                continue
            }

            if remaining.hasPrefix("`") {
                flushBuffer(&buffer, into: &result)
                scanner.currentIndex = text.index(after: scanner.currentIndex)

                if let content = scanUntil(scanner: scanner, delimiter: "`", in: text) {
                    var attributed = AttributedString(content)
                    attributed.font = .system(size: 12, design: .monospaced)
                    attributed.foregroundColor = Theme.textPrimary
                    attributed.backgroundColor = Theme.sidebarBg
                    result.append(attributed)
                }

                continue
            }

            if remaining.hasPrefix("["),
               let (title, url) = parseLink(scanner: scanner, in: text) {
                flushBuffer(&buffer, into: &result)

                var attributed = AttributedString(title)
                attributed.foregroundColor = Theme.blue
                attributed.underlineStyle = .single

                if let link = URL(string: url) {
                    attributed.link = link
                }

                result.append(attributed)
                continue
            }

            buffer.append(text[scanner.currentIndex])
            scanner.currentIndex = text.index(after: scanner.currentIndex)
        }

        flushBuffer(&buffer, into: &result)
        return result
    }

    private static func flushBuffer(_ buffer: inout String, into result: inout AttributedString) {
        guard !buffer.isEmpty else { return }
        result.append(plainText(buffer))
        buffer = ""
    }

    private static func plainText(_ text: String) -> AttributedString {
        var attributed = AttributedString(text)
        attributed.font = .system(size: 13.5)
        attributed.foregroundColor = Theme.textPrimary
        return attributed
    }

    private static func scanUntil(scanner: Scanner, delimiter: String, in text: String) -> String? {
        var content = ""

        while !scanner.isAtEnd {
            let remaining = String(text[scanner.currentIndex...])
            if remaining.hasPrefix(delimiter) {
                scanner.currentIndex = text.index(scanner.currentIndex, offsetBy: delimiter.count)
                return content
            }

            content.append(text[scanner.currentIndex])
            scanner.currentIndex = text.index(after: scanner.currentIndex)
        }

        return content
    }

    private static func parseLink(scanner: Scanner, in text: String) -> (String, String)? {
        let startIndex = scanner.currentIndex

        guard text[scanner.currentIndex] == "[" else {
            return nil
        }

        scanner.currentIndex = text.index(after: scanner.currentIndex)

        guard let title = scanUntil(scanner: scanner, delimiter: "]", in: text) else {
            scanner.currentIndex = startIndex
            return nil
        }

        guard !scanner.isAtEnd, text[scanner.currentIndex] == "(" else {
            scanner.currentIndex = startIndex
            return nil
        }

        scanner.currentIndex = text.index(after: scanner.currentIndex)

        guard let url = scanUntil(scanner: scanner, delimiter: ")", in: text) else {
            scanner.currentIndex = startIndex
            return nil
        }

        return (title, url)
    }
}

// MARK: - Preview

struct MarkdownRenderer_Previews: PreviewProvider {
    static var previews: some View {
        let sample = """
        Here is **bold** and *italic* text with `inline code`.

        ```swift
        let x = 42
        print(x)
        ```

        Visit [Apple](https://apple.com) for more.
        """

        ScrollView {
            Text(MarkdownRenderer.render(sample))
                .padding(Theme.spacingMD)
        }
        .frame(width: 400, height: 300)
        .background(Theme.pageBg)
    }
}
