import SwiftUI

// MARK: - MessageEventView

struct MessageEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    private var isSent: Bool {
        event.type == .messageSent
    }

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            if isSent {
                sentBubble
            } else {
                receivedBubble
            }
        }
    }

    // MARK: - Sent Bubble (right-aligned, blue)

    private var sentBubble: some View {
        HStack {
            Spacer(minLength: 40)

            VStack(alignment: .trailing, spacing: Theme.spacingXS) {
                Text("You")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Theme.blue)

                Text(event.content)
                    .bodyStyle()
                    .padding(Theme.spacingBase)
                    .background(Theme.blueMuted)
                    .cornerRadius(Theme.radiusLG)
            }
        }
    }

    // MARK: - Received Bubble (left-aligned, card bg)

    private var receivedBubble: some View {
        HStack(alignment: .top, spacing: Theme.spacingSM) {
            AgentAvatar(name: event.agent ?? "Agent", size: 24)

            VStack(alignment: .leading, spacing: Theme.spacingXS) {
                Text(event.agent ?? "Agent")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Theme.textSecondary)

                Text(event.content)
                    .bodyStyle()
                    .padding(Theme.spacingBase)
                    .background(Theme.cardBg)
                    .cornerRadius(Theme.radiusLG)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusLG)
                            .strokeBorder(Theme.borderLight, lineWidth: 0.5)
                    )
            }

            Spacer(minLength: 40)
        }
    }
}

// MARK: - Preview

struct MessageEventView_Previews: PreviewProvider {
    static var previews: some View {
        let sentEvent = TrajectoryEvent(
            id: "msg-sent-1",
            type: .messageSent,
            timestamp: Date(),
            agent: "Lead",
            content: "Please audit the session token storage in src/auth/ and report back on any security concerns.",
            significance: .medium,
            metadata: nil,
            chapterId: "ch-1"
        )

        let receivedEvent = TrajectoryEvent(
            id: "msg-recv-1",
            type: .messageReceived,
            timestamp: Date(),
            agent: "Worker",
            content: "Found three instances of localStorage usage for sensitive tokens. Will prepare a migration plan to HTTP-only cookies.",
            significance: .medium,
            metadata: nil,
            chapterId: "ch-1"
        )

        VStack(spacing: Theme.spacingLG) {
            MessageEventView(event: sentEvent)
            MessageEventView(event: receivedEvent)
        }
        .padding()
        .background(Theme.pageBg)
        .previewLayout(.sizeThatFits)
    }
}
