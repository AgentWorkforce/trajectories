import SwiftUI

struct EmptyState: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: Theme.spacingLG) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(Theme.blue.opacity(0.4))

            Text(title)
                .sectionTitle()

            Text(subtitle)
                .bodyStyle()
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Theme.spacingXL)
    }
}

#Preview("No Trajectories") {
    EmptyState(
        icon: "doc.text.magnifyingglass",
        title: "No Trajectories",
        subtitle: "Open a trajectory file or folder to begin exploring agent steps and tool calls."
    )
}

#Preview("No Results") {
    EmptyState(
        icon: "magnifyingglass",
        title: "No Results",
        subtitle: "Try adjusting your search or filters to find what you're looking for."
    )
}
