# Spec: TrajectoryDetailView.swift

> Step: `plan` — complete SwiftUI file for the main detail pane of the Trail Viewer macOS app.
> Design direction: "The Beautiful Notebook" — light mode, book-like reading experience.

## Codebase Notes (for implementer)

- **Store**: `TrajectoryStore` uses `@Observable` (not ObservableObject). Inject with `@Environment(TrajectoryStore.self)`.
- **No `selectedTrajectoryId`**: The store tracks selection via `selectedTrajectory`. The sidebar calls `store.selectTrajectory(id:)` which sets `selectedTrajectory` and `isLoadingDetail`.
- **Error property**: `store.error: APIError?` (not `detailError`).
- **Method**: `store.selectTrajectory(id:)` (not `loadTrajectoryDetail`).
- **All sub-views exist**: TrajectoryHeaderView, ChapterNavigation, ChapterView, RetrospectiveView, FileChangesView, DetailSkeleton, EmptyState.
- **Theme/Typography**: Available from Design/ folder. Key tokens: `Theme.pageBg`, `Theme.spacingXXL` (56pt), `Theme.error`, `Theme.errorBg`.
- **LayoutConstants**: `LayoutConstants.contentMaxWidth` = 720, `LayoutConstants.contentPadding` = 32.

## Complete File

```swift
import SwiftUI

// MARK: - TrajectoryDetailView

struct TrajectoryDetailView: View {
    @Environment(TrajectoryStore.self) private var store
    @State private var selectedChapterId: String? = nil

    var body: some View {
        Group {
            if store.selectedTrajectory == nil && !store.isLoadingDetail && store.error == nil {
                emptyState
            } else if store.isLoadingDetail {
                DetailSkeleton()
            } else if let error = store.error, store.selectedTrajectory == nil {
                errorState(error)
            } else if let trajectory = store.selectedTrajectory {
                detailContent(trajectory)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.pageBg)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        EmptyState(
            icon: "book.closed.fill",
            title: "Select a trajectory",
            subtitle: "Choose a trajectory from the sidebar to view its story"
        )
    }

    // MARK: - Error State

    private func errorState(_ error: APIError) -> some View {
        VStack(spacing: Theme.spacingLG) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 40))
                .foregroundColor(Theme.error)

            Text("Failed to load trajectory")
                .sectionTitle()

            Text(error.localizedDescription)
                .bodyStyle()
                .multilineTextAlignment(.center)
                .frame(maxWidth: 360)

            Button(action: {
                if let trajectory = store.selectedTrajectory {
                    Task {
                        await store.selectTrajectory(id: trajectory.id)
                    }
                }
            }) {
                Label("Retry", systemImage: "arrow.clockwise")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, Theme.spacingMD)
                    .padding(.vertical, Theme.spacingSM)
                    .background(Theme.blue, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Theme.spacingXL)
    }

    // MARK: - Detail Content

    private func detailContent(_ trajectory: Trajectory) -> some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: 0) {
                    TrajectoryHeaderView(trajectory: trajectory)
                        .id("header")

                    if !trajectory.chapters.isEmpty {
                        ChapterNavigation(
                            chapters: trajectory.chapters,
                            selectedChapterId: $selectedChapterId,
                            onChapterTap: { id in
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    proxy.scrollTo(id, anchor: .top)
                                }
                            }
                        )

                        ForEach(trajectory.chapters) { chapter in
                            ChapterView(chapter: chapter)
                                .id(chapter.id)
                        }
                    }

                    if let retrospective = trajectory.retrospective {
                        RetrospectiveView(retrospective: retrospective)
                    }

                    if !trajectory.filesChanged.isEmpty || !trajectory.commits.isEmpty {
                        FileChangesView(
                            files: trajectory.filesChanged,
                            commits: trajectory.commits
                        )
                    }
                }
                .padding(.horizontal, LayoutConstants.contentPadding)
                .frame(maxWidth: LayoutConstants.contentMaxWidth)
                .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - Preview

struct TrajectoryDetailView_Previews: PreviewProvider {
    static var previews: some View {
        TrajectoryDetailView()
            .environment(TrajectoryStore())
            .frame(width: 800, height: 600)
    }
}
```

## Design Rationale

1. **Book metaphor**: Content is constrained to 720pt max width, centered — like a printed page. Generous horizontal padding (32pt) creates comfortable margins.
2. **Light mode**: `Theme.pageBg` (#faf8f5) warm paper tone throughout.
3. **Vertical flow**: Header → chapter nav (sticky-like pill bar) → chapters → retrospective → file changes. Natural top-to-bottom reading.
4. **Scroll targeting**: `ScrollViewReader` + `.id(chapter.id)` enables chapter nav pills to jump to sections.
5. **State handling**: Four states (empty, loading, error, loaded) with clean transitions.
6. **Matches actual store API**: Uses `@Environment(TrajectoryStore.self)` and real property/method names from the codebase.
