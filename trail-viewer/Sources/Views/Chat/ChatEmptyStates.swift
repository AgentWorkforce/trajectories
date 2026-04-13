import SwiftUI

// MARK: - No Trajectory Selected

struct NoTrajectorySelectedState: View {
    var body: some View {
        EmptyState(
            icon: "bubble.left.and.text.bubble.right",
            title: "No Trajectory Selected",
            subtitle: "Select a trajectory from the sidebar to start a discussion"
        )
        .background(Theme.pageBg)
    }
}

// MARK: - No Session Started

struct NoSessionStartedState: View {
    let personaCount: Int
    var isConnecting: Bool = false
    var error: APIError? = nil
    let onStartSession: () -> Void

    var body: some View {
        VStack {
            Spacer()
            BookCard {
                VStack(alignment: .center, spacing: Theme.spacingMD) {
                    Image(systemName: "text.bubble.fill")
                        .font(.system(size: 32))
                        .foregroundColor(Theme.blue)

                    Text("Ask agents about this trajectory")
                        .font(.system(size: 18, weight: .semibold, design: .serif))
                        .foregroundColor(Theme.textPrimary)

                    Text("\(personaCount) AI personas available to discuss")
                        .caption()

                    if let error {
                        Text(error.localizedDescription)
                            .font(.system(size: 12))
                            .foregroundColor(Theme.error)
                            .multilineTextAlignment(.center)
                    }

                    Button(action: onStartSession) {
                        if isConnecting {
                            ProgressView()
                                .controlSize(.small)
                                .padding(.horizontal, Theme.spacingLG)
                                .padding(.vertical, Theme.spacingSM)
                        } else {
                            Text(error != nil ? "Retry" : "Start Discussion")
                                .font(.system(size: 13.5, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, Theme.spacingLG)
                                .padding(.vertical, Theme.spacingSM)
                                .background(Theme.blue)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(isConnecting)
                }
                .padding(Theme.spacingLG)
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: 360)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - No Messages Hint

struct NoMessagesHint: View {
    var body: some View {
        VStack(spacing: Theme.spacingSM) {
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 20))
                .foregroundColor(Theme.textTertiary)

            Text("Start the conversation below")
                .caption()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .opacity(0.7)
    }
}

// MARK: - Previews

struct ChatEmptyStates_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            NoTrajectorySelectedState()
                .frame(width: 600, height: 400)
                .previewDisplayName("No Trajectory Selected")

            NoSessionStartedState(personaCount: 6, onStartSession: {})
                .frame(width: 600, height: 400)
                .background(Theme.pageBg)
                .previewDisplayName("No Session Started")

            NoMessagesHint()
                .frame(width: 600, height: 300)
                .background(Theme.pageBg)
                .previewDisplayName("No Messages Hint")
        }
    }
}
