import SwiftUI

// MARK: - ErrorEventView

struct ErrorEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            HStack(spacing: 0) {
                // Red left border - 3pt
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Theme.error)
                    .frame(width: 3)

                HStack(alignment: .top, spacing: Theme.spacingSM) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Theme.error)
                        .frame(width: 20, alignment: .center)

                    Text(event.content)
                        .bodyStyle()
                        .foregroundColor(Theme.textPrimary)
                }
                .padding(Theme.spacingBase)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.error.opacity(0.1))
                .cornerRadius(Theme.radiusMD)
            }
        }
    }
}

// MARK: - Preview

struct ErrorEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "error-1",
            type: .error,
            timestamp: Date(),
            agent: "Worker",
            content: "Build failed: Type 'SessionManager' has no member 'setHttpOnlyCookie'. The API was renamed in v2.3 - need to use 'setCookieWithOptions' instead.",
            significance: .high,
            metadata: nil,
            chapterId: "ch-1"
        )

        ErrorEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
