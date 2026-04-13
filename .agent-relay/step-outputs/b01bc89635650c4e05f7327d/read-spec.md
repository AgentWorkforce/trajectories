# Chat Components Design Spec

All 6 chat UI components for the margin-notes / study-group aesthetic.
Uses Theme, Typography from `Sources/Design/`. Assumes ChatMessage, ChatPersona from `Sources/Data/ChatModels.swift`.

---

## FILE 1: MarkdownRenderer.swift

```swift
// Sources/Features/Chat/MarkdownRenderer.swift
// Converts a subset of Markdown to AttributedString for chat bubbles.

import SwiftUI

struct MarkdownRenderer {

    // MARK: - Public

    static func render(_ text: String) -> AttributedString {
        var result = AttributedString()
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var i = 0

        while i < lines.count {
            let line = lines[i]

            // Fenced code block
            if line.hasPrefix("```") {
                let language = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                var codeLines: [String] = []
                i += 1
                while i < lines.count && !lines[i].hasPrefix("```") {
                    codeLines.append(lines[i])
                    i += 1
                }
                if i < lines.count { i += 1 } // skip closing ```

                var block = AttributedString(codeLines.joined(separator: "\n"))
                block.font = .system(size: 12, design: .monospaced)
                block.foregroundColor = Color(hex: Theme.Colors.textPrimary)
                // Attach language as accessibility label so CodeBlockView can extract it
                if !language.isEmpty {
                    block.accessibilityLabel = "lang:\(language)"
                }
                result.append(block)
                result.append(AttributedString("\n"))
                continue
            }

            // Inline parsing for this line
            let parsed = parseInline(line)
            result.append(parsed)
            if i < lines.count - 1 {
                result.append(AttributedString("\n"))
            }
            i += 1
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

            // Bold **text**
            if remaining.hasPrefix("**") {
                if !buffer.isEmpty {
                    result.append(plainText(buffer))
                    buffer = ""
                }
                scanner.currentIndex = text.index(scanner.currentIndex, offsetBy: 2)
                if let content = scanUntil(scanner: scanner, delimiter: "**", in: text) {
                    var attr = AttributedString(content)
                    attr.font = .system(size: 13.5, weight: .semibold)
                    attr.foregroundColor = Color(hex: Theme.Colors.textPrimary)
                    result.append(attr)
                }
                continue
            }

            // Italic *text*
            if remaining.hasPrefix("*") && !remaining.hasPrefix("**") {
                if !buffer.isEmpty {
                    result.append(plainText(buffer))
                    buffer = ""
                }
                scanner.currentIndex = text.index(scanner.currentIndex, offsetBy: 1)
                if let content = scanUntil(scanner: scanner, delimiter: "*", in: text) {
                    var attr = AttributedString(content)
                    attr.font = .system(size: 13.5).italic()
                    attr.foregroundColor = Color(hex: Theme.Colors.textSecondary)
                    result.append(attr)
                }
                continue
            }

            // Inline code `text`
            if remaining.hasPrefix("`") {
                if !buffer.isEmpty {
                    result.append(plainText(buffer))
                    buffer = ""
                }
                scanner.currentIndex = text.index(scanner.currentIndex, offsetBy: 1)
                if let content = scanUntil(scanner: scanner, delimiter: "`", in: text) {
                    var attr = AttributedString(content)
                    attr.font = .system(size: 12, design: .monospaced)
                    attr.foregroundColor = Color(hex: Theme.Colors.textPrimary)
                    attr.backgroundColor = Color(hex: Theme.Colors.sidebarBg)
                    result.append(attr)
                }
                continue
            }

            // Link [title](url)
            if remaining.hasPrefix("[") {
                if let (title, url) = parseLink(scanner: scanner, in: text) {
                    if !buffer.isEmpty {
                        result.append(plainText(buffer))
                        buffer = ""
                    }
                    var attr = AttributedString(title)
                    attr.foregroundColor = Color(hex: Theme.Colors.blue)
                    attr.underlineStyle = .single
                    if let link = URL(string: url) {
                        attr.link = link
                    }
                    result.append(attr)
                    continue
                }
            }

            // Plain character
            buffer.append(text[scanner.currentIndex])
            scanner.currentIndex = text.index(after: scanner.currentIndex)
        }

        if !buffer.isEmpty {
            result.append(plainText(buffer))
        }

        return result
    }

    private static func plainText(_ text: String) -> AttributedString {
        var attr = AttributedString(text)
        attr.font = .system(size: 13.5)
        attr.foregroundColor = Color(hex: Theme.Colors.textPrimary)
        return attr
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
        return content // unclosed delimiter — return what we have
    }

    private static func parseLink(scanner: Scanner, in text: String) -> (String, String)? {
        let startIndex = scanner.currentIndex
        // Expect [
        guard text[scanner.currentIndex] == "[" else { return nil }
        scanner.currentIndex = text.index(after: scanner.currentIndex)

        guard let title = scanUntil(scanner: scanner, delimiter: "]", in: text) else {
            scanner.currentIndex = startIndex
            return nil
        }
        // Expect (
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

#Preview("Markdown Renderer") {
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
            .padding(Theme.Spacing.md)
    }
    .frame(width: 400, height: 300)
    .background(Color(hex: Theme.Colors.pageBg))
}
```

---

## FILE 2: CodeBlockView.swift

```swift
// Sources/Features/Chat/CodeBlockView.swift
// Monospace code block on sidebarBg with language label and copy button.

