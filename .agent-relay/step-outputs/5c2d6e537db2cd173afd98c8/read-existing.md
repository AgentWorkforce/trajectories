=== ContentView ===
(not found)
=== TrailViewerApp ===
// Trail Viewer — macOS app entry point

import SwiftUI

@main
struct TrailViewerApp: App {
    var body: some Scene {
        WindowGroup("Trail Viewer") {
            Text("Trail Viewer")
                .frame(minWidth: 900, minHeight: 600)
                .preferredColorScheme(.light)
        }
        .defaultSize(width: 1200, height: 800)
        .windowResizability(.contentMinSize)
    }
}
=== Available Views ===
trail-viewer/Sources/Views/Chat/ChatBubble.swift
trail-viewer/Sources/Views/Chat/ChatEmptyStates.swift
trail-viewer/Sources/Views/Chat/ChatInputBar.swift
trail-viewer/Sources/Views/Chat/ChatPanelView.swift
trail-viewer/Sources/Views/Chat/CodeBlockView.swift
trail-viewer/Sources/Views/Chat/MarkdownRenderer.swift
trail-viewer/Sources/Views/Chat/PersonaCard.swift
trail-viewer/Sources/Views/Chat/PersonaSelector.swift
trail-viewer/Sources/Views/Chat/TypingIndicator.swift
trail-viewer/Sources/Views/CommandPalette.swift
trail-viewer/Sources/Views/Detail/ChapterNavigation.swift
trail-viewer/Sources/Views/Detail/ChapterView.swift
trail-viewer/Sources/Views/Detail/ConfidenceMeter.swift
trail-viewer/Sources/Views/Detail/DecisionCard.swift
trail-viewer/Sources/Views/Detail/DetailSkeleton.swift
trail-viewer/Sources/Views/Detail/Events/ErrorEventView.swift
trail-viewer/Sources/Views/Detail/Events/EventCardBase.swift
trail-viewer/Sources/Views/Detail/Events/FindingEventView.swift
trail-viewer/Sources/Views/Detail/Events/MessageEventView.swift
trail-viewer/Sources/Views/Detail/Events/NoteEventView.swift
trail-viewer/Sources/Views/Detail/Events/ReflectionEventView.swift
trail-viewer/Sources/Views/Detail/Events/ThinkingEventView.swift
trail-viewer/Sources/Views/Detail/Events/ToolCallEventView.swift
trail-viewer/Sources/Views/Detail/FileChangesView.swift
trail-viewer/Sources/Views/Detail/RetrospectiveView.swift
trail-viewer/Sources/Views/Detail/TimelineRail.swift
trail-viewer/Sources/Views/Detail/TrajectoryDetailView.swift
trail-viewer/Sources/Views/Detail/TrajectoryHeaderView.swift
trail-viewer/Sources/Views/Settings/CLISettingsView.swift
trail-viewer/Sources/Views/Settings/PathSettingsView.swift
trail-viewer/Sources/Views/Settings/SettingsView.swift
trail-viewer/Sources/Views/Sidebar/FilterBar.swift
trail-viewer/Sources/Views/Sidebar/SidebarHeader.swift
trail-viewer/Sources/Views/Sidebar/SidebarSkeleton.swift
trail-viewer/Sources/Views/Sidebar/TrajectoryListView.swift
trail-viewer/Sources/Views/Sidebar/TrajectoryRow.swift
trail-viewer/Sources/Views/WelcomeView.swift
