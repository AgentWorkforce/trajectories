import SwiftUI

// MARK: - View Modifiers

struct ChapterTitleStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 26, weight: .bold, design: .serif))
            .foregroundColor(Theme.textPrimary)
    }
}

struct SectionTitleStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 18, weight: .semibold, design: .serif))
            .foregroundColor(Theme.textPrimary)
    }
}

struct HeadingStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 15, weight: .semibold))
            .foregroundColor(Theme.textPrimary)
    }
}

struct BodyStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 13.5))
            .foregroundColor(Theme.textSecondary)
            .lineSpacing(13.5 * 0.6)
    }
}

struct BodySmallStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 12))
            .foregroundColor(Theme.textSecondary)
    }
}

struct CaptionStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(Theme.textTertiary)
    }
}

struct CodeStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 12, design: .monospaced))
            .foregroundColor(Theme.textPrimary)
    }
}

struct TrailLabelStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(Theme.textTertiary)
            .textCase(.uppercase)
            .tracking(0.5)
    }
}

// MARK: - View Extension

extension View {
    func chapterTitle() -> some View {
        modifier(ChapterTitleStyle())
    }

    func sectionTitle() -> some View {
        modifier(SectionTitleStyle())
    }

    func heading() -> some View {
        modifier(HeadingStyle())
    }

    func bodyStyle() -> some View {
        modifier(BodyStyle())
    }

    func bodySmall() -> some View {
        modifier(BodySmallStyle())
    }

    func caption() -> some View {
        modifier(CaptionStyle())
    }

    func codeStyle() -> some View {
        modifier(CodeStyle())
    }

    func trailLabel() -> some View {
        modifier(TrailLabelStyle())
    }
}