import SwiftUI

struct CodeBlockView: View {
    let code: String
    let language: String

    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header bar with language label + copy
            if !language.isEmpty || true {
                HStack {
                    if !language.isEmpty {
                        Text(language.lowercased())
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(Color(hex: Theme.Colors.textTertiary))
                            .textCase(.uppercase)
                            .tracking(0.5)
                    }
                    Spacer()
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(code, forType: .string)
                        copied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            copied = false
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 10))
                            Text(copied ? "Copied" : "Copy")
                                .font(.system(size: 10, weight: .medium))
                        }
                        .foregroundStyle(
                            copied
                                ? Color(hex: Theme.Colors.success)
                                : Color(hex: Theme.Colors.textTertiary)
                        )
                        .animation(.easeInOut(duration: 0.2), value: copied)
                    }
                    .buttonStyle(.plain)
                    .cursor(.pointingHand)
                }
                .padding(.horizontal, Theme.Spacing.base)
                .padding(.vertical, Theme.Spacing.sm)
                .background(Color(hex: Theme.Colors.sidebarBg).opacity(0.7))
            }

            // Code body
            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Color(hex: Theme.Colors.textPrimary))
                    .lineSpacing(4)
                    .textSelection(.enabled)
                    .padding(Theme.Spacing.base)
            }
        }
        .background(Color(hex: Theme.Colors.sidebarBg))
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                .stroke(Color(hex: Theme.Colors.borderLight), lineWidth: 1)
        )
    }
}

// MARK: - Preview

#Preview("Code Block") {
    VStack(spacing: Theme.Spacing.md) {
        CodeBlockView(
            code: """
            func greet(_ name: String) -> String {
                return "Hello, \\(name)!"
            }
            """,
            language: "swift"
        )

        CodeBlockView(
            code: "npm install @agent/sdk",
            language: ""
        )
    }
    .padding(Theme.Spacing.lg)
    .frame(width: 420)
    .background(Color(hex: Theme.Colors.pageBg))
}
```

---

## FILE 3: TypingIndicator.swift

```swift
// Sources/Features/Chat/TypingIndicator.swift
// Three dots with staggered opacity pulse, 1.2s cycle.

import SwiftUI

struct TypingIndicator: View {
    let persona: ChatPersona?

    @State private var animating = false

    private let dotCount = 3
    private let dotSize: CGFloat = 6
    private let cycleDuration: Double = 1.2

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            // Optional persona pill
            if let persona {
                PersonaCard(persona: persona, isActive: true, compact: true)
            }

            HStack(spacing: 5) {
                ForEach(0..<dotCount, id: \.self) { index in
                    Circle()
                        .fill(dotColor)
                        .frame(width: dotSize, height: dotSize)
                        .opacity(animating ? 1.0 : 0.3)
                        .animation(
                            .easeInOut(duration: cycleDuration / 2)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * (cycleDuration / Double(dotCount))),
                            value: animating
                        )
                }
            }
            .padding(.horizontal, Theme.Spacing.base)
            .padding(.vertical, Theme.Spacing.sm)
            .background(Color(hex: Theme.Colors.cardBg))
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color(hex: Theme.Colors.borderLight), lineWidth: 1)
            )
        }
        .onAppear { animating = true }
    }

    private var dotColor: Color {
        if let persona {
            return persona.color.opacity(0.8)
        }
        return Color(hex: Theme.Colors.textTertiary)
    }
}

// MARK: - Preview

