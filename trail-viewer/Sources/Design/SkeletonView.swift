import SwiftUI

// MARK: - SkeletonLine

struct SkeletonLine: View {
    var width: CGFloat? = nil
    var height: CGFloat = 12

    var body: some View {
        RoundedRectangle(cornerRadius: Theme.radiusSM)
            .fill(Theme.border.opacity(0.3))
            .frame(
                maxWidth: width ?? .infinity,
                minHeight: height,
                maxHeight: height
            )
            .shimmer()
    }
}

// MARK: - SkeletonCard

struct SkeletonCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            SkeletonLine(width: 180, height: 16)
            SkeletonLine(height: 12)
            SkeletonLine(width: 240, height: 12)

            HStack(spacing: Theme.spacingSM) {
                SkeletonLine(width: 60, height: 10)
                SkeletonLine(width: 60, height: 10)
                SkeletonLine(width: 60, height: 10)
            }
        }
        .padding(Theme.spacingBase)
        .background(Theme.cardBg)
        .cornerRadius(Theme.radiusMD)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderLight, lineWidth: 0.5)
        )
    }
}

// MARK: - SkeletonRow

struct SkeletonRow: View {
    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            Circle()
                .fill(Theme.border.opacity(0.3))
                .frame(width: 28, height: 28)
                .shimmer()

            VStack(alignment: .leading, spacing: 6) {
                SkeletonLine(width: 160, height: 14)
                SkeletonLine(width: 100, height: 10)
            }
        }
        .padding(.vertical, Theme.spacingSM)
        .padding(.horizontal, Theme.spacingBase)
    }
}
