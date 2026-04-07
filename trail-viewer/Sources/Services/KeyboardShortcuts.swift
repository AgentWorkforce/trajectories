import Foundation
import SwiftUI

// MARK: - Notification Names

extension Notification.Name {
    static let toggleChatPanel = Notification.Name("toggleChatPanel")
    static let showCommandPalette = Notification.Name("showCommandPalette")
    static let toggleSidebar = Notification.Name("toggleSidebar")
    static let refreshTrajectories = Notification.Name("refreshTrajectories")
    static let showSettings = Notification.Name("showSettings")
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
