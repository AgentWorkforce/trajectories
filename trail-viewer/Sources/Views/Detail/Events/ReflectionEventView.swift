import SwiftUI

// MARK: - ReflectionEventView

struct ReflectionEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            VStack(alignment: .leading, spacing: 0) {
                Text(event.content)
                    .font(.system(size: 13.5, design: .serif))
                    .italic()
                    .foregroundColor(Theme.textSecondary)
                    .lineSpacing(13.5 * 0.5)
                    .padding(Theme.spacingBase)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Theme.yellowMuted)
            .cornerRadius(Theme.radiusMD)
        }
    }
}

// MARK: - Preview

struct ReflectionEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            ts: Date().timeIntervalSince1970 * 1000,
            type: .reflection,
            content: "In hindsight, we should have audited the token storage mechanism earlier. The localStorage approach was inherited from the initial prototype and never revisited during the security hardening phase.",
            agent: "Lead",
            significance: "medium",
            metadata: nil
        )

        ReflectionEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
