import SwiftUI

struct SidebarHeader: View {
    let trajectoryCount: Int
    let activeCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            Text("Trail Viewer")
                .font(.system(size: 22, weight: .semibold, design: .serif))
                .foregroundColor(Theme.textPrimary)

            RuleLine()

            if trajectoryCount > 0 {
                Text("\(trajectoryCount) trajectories · \(activeCount) active")
                    .font(.system(size: 12, weight: .regular, design: .serif))
                    .foregroundColor(Theme.textTertiary)
            }
        }
        .padding(.horizontal, Theme.spacingLG)
        .padding(.vertical, Theme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.sidebarBg)
    }
}

#Preview {
    SidebarHeader(trajectoryCount: 42, activeCount: 7)
        .frame(width: 280)
}
