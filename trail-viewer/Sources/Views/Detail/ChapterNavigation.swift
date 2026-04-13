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
        Text(chapter.title)
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

// Typography is now defined globally in Design/Typography.swift

// MARK: - Preview

struct ChapterNavigation_Previews: PreviewProvider {
    @State static var selectedId: String? = "ch-2"

    static let mockChapters: [Chapter] = [
        Chapter(
            id: "ch-1",
            title: "Introduction",
            agentName: nil,
            startedAt: .now,
            endedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-2",
            title: "Planning",
            agentName: nil,
            startedAt: .now,
            endedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-3",
            title: "Implementation",
            agentName: nil,
            startedAt: .now,
            endedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-4",
            title: "Testing & QA",
            agentName: nil,
            startedAt: .now,
            endedAt: nil,
            events: [],
            summary: nil
        ),
        Chapter(
            id: "ch-5",
            title: "Deployment",
            agentName: nil,
            startedAt: .now,
            endedAt: nil,
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
