import SwiftUI

// MARK: - CommandPaletteResults

struct CommandPaletteResults {
    let trajectories: [TrajectorySummary]
    let tags: [String]

    static let empty = CommandPaletteResults(trajectories: [], tags: [])
}

// MARK: - CommandPalette

struct CommandPalette: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var trajectoryStore: TrajectoryStore
    @State private var searchText: String = ""
    @State private var selectedIndex: Int = 0
    @FocusState private var isSearchFocused: Bool

    private var results: CommandPaletteResults {
        guard !searchText.isEmpty else { return .empty }
        let query = searchText.lowercased()
        let matchingTrajectories = trajectoryStore.trajectories.filter {
            $0.title.localizedCaseInsensitiveContains(query)
        }
        let matchingTags = trajectoryStore.allTags.filter {
            $0.localizedCaseInsensitiveContains(query)
        }
        return CommandPaletteResults(
            trajectories: Array(matchingTrajectories.prefix(5)),
            tags: Array(matchingTags.prefix(5))
        )
    }

    private var totalResultCount: Int {
        min(results.trajectories.count + results.tags.count, 8)
    }

    private var flatResults: [(kind: String, index: Int)] {
        var items: [(String, Int)] = []
        for i in results.trajectories.indices { items.append(("trajectory", i)) }
        for i in results.tags.indices { items.append(("tag", i)) }
        return Array(items.prefix(8))
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            VStack(spacing: 0) {
                HStack(spacing: Theme.spacingSM) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Theme.textTertiary)

                    TextField("Search trajectories, tags...", text: $searchText)
                        .font(Typography.heading)
                        .textFieldStyle(.plain)
                        .focused($isSearchFocused)
                }
                .padding(Theme.spacingMD)

                RuleLine()

                if !searchText.isEmpty {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            if !results.trajectories.isEmpty {
                                resultGroupHeader("Trajectories")

                                ForEach(Array(results.trajectories.enumerated()), id: \.offset) { offset, trajectory in
                                    resultRow(
                                        icon: "doc.text",
                                        text: trajectory.title,
                                        isSelected: selectedIndex == offset
                                    )
                                    .onTapGesture {
                                        Task {
                                            await trajectoryStore.selectTrajectory(id: trajectory.id)
                                        }
                                        isPresented = false
                                    }
                                }
                            }

                            if !results.tags.isEmpty {
                                let tagOffset = results.trajectories.count

                                resultGroupHeader("Tags")

                                ForEach(Array(results.tags.enumerated()), id: \.offset) { offset, tag in
                                    resultRow(
                                        icon: "tag",
                                        text: tag,
                                        isSelected: selectedIndex == tagOffset + offset
                                    )
                                    .onTapGesture {
                                        trajectoryStore.selectedTags.insert(tag)
                                        isPresented = false
                                    }
                                }
                            }
                        }
                        .padding(.vertical, Theme.spacingXS)
                    }
                    .frame(maxHeight: 280)
                }

                RuleLine()

                HStack(spacing: Theme.spacingXS) {
                    Text("\u{2191}\u{2193} Navigate")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)

                    Text("\u{00B7}")
                        .foregroundColor(Theme.textTertiary)

                    Text("\u{21B5} Open")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)

                    Text("\u{00B7}")
                        .foregroundColor(Theme.textTertiary)

                    Text("\u{238B} Close")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)
                }
                .padding(Theme.spacingSM)
            }
            .frame(width: 500)
            .frame(maxHeight: 400)
            .background(Theme.pageBg)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.15), radius: 20, y: 8)
            .scaleEffect(isPresented ? 1 : 0.95)
            .opacity(isPresented ? 1 : 0)
            .animation(.easeOut(duration: 0.15), value: isPresented)
        }
        .onAppear {
            isSearchFocused = true
        }
        .onKeyPress(.escape) {
            isPresented = false
            return .handled
        }
    }

    // MARK: - Subviews

    private func resultGroupHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(Typography.caption)
            .foregroundColor(Theme.textTertiary)
            .padding(.horizontal, Theme.spacingMD)
            .padding(.top, Theme.spacingSM)
            .padding(.bottom, Theme.spacingXS)
    }

    private func resultRow(icon: String, text: String, isSelected: Bool) -> some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: icon)
                .foregroundColor(Theme.textTertiary)
                .frame(width: 16)

            Text(text)
                .font(Typography.body)
                .foregroundColor(Theme.textPrimary)

            Spacer()
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingSM)
        .background(
            isSelected
                ? Theme.blue.opacity(0.1)
                : Color.clear
        )
        .contentShape(Rectangle())
    }
}

// MARK: - Preview

struct CommandPalette_Previews: PreviewProvider {
    static var previews: some View {
        CommandPalette(isPresented: .constant(true))
            .environmentObject(TrajectoryStore())
            .frame(width: 800, height: 600)
    }
}
