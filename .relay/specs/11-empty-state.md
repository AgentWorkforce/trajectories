# EmptyState.swift — Full File Contents

Write to: `trail-viewer/Sources/Components/EmptyState.swift`

```swift
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
```

## Design Notes

- **Icon**: SF Symbol rendered at 48pt, using `Theme.blue` at 0.4 opacity for a soft, muted appearance
- **Title**: Uses `.sectionTitle()` modifier (18pt semibold serif, `Theme.textPrimary`)
- **Subtitle**: Uses `.bodyStyle()` modifier (13.5pt, `Theme.textSecondary`), center-aligned, capped at 320pt width for comfortable reading
- **Layout**: VStack with `Theme.spacingLG` (24pt) between elements, fills all available space, padded with `Theme.spacingXL` (36pt)
- **"Beautiful Notebook" feel**: Warm palette from Theme, serif typography, generous whitespace, understated icon opacity
