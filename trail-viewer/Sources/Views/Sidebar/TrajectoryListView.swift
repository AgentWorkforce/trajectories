import SwiftUI

struct TrajectoryListView: View {
    @EnvironmentObject var store: TrajectoryStore

    @State private var searchText: String = ""
    @State private var statusFilter: StatusFilter = .all

    var body: some View {
        VStack(spacing: 0) {
            SidebarHeader(
                trajectoryCount: store.trajectories.count,
                activeCount: store.trajectories.filter { $0.status == .active }.count
            )

            FilterBar(
                searchText: $searchText,
                statusFilter: $statusFilter
            )

            // Main content area
            Group {
                if store.isLoading && store.trajectories.isEmpty {
                    SidebarSkeleton()
                } else if let error = store.error {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.caption)
                        Text(error.localizedDescription)
                            .font(.caption)
                            .lineLimit(2)
                    }
                    .foregroundColor(.orange)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.orange.opacity(0.08))
                    .cornerRadius(8)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                } else if store.filteredTrajectories.isEmpty && !store.isLoading {
                    EmptyState(
                        icon: "book.closed",
                        title: "No trajectories",
                        subtitle: "No trajectories match the current filters."
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(store.filteredTrajectories) { item in
                                TrajectoryRow(
                                    trajectory: item,
                                    isSelected: item.id == store.selectedTrajectory?.id
                                )
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    Task {
                                        await store.selectTrajectory(id: item.id)
                                    }
                                }
                            }
                        }
                    }
                    .animation(.easeInOut(duration: 0.2), value: store.filteredTrajectories.map(\.id))
                }
            }
            .frame(maxHeight: .infinity)
        }
        .background(Theme.sidebarBg)
        .task {
            await store.loadTrajectories()
        }
        .onChange(of: searchText) { _, newValue in
            store.searchText = newValue
        }
        .onChange(of: statusFilter) { _, newValue in
            switch newValue {
            case .all: store.statusFilter = nil
            case .active: store.statusFilter = .active
            case .completed: store.statusFilter = .completed
            case .abandoned: store.statusFilter = .abandoned
            }
        }
        .frame(minWidth: 280, idealWidth: 320, maxWidth: 380)
    }
}

struct TrajectoryListView_Previews: PreviewProvider {
    static var previews: some View {
        TrajectoryListView()
            .environmentObject(TrajectoryStore())
    }
}