#Preview("Typing Indicator") {
    let persona = ChatPersona(
        id: "analyst",
        name: "Analyst",
        emoji: "🔍",
        description: "Deep thinker",
        colorHex: "#8fae8b"
    )

    VStack(spacing: Theme.Spacing.lg) {
        TypingIndicator(persona: nil)
        TypingIndicator(persona: persona)
    }
    .padding(Theme.Spacing.xl)
    .background(Color(hex: Theme.Colors.pageBg))
}
```

---

## FILE 4: PersonaCard.swift

```swift
// Sources/Features/Chat/PersonaCard.swift
// Capsule pill showing emoji + name with active/inactive states.

import SwiftUI

struct PersonaCard: View {
    let persona: ChatPersona
    let isActive: Bool
    var compact: Bool = false

    var body: some View {
        HStack(spacing: compact ? 3 : Theme.Spacing.xs) {
            Text(persona.emoji)
                .font(.system(size: compact ? 11 : 13))

            Text(persona.name)
                .font(.system(
                    size: compact ? 10 : 11,
                    weight: isActive ? .semibold : .medium
                ))
                .foregroundStyle(
                    isActive
                        ? Color(hex: Theme.Colors.textPrimary)
                        : Color(hex: Theme.Colors.textTertiary)
                )
        }
        .padding(.horizontal, compact ? Theme.Spacing.sm : Theme.Spacing.base)
        .padding(.vertical, compact ? 3 : Theme.Spacing.xs)
        .background(
            isActive
                ? persona.color.opacity(0.12)
                : Color(hex: Theme.Colors.sidebarBg).opacity(0.5)
        )
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(
                    isActive
                        ? persona.color.opacity(0.35)
                        : Color(hex: Theme.Colors.borderLight),
                    lineWidth: 1
                )
        )
        .opacity(isActive ? 1.0 : 0.6)
        .animation(.easeInOut(duration: 0.2), value: isActive)
    }
}

// MARK: - Preview

#Preview("Persona Cards") {
    let personas = [
        ChatPersona(id: "critic", name: "Critic", emoji: "🧐", description: "", colorHex: "#c87f6b"),
        ChatPersona(id: "historian", name: "Historian", emoji: "📜", description: "", colorHex: "#7eb8da"),
        ChatPersona(id: "analyst", name: "Analyst", emoji: "🔍", description: "", colorHex: "#8fae8b"),
    ]

    HStack(spacing: Theme.Spacing.sm) {
        ForEach(personas) { persona in
            PersonaCard(persona: persona, isActive: persona.id == "historian")
        }
    }
    .padding(Theme.Spacing.lg)
    .background(Color(hex: Theme.Colors.pageBg))
}
```

---

## FILE 5: ChatBubble.swift

```swift
// Sources/Features/Chat/ChatBubble.swift
// User bubbles (right, blueMuted) vs Agent bubbles (left, cardBg with persona border).

import SwiftUI

struct ChatBubble: View {
    let message: ChatMessage
    let persona: ChatPersona?

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            if message.isUser { Spacer(minLength: 60) }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: Theme.Spacing.xs) {
                // Persona pill for agent messages
                if !message.isUser, let persona {
                    PersonaCard(persona: persona, isActive: true, compact: true)
                }

                // Bubble
                VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    Text(MarkdownRenderer.render(message.content))
                        .textSelection(.enabled)

                    // Timestamp
                    Text(message.timestamp, style: .time)
                        .font(.system(size: 10))
                        .foregroundStyle(Color(hex: Theme.Colors.textTertiary))
                }
                .padding(.horizontal, Theme.Spacing.md)
                .padding(.vertical, Theme.Spacing.base)
                .background(bubbleBackground)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
                .overlay(bubbleBorder)
            }

            if !message.isUser { Spacer(minLength: 60) }
        }
    }

    // MARK: - Styling

    @ViewBuilder
    private var bubbleBackground: some View {
        if message.isUser {
            Color(hex: Theme.Colors.blueMuted)
        } else {
            Color(hex: Theme.Colors.cardBg)
        }
    }

    private var bubbleBorder: some View {
        RoundedRectangle(cornerRadius: Theme.CornerRadius.lg)
            .stroke(borderColor, lineWidth: 1)
    }

    private var borderColor: Color {
        if message.isUser {
            return Color(hex: Theme.Colors.blueLight)
        }
        if let persona {
            return persona.color.opacity(0.3)
        }
        return Color(hex: Theme.Colors.borderLight)
    }
}

// MARK: - System Message variant

struct SystemMessageView: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            Rectangle()
                .fill(Color(hex: Theme.Colors.borderLight))
                .frame(width: 1)
                .padding(.vertical, 2)

            Text(message.content)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color(hex: Theme.Colors.textTertiary))
                .italic()
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.xs)
    }
}

// MARK: - Preview

