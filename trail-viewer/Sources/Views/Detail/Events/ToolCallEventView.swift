import SwiftUI

// MARK: - ToolCallEventView

struct ToolCallEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    @State private var isExpanded = false

    private var toolName: String {
        event.metadata?["tool"] ?? "unknown"
    }

    private var isLongContent: Bool {
        event.content.count > 300
    }

    private var displayContent: String {
        if !isExpanded && isLongContent {
            return String(event.content.prefix(280)) + "…"
        }
        return event.content
    }

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                HStack(spacing: Theme.spacingSM) {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Theme.textTertiary)

                    Text(toolName)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundColor(Theme.textPrimary)
                }

                VStack(alignment: .leading, spacing: 0) {
                    Text(displayContent)
                        .codeStyle()
                        .padding(Theme.spacingBase)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Theme.sidebarBg)
                .cornerRadius(Theme.radiusMD)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .strokeBorder(Theme.borderLight, lineWidth: 0.5)
                )

                if isLongContent {
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isExpanded.toggle()
                        }
                    }) {
                        Text(isExpanded ? "Show less" : "Show more")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Theme.blue)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Preview

struct ToolCallEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            ts: Date().timeIntervalSince1970 * 1000,
            type: .toolCall,
            content: "grep -r 'localStorage.setItem' src/auth/\n\nsrc/auth/session.ts:42:  localStorage.setItem('session_token', token)\nsrc/auth/refresh.ts:18:  localStorage.setItem('refresh_token', refresh)",
            agent: "Worker",
            significance: "medium",
            metadata: ["tool": "grep"]
        )

        ToolCallEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
