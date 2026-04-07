import SwiftUI

// MARK: - FindingEventView

struct FindingEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            HStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Theme.blue)
                    .frame(width: 3)

                Text(event.content)
                    .bodyStyle()
                    .padding(.leading, Theme.spacingBase)
                    .padding(.vertical, Theme.spacingXS)
            }
        }
    }
}

// MARK: - Preview

struct FindingEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "finding-1",
            type: .finding,
            timestamp: Date(),
            agent: "Analyst",
            content: "The rate limiter on /api/auth/login is set to 1000 req/min - far too permissive for a login endpoint. Industry standard is 5-10 attempts per minute per IP.",
            significance: .high,
            metadata: nil,
            chapterId: "ch-1"
        )

        FindingEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
