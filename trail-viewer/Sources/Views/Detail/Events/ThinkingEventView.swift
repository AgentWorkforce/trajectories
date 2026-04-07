import SwiftUI

// MARK: - ThinkingEventView

struct ThinkingEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    @State private var isExpanded = false

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isExpanded.toggle()
                    }
                }) {
                    HStack(spacing: Theme.spacingSM) {
                        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(Theme.textTertiary)
                            .frame(width: 12)

                        Text("Thinking...")
                            .font(.system(size: 13.5, design: .serif))
                            .italic()
                            .foregroundColor(Theme.textTertiary)
                    }
                }
                .buttonStyle(.plain)

                if isExpanded {
                    Text(event.content)
                        .font(.system(size: 13, design: .serif))
                        .italic()
                        .foregroundColor(Theme.textTertiary)
                        .lineSpacing(13 * 0.5)
                        .padding(.leading, 20)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }
}

// MARK: - Preview

struct ThinkingEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "thinking-1",
            type: .thinking,
            timestamp: Date(),
            agent: "Lead",
            content: "If we migrate the session store from localStorage to HTTP-only cookies, we need to consider CSRF protection. The existing CORS configuration should handle most cases, but we should also add a CSRF token for state-mutating requests.",
            significance: .low,
            metadata: nil,
            chapterId: "ch-1"
        )

        VStack {
            ThinkingEventView(event: event)
        }
        .padding()
        .background(Theme.pageBg)
        .previewLayout(.sizeThatFits)
    }
}
