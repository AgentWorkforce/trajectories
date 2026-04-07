import SwiftUI

struct ConfidenceMeter: View {
    let value: Double
    var label: String? = nil
    var isCompact: Bool = false

    private var clampedValue: Double {
        min(max(value, 0.0), 1.0)
    }

    private var percentageText: String {
        "\(Int(clampedValue * 100))"
    }

    var body: some View {
        if isCompact {
            compactLayout
        } else {
            expandedLayout
        }
    }

    // MARK: - Expanded Layout

    private var expandedLayout: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            if let label {
                Text(label)
                    .caption()
                    .foregroundStyle(Theme.textTertiary)
            }

            HStack(alignment: .firstTextBaseline, spacing: Theme.spacingXS) {
                Text(percentageText)
                    .chapterTitle()
                    .foregroundStyle(Theme.textPrimary)

                Text("% confident")
                    .bodyStyle()
                    .foregroundStyle(Theme.textSecondary)
            }

            confidenceBar(height: 8)
        }
    }

    // MARK: - Compact Layout

    private var compactLayout: some View {
        HStack(spacing: Theme.spacingSM) {
            Text("\(percentageText)%")
                .caption()
                .foregroundStyle(Theme.textPrimary)

            confidenceBar(height: 4)
                .frame(maxWidth: 80)

            if let label {
                Text(label)
                    .caption()
                    .foregroundStyle(Theme.textTertiary)
            }
        }
    }

    // MARK: - Bar

    private func confidenceBar(height: CGFloat) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Theme.borderLight)
                    .frame(height: height)

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [Theme.yellowLight, Theme.blue],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(
                        width: geometry.size.width * clampedValue,
                        height: height
                    )
                    .animation(.spring(response: 0.6), value: clampedValue)
            }
        }
        .frame(height: height)
    }
}

// MARK: - Preview

#Preview("Expanded") {
    VStack(alignment: .leading, spacing: 24) {
        ConfidenceMeter(value: 0.30, label: "Low Confidence")
        ConfidenceMeter(value: 0.65, label: "Medium Confidence")
        ConfidenceMeter(value: 0.92, label: "Overall Confidence")
        ConfidenceMeter(value: 0.65)
    }
    .padding(32)
    .frame(width: 360)
    .background(Theme.pageBg)
}

#Preview("Compact") {
    VStack(alignment: .leading, spacing: 12) {
        ConfidenceMeter(value: 0.30, label: "Low", isCompact: true)
        ConfidenceMeter(value: 0.65, label: "Med", isCompact: true)
        ConfidenceMeter(value: 0.92, isCompact: true)
    }
    .padding(32)
    .background(Theme.pageBg)
}
