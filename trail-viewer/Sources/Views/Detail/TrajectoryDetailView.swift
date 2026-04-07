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

                    if !(trajectory.filesChanged ?? []).isEmpty || !(trajectory.commits ?? []).isEmpty {
                        FileChangesView(
                            files: trajectory.filesChanged ?? [],
                            commits: trajectory.commits ?? []
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
