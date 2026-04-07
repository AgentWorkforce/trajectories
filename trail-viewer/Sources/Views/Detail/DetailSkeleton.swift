import SwiftUI

// MARK: - DetailSkeleton

struct DetailSkeleton: View {
    @State private var shimmerPhase: CGFloat = -300

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                headerSection
                chapterBlock(titleWidth: 0.35, lineCount: 5)
                chapterBlock(titleWidth: 0.42, lineCount: 4)
                chapterBlock(titleWidth: 0.38, lineCount: 5)
                Spacer(minLength: Theme.spacingXXL)
            }
            .padding(.horizontal, Theme.spacingXXL)
            .padding(.vertical, Theme.spacingLG)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.pageBg)
        .overlay(shimmerOverlay)
        .clipped()
        .onAppear {
            shimmerPhase = 300
        }
        .animation(
            .linear(duration: 1.5).repeatForever(autoreverses: false),
            value: shimmerPhase
        )
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Title
            placeholderRect(widthFraction: 0.6, height: 20)

            // Description
            placeholderRect(widthFraction: 0.8, height: 14)
                .padding(.top, Theme.spacingXS)

            // Metadata row
            HStack(spacing: Theme.spacingSM) {
                placeholderRect(width: 50, height: 10)
                placeholderRect(width: 60, height: 10)
                placeholderRect(width: 100, height: 10)
            }
            .padding(.top, Theme.spacingSM)

            // Tag capsules
            HStack(spacing: Theme.spacingXS) {
                Capsule()
                    .fill(Theme.borderLight.opacity(0.2))
                    .frame(width: 54, height: 8)
                Capsule()
                    .fill(Theme.borderLight.opacity(0.2))
                    .frame(width: 68, height: 8)
                Capsule()
                    .fill(Theme.borderLight.opacity(0.2))
                    .frame(width: 50, height: 8)
            }
            .padding(.top, Theme.spacingSM)

            // Thick divider (matching TrajectoryHeaderView bottom rule)
            Rectangle()
                .fill(Theme.border)
                .frame(maxWidth: .infinity)
                .frame(height: 1)
                .padding(.top, Theme.spacingMD)
        }
        .padding(.bottom, Theme.spacingXXL)
    }

    // MARK: - Chapter Block

    private func chapterBlock(titleWidth: CGFloat, lineCount: Int) -> some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            // Chapter heading
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 4)
                    .fill(Theme.borderLight.opacity(0.2))
                    .frame(width: geo.size.width * titleWidth, height: 16)
            }
            .frame(height: 16)

            // Event lines with timeline dots
            ForEach(0..<lineCount, id: \.self) { index in
                eventLine(widthFraction: eventWidth(for: index))
            }
        }
        .padding(.bottom, Theme.spacingXXL)
    }

    // MARK: - Event Line (with timeline dot)

    private func eventLine(widthFraction: CGFloat) -> some View {
        HStack(alignment: .center, spacing: Theme.spacingSM) {
            // Timeline dot
            Circle()
                .fill(Theme.borderLight.opacity(0.2))
                .frame(width: 8, height: 8)

            // Content line
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 4)
                    .fill(Theme.borderLight.opacity(0.2))
                    .frame(width: geo.size.width * widthFraction, height: 12)
            }
            .frame(height: 12)
        }
        .padding(.vertical, 2)
    }

    // MARK: - Helpers

    private func placeholderRect(widthFraction: CGFloat, height: CGFloat) -> some View {
        GeometryReader { geo in
            RoundedRectangle(cornerRadius: 4)
                .fill(Theme.borderLight.opacity(0.2))
                .frame(width: geo.size.width * widthFraction, height: height)
        }
        .frame(height: height)
    }

    private func placeholderRect(width: CGFloat, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Theme.borderLight.opacity(0.2))
            .frame(width: width, height: height)
    }

    private func eventWidth(for index: Int) -> CGFloat {
        let widths: [CGFloat] = [0.85, 0.65, 0.90, 0.72, 0.60]
        return widths[index % widths.count]
    }

    // MARK: - Shimmer Overlay

    private var shimmerOverlay: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                .clear,
                Theme.borderLight.opacity(0.3),
                .clear
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
        .offset(x: shimmerPhase)
    }
}

// MARK: - Preview

struct DetailSkeleton_Previews: PreviewProvider {
    static var previews: some View {
        DetailSkeleton()
            .frame(width: 760, height: 700)
            .previewDisplayName("DetailSkeleton — Loading State")
    }
}
