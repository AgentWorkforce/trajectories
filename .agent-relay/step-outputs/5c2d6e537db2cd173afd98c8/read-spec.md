# Integration Spec — 4 Files

## Dependency Order
1. **StatusBar.swift** + **KeyboardShortcuts.swift** (parallel — no cross-deps)
2. **ContentView.swift** (uses StatusBar + KeyboardShortcuts)
3. **TrailViewerApp.swift** (uses ContentView + all stores)

---

## FILE 1: `trail-viewer/Sources/Views/StatusBar.swift`

```swift
import SwiftUI

struct StatusBar: View {
    @EnvironmentObject var trajectoryStore: TrajectoryStore
    @EnvironmentObject var appStateStore: AppStateStore

    /// Connection state from the relay (passed in or environment).
    var serverState: ServerState = .stopped

    var body: some View {
        HStack {
            // Left: connection dot + status text
            HStack(spacing: Theme.spacingXS) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 6, height: 6)

                Text(statusText)
                    .font(.system(size: 11))
                    .foregroundColor(Theme.textTertiary)
            }

            Spacer()

            // Center: trajectory count
            Text(countLabel)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Theme.textSecondary)

            Spacer()

            // Right: shortcut hints
            Text("⌘K Search  ·  ⌘⇧C Chat")
                .font(.system(size: 11))
                .foregroundColor(Theme.textTertiary)
        }
        .padding(.horizontal, Theme.spacingBase)
        .frame(height: LayoutConstants.statusBarHeight)
        .background(Theme.sidebarBg)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.border)
                .frame(height: 0.5)
        }
    }

    // MARK: - Helpers

    private var dotColor: Color {
        switch serverState {
        case .running:  return Theme.statusActive
        case .starting: return Theme.yellow
        case .error:    return Theme.error
        case .stopped:  return Theme.textTertiary
        }
    }

    private var statusText: String {
        switch serverState {
        case .running:  return "Connected"
        case .starting: return "Connecting…"
        case .error:    return "Error"
        case .stopped:  return "Offline"
        }
    }

    private var countLabel: String {
        let total = trajectoryStore.stats.total
        let filtered = trajectoryStore.filteredTrajectories.count
        if filtered == total {
            return "\(total) trajectories"
        }
        return "\(filtered) of \(total) trajectories"
    }
}
```

**Key notes:**
- Uses `Theme.sidebarBg` background, thin top border via overlay.
- Height 28pt from `LayoutConstants.statusBarHeight`.
- `serverState` passed as a plain property from ContentView (which owns the `LocalServerManager`).
- Stores injected via `@EnvironmentObject` matching existing view conventions.

---

## FILE 2: `trail-viewer/Sources/Views/KeyboardShortcuts.swift`

```swift
import SwiftUI

// MARK: - Notification Names

extension Notification.Name {
    static let toggleChatPanel      = Notification.Name("toggleChatPanel")
    static let showCommandPalette   = Notification.Name("showCommandPalette")
    static let toggleSidebar        = Notification.Name("toggleSidebar")
    static let refreshTrajectories  = Notification.Name("refreshTrajectories")
    static let showSettings         = Notification.Name("showSettings")
}

// MARK: - Keyboard Shortcut Modifier

/// ViewModifier that listens for keyboard-shortcut notifications and updates
/// the relevant presentation state.
struct KeyboardShortcutModifier: ViewModifier {
    @Binding var showCommandPalette: Bool
    @Binding var showChatPanel: Bool
    @Binding var showSettings: Bool
    @Binding var sidebarVisible: Bool

    /// Called when a refresh is requested.
    var onRefresh: (() -> Void)?

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: .showCommandPalette)) { _ in
                showCommandPalette = true
            }
            .onReceive(NotificationCenter.default.publisher(for: .toggleChatPanel)) { _ in
                withAnimation(Animations.spring) {
                    showChatPanel.toggle()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .toggleSidebar)) { _ in
                withAnimation(Animations.spring) {
                    sidebarVisible.toggle()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .refreshTrajectories)) { _ in
                onRefresh?()
            }
            .onReceive(NotificationCenter.default.publisher(for: .showSettings)) { _ in
                showSettings = true
            }
    }
}

extension View {
    func keyboardShortcuts(
        showCommandPalette: Binding<Bool>,
        showChatPanel: Binding<Bool>,
        showSettings: Binding<Bool>,
        sidebarVisible: Binding<Bool>,
        onRefresh: (() -> Void)? = nil
    ) -> some View {
        modifier(KeyboardShortcutModifier(
            showCommandPalette: showCommandPalette,
            showChatPanel: showChatPanel,
            showSettings: showSettings,
            sidebarVisible: sidebarVisible,
            onRefresh: onRefresh
        ))
    }
}
```

**Key notes:**
- Five `Notification.Name` constants. The menu bar (in TrailViewerApp) posts these; the modifier receives them.
- Pure `ViewModifier` — no stored state of its own. Bindings come from ContentView.
- Convenience `.keyboardShortcuts(...)` extension for clean call-site.

---

## FILE 3: `trail-viewer/Sources/ContentView.swift`

