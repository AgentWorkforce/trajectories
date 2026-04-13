import SwiftUI

// MARK: - EventCardBase

struct EventCardBase<Content: View>: View {
    let event: TrajectoryEvent
    let chapterAgent: String?
    @ViewBuilder let content: () -> Content

    init(
        event: TrajectoryEvent,
        chapterAgent: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.event = event
        self.chapterAgent = chapterAgent
        self.content = content
    }

    private var showAgentBadge: Bool {
        guard let eventAgent = event.agent,
              let chapAgent = chapterAgent else { return false }
        return eventAgent != chapAgent
    }

    private var formattedTime: String {
        guard let date = event.timestamp else { return "--:--" }
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }

    private var confidenceText: String? {
        guard let meta = event.metadata,
              let conf = meta["confidence"],
              let value = Double(conf) else { return nil }
        return "\(Int(value * 100))%"
    }

    var body: some View {
        HStack(alignment: .top, spacing: Theme.spacingBase) {
            SignificanceDot(level: event.significance ?? "low")
                .padding(.top, 5)

            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .trailing, spacing: Theme.spacingXS) {
                Text(formattedTime)
                    .caption()

                if showAgentBadge, let agentName = event.agent {
                    AgentAvatar(name: agentName, size: 20)
                }

                if let conf = confidenceText {
                    Text(conf)
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundColor(Theme.textTertiary)
                }
            }
        }
        .padding(.vertical, Theme.spacingMD)
    }
}

// MARK: - Preview

struct EventCardBase_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            ts: Date().timeIntervalSince1970 * 1000,
            type: .note,
            content: "This is a sample event card with some body text to demonstrate the layout.",
            agent: "Architect",
            significance: "medium",
            metadata: ["confidence": "0.85"]
        )

        EventCardBase(event: event, chapterAgent: "Lead") {
            Text(event.content)
                .bodyStyle()
        }
        .padding()
        .background(Theme.pageBg)
        .previewLayout(.sizeThatFits)
    }
}
