# ChapterNavigation.swift — Complete SwiftUI File

```swift
import SwiftUI

// MARK: - Chapter Model (if not defined elsewhere)

struct Chapter: Identifiable {
    let id: String
    let number: Int
    let title: String
}

// MARK: - ChapterNavigation

struct ChapterNavigation: View {
    let chapters:  hapter]
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

// MARK: - Preview

struct ChapterNavigation_Previews: PreviewProvider {
    @State static var selectedId: String? = "ch-2"

    static let mockChapters:  hapter] = [
        Chapter(id: "ch-1", number: 1, title: "Introduction"),
        Chapter(id: "ch-2", number: 2, title: "Planning"),
        Chapter(id: "ch-3", number: 3, title: "Implementation"),
        Chapter(id: "ch-4", number: 4, title: "Testing & QA"),
        Chapter(id: "ch-5", number: 5, title: "Deployment"),
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
```

## Design Notes

- **Light mode / "Beautiful Notebook"**: Capsule pills on `Theme.pageBg`, selected state uses `Theme.blue` with white text for clear affordance.
- **Compact**: 40pt total height including 6pt vertical padding on pills — sits neatly below the header.
- **Bottom border**: 1pt `Theme.rule` rectangle acts as a clean divider, matching the book-like ruled aesthetic.
- **Horizontal padding**: 32pt (`spacingXXL`) aligns content with the header region.
- **Animation**: `easeInOut(0.2)` on pill background/text color change for smooth selection transitions.
- **Assumes**: `Theme`, `Typography`, and color tokens are defined elsewhere in the project.
