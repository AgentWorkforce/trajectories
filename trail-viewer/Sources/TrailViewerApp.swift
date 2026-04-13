import SwiftUI

@main
struct TrailViewerApp: App {
    // MARK: - Stores (owned at app level)

    @State private var trajectoryStore: TrajectoryStore
    @State private var chatStore: ChatStore
    @State private var appStateStore = AppStateStore()
    @State private var cliSettingsStore = CLISettingsStore()

    // MARK: - Services

    @State private var serverManager = LocalServerManager()
    @State private var apiClient: APIClient
    @State private var relayConnection: RelayConnection

    init() {
        let api = APIClient()
        let relay = RelayConnection()
        _apiClient = State(initialValue: api)
        _relayConnection = State(initialValue: relay)
        _trajectoryStore = State(initialValue: TrajectoryStore(apiClient: api))
        _chatStore = State(initialValue: ChatStore(apiClient: api, relayConnection: relay))
    }

    var body: some Scene {
        WindowGroup("Trail Viewer") {
            ContentView(serverManager: serverManager)
                .environmentObject(trajectoryStore)
                .environmentObject(chatStore)
                .environmentObject(appStateStore)
                .environmentObject(cliSettingsStore)
                .environment(trajectoryStore)
                .overlay(alignment: .topTrailing) {
                    ToastContainer()
                        .padding(Theme.spacingMD)
                }
                .task {
                    await onAppear()
                }
                .onChange(of: appStateStore.currentPath) { _, newPath in
                    guard let newPath else { return }
                    // Clear current selection
                    trajectoryStore.clearSelection()
                    Task {
                        // Tell the server to switch data directories
                        try? await apiClient.switchDataDir(path: newPath)
                        // Reload data from the new directory
                        await trajectoryStore.loadTrajectories()
                        await trajectoryStore.refreshStats()
                    }
                }
        }
        .defaultSize(
            width: LayoutConstants.defaultWindowWidth,
            height: LayoutConstants.defaultWindowHeight
        )
        .windowResizability(.contentMinSize)
        .commands {
            appMenuCommands
        }
    }

    // MARK: - Startup

    @MainActor
    private func onAppear() async {
        serverManager.start(trajectoryPath: appStateStore.currentPath)

        await cliSettingsStore.refreshDetectedCLIs()

        try? await Task.sleep(for: .milliseconds(800))
        await trajectoryStore.loadTrajectories()
        await trajectoryStore.refreshStats()

        await chatStore.loadPersonas()
    }

    // MARK: - Menu Bar Commands

    @CommandsBuilder
    private var appMenuCommands: some Commands {
        CommandGroup(after: .newItem) {
            Button("Open Trajectory Folder…") {
                if let path = appStateStore.openPath() {
                    appStateStore.addRecentPath(path)
                    serverManager.restart(trajectoryPath: path)
                    Task {
                        try? await Task.sleep(for: .milliseconds(800))
                        await trajectoryStore.loadTrajectories()
                    }
                }
            }
            .keyboardShortcut("o", modifiers: .command)

            Divider()
        }

        CommandGroup(after: .toolbar) {
            Button("Toggle Sidebar") {
                NotificationCenter.default.post(name: .toggleSidebar, object: nil)
            }
            .keyboardShortcut("s", modifiers: [.command, .control])

            Button("Toggle Chat Panel") {
                NotificationCenter.default.post(name: .toggleChatPanel, object: nil)
            }
            .keyboardShortcut("c", modifiers: [.command, .shift])

            Divider()

            Button("Command Palette") {
                NotificationCenter.default.post(name: .showCommandPalette, object: nil)
            }
            .keyboardShortcut("k", modifiers: .command)

            Divider()

            Button("Refresh") {
                NotificationCenter.default.post(name: .refreshTrajectories, object: nil)
            }
            .keyboardShortcut("r", modifiers: .command)
        }

        CommandGroup(replacing: .appSettings) {
            Button("Settings…") {
                NotificationCenter.default.post(name: .showSettings, object: nil)
            }
            .keyboardShortcut(",", modifiers: .command)
        }

        CommandMenu("AI Assistant") {
            let detected = cliSettingsStore.availability
            ForEach(detected) { cli in
                Button {
                    cliSettingsStore.setPreferredCLI(cli.name)
                    ToastManager.shared.show(
                        message: "AI assistant set to \(cli.name)",
                        style: .success
                    )
                } label: {
                    HStack {
                        Text(cli.name.capitalized)
                        if cli.name == cliSettingsStore.effectiveCLI {
                            Spacer()
                            Image(systemName: "checkmark")
                        }
                    }
                }
                .disabled(!cli.isSupportedForChat)
            }

            Divider()

            Button("Refresh CLIs") {
                Task { await cliSettingsStore.refreshDetectedCLIs() }
            }
        }
    }
}

// MARK: - EnvironmentObject Conformance Bridge

extension TrajectoryStore: ObservableObject {}
extension ChatStore: ObservableObject {}
extension AppStateStore: ObservableObject {}
extension CLISettingsStore: ObservableObject {}