#Preview("Chat Bubbles") {
    let persona = ChatPersona(
        id: "critic",
        name: "Critic",
        emoji: "🧐",
        description: "Finds flaws",
        colorHex: "#c87f6b"
    )

    let agentMsg = ChatMessage(
        id: UUID(),
        from: "critic",
        content: "The author's use of **unreliable narration** here is *fascinating*. Notice how the `timestamp` metadata contradicts the narrative.",
        persona: "critic",
        timestamp: Date()
    )

    let userMsg = ChatMessage(
        id: UUID(),
        from: "user",
        content: "Can you elaborate on that? I didn't catch the contradiction.",
        persona: nil,
        timestamp: Date()
    )

    let systemMsg = ChatMessage(
        id: UUID(),
        from: "system",
        content: "Critic has joined the discussion.",
        persona: nil,
        timestamp: Date()
    )

    VStack(alignment: .leading, spacing: Theme.Spacing.base) {
        SystemMessageView(message: systemMsg)
        ChatBubble(message: agentMsg, persona: persona)
        ChatBubble(message: userMsg, persona: nil)
    }
    .padding(Theme.Spacing.lg)
    .frame(width: 420)
    .background(Color(hex: Theme.Colors.pageBg))
}
```

---

## FILE 6: ChatInputBar.swift

```swift
// Sources/Features/Chat/ChatInputBar.swift
// Multi-line TextEditor with send button and Cmd+Enter shortcut.

import SwiftUI

struct ChatInputBar: View {
    @Binding var text: String
    let onSend: (String) -> Void
    let isConnected: Bool

    @State private var editorHeight: CGFloat = 36
    @FocusState private var isFocused: Bool

    private let minHeight: CGFloat = 36
    private let maxHeight: CGFloat = 120

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.Spacing.sm) {
            // Text input area
            ZStack(alignment: .topLeading) {
                // Placeholder
                if text.isEmpty {
                    Text("Add a margin note...")
                        .font(.system(size: 13.5))
                        .foregroundStyle(Color(hex: Theme.Colors.textTertiary))
                        .padding(.horizontal, Theme.Spacing.sm)
                        .padding(.vertical, Theme.Spacing.sm)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $text)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Color(hex: Theme.Colors.textPrimary))
                    .scrollContentBackground(.hidden)
                    .focused($isFocused)
                    .frame(minHeight: minHeight, maxHeight: maxHeight)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, Theme.Spacing.xs)
            .background(Color(hex: Theme.Colors.cardBg))
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.lg)
                    .stroke(
                        isFocused
                            ? Color(hex: Theme.Colors.blue).opacity(0.5)
                            : Color(hex: Theme.Colors.border),
                        lineWidth: 1
                    )
            )
            .animation(.easeInOut(duration: 0.15), value: isFocused)

            // Send button
            Button(action: sendMessage) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(canSend ? Color(hex: Theme.Colors.blue) : Color(hex: Theme.Colors.borderLight))
                    .symbolRenderingMode(.hierarchical)
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .keyboardShortcut(.return, modifiers: .command)
            .cursor(canSend ? .pointingHand : .arrow)
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.base)
        .background(
            Color(hex: Theme.Colors.pageBg)
                .shadow(color: .black.opacity(0.04), radius: 8, y: -2)
        )
    }

    // MARK: - Helpers

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && isConnected
    }

    private func sendMessage() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        onSend(trimmed)
        text = ""
    }
}

// MARK: - Preview

#Preview("Chat Input Bar") {
    struct PreviewWrapper: View {
        @State private var text = ""
        var body: some View {
            VStack {
                Spacer()
                ChatInputBar(
                    text: $text,
                    onSend: { msg in print("Sent: \(msg)") },
                    isConnected: true
                )
            }
            .frame(width: 420, height: 200)
            .background(Color(hex: Theme.Colors.pageBg))
        }
    }
    return PreviewWrapper()
}
```

---

## Design Notes

- **Bookish feel**: serif persona names would be an optional upgrade; kept sans-serif for legibility at small sizes. The warm palette (pageBg #faf8f5, sidebarBg #f0ece4) already evokes parchment.
- **Not Slack**: No avatars, no reactions bar, no status dots. Bubbles are soft rounded with thin borders instead of bold platform colors.
- **Persona colors**: Agent bubbles get a subtle persona-colored border (0.3 opacity). User bubbles use blueMuted background with blueLight border.
- **Code blocks**: Rendered on sidebarBg to look like marginalia on aged paper.
- **Typing indicator**: Capsule with 3 dots, persona-colored when associated with a specific agent.
- **Input bar**: "Add a margin note..." placeholder reinforces the book metaphor. Cmd+Enter to send.
