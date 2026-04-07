# ChapterView.swift — Complete SwiftUI File

```swift
import SwiftUI

struct ChapterView: View {
    let chapter: Chapter
    var initiallyExpanded: Bool = true

    @State private var isExpanded: Bool

    init(chapter: Chapter, initiallyExpanded: Bool = true) {
        self.chapter = chapter
        self.initiallyExpanded = initiallyExpanded
        self._isExpanded = State(initialValue: initiallyExpanded)
    }

    // MARK: - Layout Constants

    private let spacingMD: CGFloat = 12
    private let spacingLG: CGFloat = 24

    var body: some View {
        VStack(alignment: .leading, spacing: spacingMD) {
            chapterHeader
            RuleLine()
            eventsSection
        }
        .padding(.vertical, spacingLG)
    }

    // MARK: - Chapter Header

    private var chapterHeader: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.3)) {
                isExpanded.toggle()
            }
        }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("CHAPTER \(chapter.number)")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)
                        .kerning(1.5)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Theme.textTertiary)
                }

                Text(chapter.title)
                    .font(Typography.sectionTitle)
                    .foregroundColor(Theme.textPrimary)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 8) {
                    AgentAvatar(name: chapter.agentName)
                    Text(chapter.agentName)
                        .font(Typography.caption)
                        .foregroundColor(Theme.textSecondary)
                }

                HStack(spacing: 4) {
                    if let startTime = chapter.startTime {
                        Text(timeString(startTime))
                            .font(Typography.caption)
                            .foregroundColor(Theme.textTertiary)

                        if let endTime = chapter.endTime {
                            Text("—")
                                .font(Typography.caption)
                                .foregroundColor(Theme.textTertiary)
                            Text(timeString(endTime))
                                .font(Typography.caption)
                                .foregroundColor(Theme.textTertiary)
                        }
                    }
                }

                if !isExpanded {
                    Text("\(chapter.events.count) events")
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Events Section

    @ViewBuilder
    private var eventsSection: some View {
        if isExpanded {
            TimelineRail(events: chapter.events) { event in
                EventCardBase {
                    eventView(for: event)
                }
            }
            .transition(.opacity)
            .animation(.easeInOut(duration: 0.3), value: isExpanded)
        }
    }

    // MARK: - Event Routing

    @ViewBuilder
    private func eventView(for event: TrajectoryEvent) -> some View {
        switch event.type {
        case .note:
            NoteEventView(event: event)
        case .finding:
            FindingEventView(event: event)
        case .thinking:
            ThinkingEventView(event: event)
        case .toolCall:
            ToolCallEventView(event: event)
        case .reflection:
            ReflectionEventView(event: event)
        case .error:
            ErrorEventView(event: event)
        case .messageSent, .messageReceived:
            MessageEventView(event: event)
        case .decision:
            DecisionCard(
                title: event.content,
                confidence: event.confidence ?? 0.5,
                alternatives: [],
                reasoning: event.toolResult ?? ""
            )
        default:
            NoteEventView(event: event)
        }
    }

    // MARK: - Helpers

    private func timeString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Preview

struct ChapterView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            ChapterView(chapter: mockChapter)
                .padding(.horizontal, 32)
        }
        .frame(width: 700, height: 800)
        .background(Theme.backgroundPrimary)
    }

    static var mockChapter: Chapter {
        let now = Date()
        return Chapter(
            id: UUID().uuidString,
            number: 1,
            title: "Investigating the Authentication Flow",
            agentName: "Claude",
            events: [
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .thinking,
                    content: "The user wants to understand why login fails intermittently. Let me trace the auth middleware chain to find potential race conditions.",
                    timestamp: now,
                    agentName: "Claude",
                    significance: .moderate,
                    confidence: nil,
                    toolName: nil,
                    toolResult: nil
                ),
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .toolCall,
                    content: "Reading auth middleware configuration",
                    timestamp: now.addingTimeInterval(30),
                    agentName: "Claude",
                    significance: .routine,
                    confidence: nil,
                    toolName: "Read",
                    toolResult: "Found session validation logic with async token refresh that lacks proper locking."
                ),
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .finding,
                    content: "Race condition identified: concurrent requests can trigger simultaneous token refreshes, causing one request to use a stale token.",
                    timestamp: now.addingTimeInterval(90),
                    agentName: "Claude",
                    significance: .critical,
                    confidence: 0.85,
                    toolName: nil,
                    toolResult: nil
                ),
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .decision,
                    content: "Add mutex lock around token refresh logic",
                    timestamp: now.addingTimeInterval(120),
                    agentName: "Claude",
                    significance: .critical,
                    confidence: 0.9,
                    toolName: nil,
                    toolResult: "A mutex ensures only one request refreshes the token at a time, while others wait for the fresh token."
                ),
            ],
            startTime: now,
            endTime: now.addingTimeInterval(120)
        )
    }
}
```

OWNER_DECISION: COMPLETE
REASON: ChapterView.swift spec written to .relay/specs/46-chapter-view.md with full SwiftUI implementation including collapsible header, event routing switch, timeline rail integration, and preview provider with realistic mock data.
