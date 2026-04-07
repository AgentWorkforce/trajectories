import SwiftUI

struct CommandPalette: View {
    @Binding var isPresented: Bool
    @EnvironmentObject var trajectoryStore: TrajectoryStore
    @State private var searchText: String = ""
    @State private var selectedIndex: Int = 0
    @FocusState private var isSearchFocused: Bool

    private var results: CommandPaletteResults {
        trajectoryStore.searchResults(for: searchText)
    }

    private var totalResultCount: Int {
        min(results.trajectories.count + results.decisions.count + results.tags.count, 8)
    }

    private var flatResults: [(kind: String, index: Int)] {
        var items: [(String, Int)] = []
        for i in results.trajectories.indices { items.append(("trajectory", i)) }
        for i in results.decisions.indices { items.append(("decision", i)) }
        for i in results.tags.indices { items.append(("tag", i)) }
        return Array(items.prefix(8))
    }

    var body: some View {
        ZStack {
            // Backdrop
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            // Centered panel
            VStack(spacing: 0) {
                // 1. Search input
                HStack(spacing: Theme.spacingSM) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Theme.textTertiary)

                    TextField("Search trajectories, decisions, tags...", text: $searchText)
                        .font(Typography.heading)
                        .textFieldStyle(.plain)
                        .focused($isSearchFocused)
                }
                .padding(Theme.spacingMD)

                RuleLine()

                // 2. Results area
                if !searchText.isEmpty {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            let trajectories = results.trajectories
                            let decisions = results.decisions
                            let tags = results.tags

                            var currentIndex = 0

                            // Trajectories group
                            if !trajectories.isEmpty {
                                resultGroupHeader("Trajectories")

                                ForEach(Array(trajectories.enumerated()), id: \.offset) { offset, trajectory in
                                    let itemIndex = offset
                                    if itemIndex < 8 {
                                        resultRow(
                                            icon: "doc.text",
                                            text: trajectory.title,
                                            query: searchText,
                                            isSelected: selectedIndex == itemIndex
                                        )
                                        .onTapGesture {
                                            trajectoryStore.selectTrajectory(id: trajectory.id)
                                            isPresented = false
                                        }
                                    }
                                }
                            }

                            // Decisions group
                            if !decisions.isEmpty {
                                let decisionOffset = trajectories.count

                                resultGroupHeader("Decisions")

                                ForEach(Array(decisions.enumerated()), id: \.offset) { offset, decision in
                                    let itemIndex = decisionOffset + offset
                                    if itemIndex < 8 {
                                        resultRow(
                                            icon: "lightbulb",
                                            text: decision.title,
                                            query: searchText,
                                            isSelected: selectedIndex == itemIndex
                                        )
                                        .onTapGesture {
                                            // Handle decision selection
                                            isPresented = false
                                        }
                                    }
                                }
                            }

                            // Tags group
                            if !tags.isEmpty {
                                let tagOffset = trajectories.count + decisions.count

                                resultGroupHeader("Tags")

                                ForEach(Array(tags.enumerated()), id: \.offset) { offset, tag in
                                    let itemIndex = tagOffset + offset
                                    if itemIndex < 8 {
                                        resultRow(
                                            icon: "tag",
                                            text: tag,
                                            query: searchText,
                                            isSelected: selectedIndex == itemIndex
                                        )
                                        .onTapGesture {
                                            // Handle tag selection
                                            isPresented = false
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.vertical, Theme.spacingXS)
                    }
                    .frame(maxHeight: 280)
                }

                // 3. Footer
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
            .frame(width: 500, maxHeight: 400)
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
        .onChange(of: searchText) { _ in
            selectedIndex = 0
        }
        .onKeyPress(.downArrow) {
            if totalResultCount > 0 {
                selectedIndex = (selectedIndex + 1) % totalResultCount
            }
            return .handled
        }
        .onKeyPress(.upArrow) {
            if totalResultCount > 0 {
                selectedIndex = (selectedIndex - 1 + totalResultCount) % totalResultCount
            }
            return .handled
        }
        .onKeyPress(.return) {
            selectCurrentItem()
            return .handled
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

    private func resultRow(icon: String, text: String, query: String, isSelected: Bool) -> some View {
        HStack(spacing: Theme.spacingSM) {
            Image(systemName: icon)
                .foregroundColor(Theme.textTertiary)
                .frame(width: 16)

            highlightedText(text, query: query)

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

    // MARK: - Helpers

    private func highlightedText(_ text: String, query: String) -> Text {
        guard !query.isEmpty else {
            return Text(text)
                .font(Typography.body)
                .foregroundColor(Theme.textPrimary)
        }

        let lowercasedText = text.lowercased()
        let lowercasedQuery = query.lowercased()

        guard let range = lowercasedText.range(of: lowercasedQuery) else {
            return Text(text)
                .font(Typography.body)
                .foregroundColor(Theme.textPrimary)
        }

        let before = String(text[text.startIndex..<range.lowerBound])
        let match = String(text[range.lowerBound..<range.upperBound])
        let after = String(text[range.upperBound..<text.endIndex])

        return Text(before)
            .font(Typography.body)
            .foregroundColor(Theme.textPrimary)
        + Text(match)
            .font(Typography.body)
            .foregroundColor(Theme.textPrimary)
            .background(Theme.yellow)
        + Text(after)
            .font(Typography.body)
            .foregroundColor(Theme.textPrimary)
    }

    private func selectCurrentItem() {
        let items = flatResults
        guard selectedIndex < items.count else { return }

        let item = items[selectedIndex]
        switch item.kind {
        case "trajectory":
            let trajectory = results.trajectories[item.index]
            trajectoryStore.selectTrajectory(id: trajectory.id)
        case "decision":
            // Handle decision selection
            break
        case "tag":
            // Handle tag selection
            break
        default:
            break
        }

        isPresented = false
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