```swift
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
            showChatPanel: $appStateStore.showChatPanel,
            showSettings: $showSettings,
            sidebarVisible: $appStateStore.sidebarVisible,
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
```

**Key notes:**
- Three-column `NavigationSplitView`. Sidebar = `TrajectoryListView`, content = detail or welcome, detail column is clear (chat is an overlay instead for better control).
- Chat panel rendered as a conditional trailing `HStack` overlay inside the ZStack so it doesn't interfere with NavigationSplitView column management.
- `StatusBar` via `.safeAreaInset(edge: .bottom)` — always visible.
- `CommandPalette` via `.overlay` — centered modal.
- `SettingsView` via `.sheet`.
- Keyboard shortcut modifier wired to all state bindings.
- Toolbar with chat toggle, refresh, and settings buttons.
- `serverManager` is passed as a plain property (not environment), since only StatusBar needs its state.

---

## FILE 4: `trail-viewer/Sources/TrailViewerApp.swift`

```swift
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
                .environment(trajectoryStore)   // for views using @Environment(TrajectoryStore.self)
                .overlay(alignment: .topTrailing) {
                    ToastContainer()
                        .padding(Theme.spacingMD)
                }
                .task {
                    await onAppear()
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
        // 1. Start embedded server
        serverManager.start(trajectoryPath: appStateStore.currentPath)

        // 2. Refresh CLI detection
        await cliSettingsStore.refreshDetectedCLIs()

        // 3. Load trajectory data once server is likely ready
        // Small delay to let server spin up
        try? await Task.sleep(for: .milliseconds(800))
        await trajectoryStore.loadTrajectories()
        await trajectoryStore.refreshStats()

        // 4. Load chat personas
        await chatStore.loadPersonas()
    }

    // MARK: - Menu Bar Commands

    @CommandsBuilder
    private var appMenuCommands: some Commands {
        // File menu additions
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

        // View menu
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

        // Settings / Preferences
        CommandGroup(replacing: .appSettings) {
            Button("Settings…") {
                NotificationCenter.default.post(name: .showSettings, object: nil)
            }
            .keyboardShortcut(",", modifiers: .command)
        }

        // CLI picker in a custom menu group
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

// MARK: - EnvironmentObject conformance bridge

// @Observable classes need ObservableObject conformance when used with
// @EnvironmentObject. This extension provides that bridge. Most existing
// views use @EnvironmentObject, while newer views (TrajectoryDetailView)
// use @Environment(Store.self). Both injection methods are provided above.

extension TrajectoryStore: ObservableObject {}
extension ChatStore: ObservableObject {}
extension AppStateStore: ObservableObject {}
extension CLISettingsStore: ObservableObject {}
```

**Key notes:**
- All stores created as `@State` at the App level. `APIClient` and `RelayConnection` are shared service instances passed into stores that need them.
- `init()` bootstraps the dependency graph: API → stores.
- `.environmentObject()` for legacy views + `.environment()` for the one view using the new pattern.
- `.task { await onAppear() }` runs startup: server start → CLI refresh → load trajectories → load personas.
- Menu bar: File (Open folder), View (sidebar/chat/palette/refresh), Settings, custom "AI Assistant" menu with CLI picker.
- `ObservableObject` conformance extensions at the bottom bridge `@Observable` classes to `@EnvironmentObject`.
- `ToastContainer` as overlay on the content — always on top.
- Server restart on folder open, with small delay before re-loading data.

---

## Environment Injection Summary

| Store | Injection | Used By |
|-------|-----------|---------|
| `TrajectoryStore` | `.environmentObject()` + `.environment()` | TrajectoryListView, CommandPalette, ChatPanelView, ContentView, StatusBar, TrajectoryDetailView |
| `ChatStore` | `.environmentObject()` | ChatPanelView, PersonaSelector, ContentView |
| `AppStateStore` | `.environmentObject()` | WelcomeView, PathSettingsView, ContentView |
| `CLISettingsStore` | `.environmentObject()` | CLISettingsView, ContentView |

## Important Implementation Notes

1. **@Observable + @EnvironmentObject bridge**: The `extension Store: ObservableObject {}` lines are essential. Without them, `@EnvironmentObject` injection crashes at runtime for `@Observable` classes.

2. **Chat panel as overlay, not NavigationSplitView column**: NavigationSplitView only supports 2-3 fixed columns. The chat panel needs to be toggleable without affecting the split view layout, so it's a trailing overlay inside a ZStack.

3. **Server startup timing**: The 800ms sleep before loading data is a pragmatic choice. The server's stdout handler sets `state = .running`, but we don't want to block on that. A future improvement could await the `serverManager.state == .running` signal.

4. **Menu commands use NotificationCenter**: Menu items live in the `App` scope, not the `View` scope, so they can't directly mutate view `@State`. Notifications bridge this gap, received by `KeyboardShortcutModifier` in ContentView.

5. **`columnVisibility`**: Using `.all` default shows both sidebar and content. The sidebar toggle via NotificationCenter posts `.toggleSidebar` which the modifier handles by toggling `appStateStore.sidebarVisible`. For actual NavigationSplitView column hiding, you may need to sync `columnVisibility` with `sidebarVisible` — add this in ContentView's `.onChange(of: appStateStore.sidebarVisible)` if needed.
