import SwiftUI
import AppKit

// MARK: - Data Structures

struct TrajectoryClipboardData {
    let title: String
    let status: String
    let description: String?
    let decisions: [DecisionClipboardData]?
    let retrospectiveSummary: String?
}

struct DecisionClipboardData {
    let question: String
    let chosen: String
    let reasoning: String
    let alternatives: [String]
}

// MARK: - Clipboard Service

enum ClipboardService {

    static func copyToClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
    }

    static func copyTrajectoryAsMarkdown(_ trajectory: TrajectoryClipboardData) {
        var markdown = "# \(trajectory.title)\n\n"
        markdown += "**Status:** \(trajectory.status)\n\n"

        if let description = trajectory.description {
            markdown += "## Description\n\(description)\n\n"
        }

        if let decisions = trajectory.decisions, !decisions.isEmpty {
            markdown += "## Key Decisions\n"
            for decision in decisions {
                markdown += "- **\(decision.question)** → \(decision.chosen)\n"
            }
            markdown += "\n"
        }

        if let retrospective = trajectory.retrospectiveSummary {
            markdown += "## Retrospective\n\(retrospective)\n"
        }

        copyToClipboard(markdown)
        ToastManager.shared.show(message: "Trajectory copied as Markdown")
    }

    static func copyDecision(_ decision: DecisionClipboardData) {
        var text = "Question: \(decision.question)\n"
        text += "Decision: \(decision.chosen)\n"
        text += "Reasoning: \(decision.reasoning)\n"
        let alts = decision.alternatives.joined(separator: ", ")
        text += "Alternatives: \(alts)\n"

        copyToClipboard(text)
        ToastManager.shared.show(message: "Decision copied")
    }

    static func copyCodeBlock(_ code: String) {
        copyToClipboard(code)
        ToastManager.shared.show(message: "Code copied")
    }

    static func copyURL(_ url: String) {
        copyToClipboard(url)
        ToastManager.shared.show(message: "URL copied")
    }
}
