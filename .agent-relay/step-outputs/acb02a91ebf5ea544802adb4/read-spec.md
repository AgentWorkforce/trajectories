# TrajectoryListView.swift — Complete File

```swift
import SwiftUI

struct TrajectoryListView: View {
    @EnvironmentObject var store: TrajectoryStore

    var body: some View {
        VStack(spacing: 0) {
            SidebarHeader(
                totalCount: store.trajectories.count,
                activeCount: store.trajectories.filter { $0.status == .active }.count
            )

            FilterBar(
                searchText: $store.searchText,
                statusFilter: $store.statusFilter
            )

            // Main content area
            Group {
                if store.isLoading && store.trajectories.isEmpty {
                    SidebarSkeleton()
                } else if let error = store.error {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.caption)
                        Text(error)
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
                        message: "No trajectories found"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(store.filteredTrajectories) { item in
                                TrajectoryRow(
                                    trajectory: item,
                                    isSelected: item.id == store.selectedTrajectoryId
                                )
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    store.selectTrajectory(id: item.id)
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
        .onAppear {
            store.loadTrajectories()
        }
        .frame(minWidth: 280, idealWidth: 320, maxWidth: 380)
    }
}

#Preview {
    TrajectoryListView()
        .environmentObject(TrajectoryStore())
}
```
