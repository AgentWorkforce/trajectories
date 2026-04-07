# SidebarHeader.swift — Complete File Spec

Write this file to: `TrailViewer/Views/Sidebar/SidebarHeader.swift`

```swift
import SwiftUI

struct SidebarHeader: View {
    let trajectoryCount: Int
    let activeCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Chapter title
            Text("Trail Viewer")
                .font(.system(size: 22, weight: .semibold, design: .serif))
                .foregroundColor(Theme.textPrimary)

            // Thin rule line divider
            RuleLine()

            // Stats summary
            if trajectoryCount > 0 {
                Text("\(trajectoryCount) trajectories \u{00B7} \(activeCount) active")
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
```

## Design Notes

- **Typography**: Uses `.design(.serif)` for the notebook aesthetic, 22pt semibold for the title, 12pt regular for the caption.
- **RuleLine**: Assumes `RuleLine` is defined in `Design/RuleLine.swift` as a 1pt horizontal divider using `Theme.borderLight`.
- **Theme tokens used**: `textPrimary`, `textTertiary`, `sidebarBg` (#f0ece4), `spacingLG` (~20pt), `spacingMD` (~12pt), `spacingSM` (~8pt).
- **Light mode**: Designed for light-mode "Beautiful Notebook" aesthetic.
- The stats line uses a middle dot (`·`) separator.
- When `trajectoryCount` is 0, the stats line is hidden for a clean empty state.
