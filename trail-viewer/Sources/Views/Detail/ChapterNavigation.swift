import SwiftUI

// MARK: - ChapterNavigation

struct ChapterNavigation: View {
    let chapters: [Chapter]
    @Binding var selectedChapterId: String?
    var onChapterTap: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(chapters) { chapter in
                        ChapterPill(
                            chapter: chapter,
                            isSelected: selectedChapterId == chapter.id
                        )
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedChapterId = chapter.id
                            }
                            onChapterTap(chapter.id)
                        }
                    }
                }
                .padding(.horizontal, 32)
                .padding(.vertical, 6)
            }
            .frame(height: 40)

            // Bottom rule line / divider
            Rectangle()
                .fill(Theme.rule)
                .frame(height: 1)
        }
        .background(Theme.pageBg)
    }
}

// MARK: - ChapterPill

private struct ChapterPill: View {
    let chapter: Chapter
    let isSelected: Bool

    var body: some View {
        Text("Chapter \(chapter.number): \(chapter.title)")
            .font(Typography.caption)
            .foregroundColor(isSelected ? .white : Theme.textSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(isSelected ? Theme.blue : Theme.cardBg)
            )
            .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

// MARK: - Local Token Fallbacks

private extension Theme {
    static var rule: Color { borderLight }
}

private enum Typography {
    static let caption = Font.system(size: 11, weight: .medium)
}

// MARK: - Preview

struct ChapterNavigation_Previews: PreviewProvider {
    @State static var selectedId: String? = "ch-2"

    static let mockChapters: [Chapter] = [
        Chapter(
            id: "ch-1",
            title: "Introduction",
            number: 1,
            agent: nil,
            startedAt: .now,
            completedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-2",
            title: "Planning",
            number: 2,
            agent: nil,
            startedAt: .now,
            completedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-3",
            title: "Implementation",
            number: 3,
            agent: nil,
            startedAt: .now,
            completedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-4",
            title: "Testing & QA",
            number: 4,
            agent: nil,
            startedAt: .now,
            completedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-5",
            title: "Deployment",
            number: 5,
            agent: nil,
            startedAt: .now,
            completedAt: nil,
            events: [],
            summary: nil
        ),
    ]

    static var previews: some View {
        VStack {
            ChapterNavigation(
                chapters: mockChapters,
                selectedChapterId: $selectedId,
                onChapterTap: { id in
                    print("Tapped chapter: \(id)")
                }
            )
            Spacer()
        }
        .frame(width: 800, height: 200)
        .background(Theme.pageBg)
    }
}
