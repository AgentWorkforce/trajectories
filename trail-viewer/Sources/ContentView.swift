import SwiftUI

struct ContentView: View {
    @EnvironmentObject var trajectoryStore: TrajectoryStore
    @EnvironmentObject var chatStore: ChatStore
    @EnvironmentObject var appStateStore: AppStateStore
    @EnvironmentObject var cliSettingsStore: CLISettingsStore

    /// Server manager — owned by the App, passed as environment object.
    var serverManager: LocalServerManager

    // MARK: - Local State

    @State private var showCommandPalette: Bool = false
    @State private var showSettings: Bool = false
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        ZStack {
            NavigationSplitView(columnVisibility: $columnVisibility) {
                // --- Sidebar column ---
                TrajectoryListView()
                    .navigationSplitViewColumnWidth(
                        min: LayoutConstants.sidebarMinWidth,
                        ideal: LayoutConstants.sidebarWidth,
                        max: LayoutConstants.sidebarMaxWidth
                    )
            } content: {
                // --- Content / Detail column ---
                if trajectoryStore.selectedTrajectory != nil {
                    TrajectoryDetailView()
                } else {
                    WelcomeView()
                }
            } detail: {
                // Third column intentionally empty — chat is overlay/trailing panel
                Color.clear
            }
            .navigationSplitViewStyle(.balanced)

            // --- Chat panel (conditional trailing overlay) ---
            if appStateStore.showChatPanel {
                HStack(spacing: 0) {
                    Spacer()
                    ChatPanelView()
                        .frame(
                            minWidth: LayoutConstants.chatPanelMinWidth,
                            idealWidth: LayoutConstants.chatPanelWidth,
                            maxWidth: LayoutConstants.chatPanelMaxWidth
                        )
                        .background(Theme.cardBg)
                        .overlay(alignment: .leading) {
                            Rectangle()
                                .fill(Theme.border)
                                .frame(width: 0.5)
                        }
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
        }
        // --- Status bar at bottom ---
        .safeAreaInset(edge: .bottom, spacing: 0) {
            StatusBar(serverState: serverManager.state)
        }
        // --- Command palette overlay ---
        .overlay {
            if showCommandPalette {
                CommandPalette(isPresented: $showCommandPalette)
            }
        }
        // --- Settings sheet ---
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
        // --- Keyboard shortcuts modifier ---
        .keyboardShortcuts(
            showCommandPalette: $showCommandPalette,
            showChatPanel: Binding(
                get: { appStateStore.showChatPanel },
                set: { appStateStore.showChatPanel = $0 }
            ),
            showSettings: $showSettings,
            sidebarVisible: Binding(
                get: { appStateStore.sidebarVisible },
                set: { appStateStore.sidebarVisible = $0 }
            ),
            onRefresh: {
                Task {
                    await trajectoryStore.loadTrajectories()
                }
            }
        )
        // --- Toolbar ---
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    withAnimation(Animations.spring) {
                        appStateStore.toggleChatPanel()
                    }
                } label: {
                    Image(systemName: appStateStore.showChatPanel
                        ? "bubble.left.and.bubble.right.fill"
                        : "bubble.left.and.bubble.right")
                }
                .help("Toggle Chat Panel (⌘⇧C)")

                Button {
                    Task { await trajectoryStore.loadTrajectories() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("Refresh (⌘R)")

                Button {
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .help("Settings (⌘,)")
            }
        }
        .frame(
            minWidth: LayoutConstants.minWindowWidth,
            minHeight: LayoutConstants.minWindowHeight
        )
        .background(Theme.pageBg)
        .preferredColorScheme(.light)
    }
}
