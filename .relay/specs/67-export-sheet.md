# ExportSheet.swift — Complete Implementation

```swift
import SwiftUI
import AppKit
import UniformTypeIdentifiers

// MARK: - Export Format

enum ExportFormat: String, CaseIterable, Identifiable {
    case markdown = "Markdown"
    case json = "JSON"
    case timeline = "Timeline"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .markdown: return "doc.text"
        case .json: return "curlybraces"
        case .timeline: return "clock"
        }
    }

    var fileExtension: String {
        switch self {
        case .markdown: return "md"
        case .json: return "json"
        case .timeline: return "txt"
        }
    }
}

// MARK: - ExportSheet

struct ExportSheet: View {
    let trajectory: Trajectory
    @Binding var isPresented: Bool
    @State private var selectedFormat: ExportFormat = .markdown

    var body: some View {
        VStack(spacing: 0) {
            // MARK: Header
            HStack {
                Text("Export Trajectory")
                    .font(Typography.heading)
                Spacer()
                Button(action: { isPresented = false }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(Theme.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .padding(Theme.spacingMD)

            RuleLine()

            // MARK: Format Picker
            HStack(spacing: Theme.spacingSM) {
                ForEach(ExportFormat.allCases) { format in
                    Button(action: { selectedFormat = format }) {
                        HStack(spacing: 4) {
                            Image(systemName: format.icon)
                            Text(format.rawValue)
                        }
                        .font(Typography.caption)
                        .padding(.horizontal, Theme.spacingMD)
                        .padding(.vertical, 6)
                        .background(
                            selectedFormat == format
                                ? Theme.blue
                                : Theme.cardBg
                        )
                        .foregroundColor(
                            selectedFormat == format
                                ? .white
                                : Theme.textSecondary
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(Theme.spacingMD)

            // MARK: Preview Area
            BookCard {
                ScrollView {
                    Text(exportContent)
                        .font(
                            selectedFormat == .json
                                ? .system(.body, design: .monospaced)
                                : Typography.body
                        )
                        .foregroundColor(Theme.textPrimary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 300)
                .padding(Theme.spacingMD)
            }

            // MARK: Action Buttons
            HStack {
                Button(action: copyToClipboard) {
                    HStack {
                        Image(systemName: "doc.on.doc")
                        Text("Copy to Clipboard")
                    }
                    .font(Typography.body)
                    .foregroundColor(Theme.blue)
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: saveToFile) {
                    HStack {
                        Image(systemName: "square.and.arrow.down")
                        Text("Save to File...")
                    }
                    .font(Typography.body.bold())
                    .foregroundColor(.white)
                    .padding(.horizontal, Theme.spacingLG)
                    .padding(.vertical, Theme.spacingSM)
                    .background(Theme.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
            .padding(Theme.spacingMD)
        }
        .frame(width: 550, minHeight: 450)
        .background(Theme.pageBg)
    }

    // MARK: - Export Content

    var exportContent: String {
        switch selectedFormat {
        case .markdown:
            return generateMarkdown()
        case .json:
            return generateJSON()
        case .timeline:
            return generateTimeline()
        }
    }

    // MARK: - Markdown Export

    private func generateMarkdown() -> String {
        var lines: [String] = []

        lines.append("# \(trajectory.title)")
        lines.append("")

        if let description = trajectory.description {
            lines.append(description)
            lines.append("")
        }

        lines.append("---")
        lines.append("")

        if let chapters = trajectory.chapters {
            for chapter in chapters {
                lines.append("## \(chapter.title)")
                lines.append("")

                if let summary = chapter.summary {
                    lines.append(summary)
                    lines.append("")
                }

                for event in chapter.events {
                    switch event.type {
                    case .tool:
                        lines.append("### Tool: \(event.tool ?? "unknown")")
                    case .thought:
                        lines.append("### Thought")
                    case .result:
                        lines.append("### Result")
                    default:
                        lines.append("### \(event.type.rawValue.capitalized)")
                    }

                    if let content = event.content {
                        lines.append("")
                        lines.append(content)
                    }
                    lines.append("")
                }
            }
        }

        if let retrospective = trajectory.retrospective {
            lines.append("---")
            lines.append("")
            lines.append("## Retrospective")
            lines.append("")
            lines.append(retrospective)
            lines.append("")
        }

        return lines.joined(separator: "\n")
    }

    // MARK: - JSON Export

    private func generateJSON() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        guard let data = try? encoder.encode(trajectory),
              let jsonString = String(data: data, encoding: .utf8) else {
            return "{ \"error\": \"Failed to encode trajectory\" }"
        }

        return jsonString
    }

    // MARK: - Timeline Export

    private func generateTimeline() -> String {
        var lines: [String] = []

        lines.append("TIMELINE: \(trajectory.title)")
        lines.append("=" .padding(toLength: 60, withPad: "=", startingAt: 0))
        lines.append("")

        if let chapters = trajectory.chapters {
            for chapter in chapters {
                lines.append("[\(chapter.title)]")

                for event in chapter.events {
                    let timestamp = event.timestamp.map { formatTimestamp($0) } ?? "--:--"
                    let typeLabel = event.type.rawValue.uppercased()
                    let detail = event.tool ?? event.content?.prefix(80).description ?? ""

                    lines.append("  \(timestamp)  \(typeLabel)  \(detail)")
                }

                lines.append("")
            }
        }

        return lines.joined(separator: "\n")
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }

    // MARK: - Actions

    private func copyToClipboard() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(exportContent, forType: .string)
    }

    private func saveToFile() {
        let panel = NSSavePanel()

        switch selectedFormat {
        case .markdown:
            panel.allowedContentTypes = [UTType.plainText]
        case .json:
            panel.allowedContentTypes = [UTType.json]
        case .timeline:
            panel.allowedContentTypes = [UTType.plainText]
        }

        panel.nameFieldStringValue = "\(trajectory.id).\(selectedFormat.fileExtension)"
        panel.canCreateDirectories = true

        panel.begin { response in
            if response == .OK, let url = panel.url {
                try? exportContent.write(to: url, atomically: true, encoding: .utf8)
            }
        }
    }
}

// MARK: - Preview

struct ExportSheet_Previews: PreviewProvider {
    static var previews: some View {
        ExportSheet(
            trajectory: .preview,
            isPresented: .constant(true)
        )
    }
}
```
