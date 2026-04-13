import SwiftUI

// MARK: - HelpTooltipModifier

struct HelpTooltipModifier: ViewModifier {
    let text: String

    func body(content: Content) -> some View {
        content
            .help(text)
    }
}

// MARK: - View Extension

extension View {
    func helpTooltip(_ text: String) -> some View {
        self.modifier(HelpTooltipModifier(text: text))
    }
}

// MARK: - HelpTooltips

struct HelpTooltips {
    static let toggleSidebar = "Show/Hide Sidebar (⌘0)"
    static let toggleChat = "Toggle Chat (⌘⇧C)"
    static let commandPalette = "Search (⌘K)"
    static let refreshTrajectories = "Refresh (⌘R)"
    static let exportMarkdown = "Export as Markdown"
    static let exportTimeline = "Export Timeline"
    static let exportJSON = "Export as JSON"
    static let copyToClipboard = "Copy to Clipboard"
    static let filterByStatus = "Filter by Status"
    static let searchTrajectories = "Search Trajectories"
    static let selectPersona = "Select Chat Persona"
    static let sendMessage = "Send Message (Return)"
    static let stopSession = "Stop Chat Session"
}

// MARK: - Preview

struct HelpTooltips_Previews: PreviewProvider {
    static var previews: some View {
        HStack(spacing: 16) {
            Button(action: {}) {
                Image(systemName: "sidebar.left")
            }
            .helpTooltip(HelpTooltips.toggleSidebar)

            Button(action: {}) {
                Image(systemName: "magnifyingglass")
            }
            .helpTooltip(HelpTooltips.commandPalette)

            Button(action: {}) {
                Image(systemName: "arrow.clockwise")
            }
            .helpTooltip(HelpTooltips.refreshTrajectories)
        }
        .padding()
    }
}
