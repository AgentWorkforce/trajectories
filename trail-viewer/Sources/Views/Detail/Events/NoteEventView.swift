import SwiftUI

// MARK: - NoteEventView

struct NoteEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            HStack(alignment: .top, spacing: Theme.spacingSM) {
                Image(systemName: "book.fill")
                    .font(.system(size: 16))
                    .foregroundColor(Theme.textTertiary)
                    .frame(width: 20, alignment: .center)

                Text(event.content)
                    .bodyStyle()
            }
        }
    }
}

// MARK: - Preview

struct NoteEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            ts: Date().timeIntervalSince1970 * 1000,
            type: .note,
            content: "Began investigating the authentication flow. The session token appears to be stored in local storage rather than an HTTP-only cookie, which is a security concern.",
            agent: "Lead",
            significance: "low",
            metadata: nil
        )

        NoteEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
