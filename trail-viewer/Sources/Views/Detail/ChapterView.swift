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

    private var chapterAgentName: String {
        chapter.agentName ?? "Agent"
    }

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
                    Text("CHAPTER")
                        .caption()
                        .foregroundColor(Theme.textTertiary)
                        .kerning(1.5)

                    Spacer()

                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Theme.textTertiary)
                }

                Text(chapter.title)
                    .sectionTitle()
                    .foregroundColor(Theme.textPrimary)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 8) {
                    AgentAvatar(name: chapterAgentName)
                    Text(chapterAgentName)
                        .caption()
                        .foregroundColor(Theme.textSecondary)
                }

                HStack(spacing: 4) {
                    Text(timeString(chapter.startedAt))
                        .caption()
                        .foregroundColor(Theme.textTertiary)

                    if let endTime = chapter.endedAt {
                        Text("—")
                            .caption()
                            .foregroundColor(Theme.textTertiary)
                        Text(timeString(endTime))
                            .caption()
                            .foregroundColor(Theme.textTertiary)
                    }
                }

                if !isExpanded {
                    Text("\(chapter.events.count) events")
                        .caption()
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
                eventView(for: event)
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
            NoteEventView(event: event, chapterAgent: chapter.agentName)
        case .finding:
            FindingEventView(event: event, chapterAgent: chapter.agentName)
        case .thinking:
            ThinkingEventView(event: event, chapterAgent: chapter.agentName)
        case .toolCall:
            ToolCallEventView(event: event, chapterAgent: chapter.agentName)
        case .reflection:
            ReflectionEventView(event: event, chapterAgent: chapter.agentName)
        case .error:
            ErrorEventView(event: event, chapterAgent: chapter.agentName)
        case .messageSent, .messageReceived:
            MessageEventView(event: event, chapterAgent: chapter.agentName)
        case .decision:
            DecisionCard(decision: decision(from: event))
        default:
            NoteEventView(event: event, chapterAgent: chapter.agentName)
        }
    }

    // MARK: - Helpers

    private func decision(from event: TrajectoryEvent) -> Decision {
        Decision(
            question: event.metadata?["question"] ?? "Decision",
            chosen: event.content,
            alternatives: nil,
            confidence: confidence(from: event),
            reasoning: event.metadata?["reasoning"] ?? event.metadata?["tool_result"] ?? event.metadata?["toolResult"]
        )
    }

    private func confidence(from event: TrajectoryEvent) -> Double? {
        guard let rawValue = event.metadata?["confidence"] else { return nil }
        return Double(rawValue)
    }

    private func timeString(_ date: Date?) -> String {
        guard let date else { return "--:-- --" }
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
        .background(Theme.pageBg)
    }

    static var mockChapter: Chapter {
        let now = Date()
        let nowMs = now.timeIntervalSince1970 * 1000
        return Chapter(
            id: UUID().uuidString,
            title: "Investigating the Authentication Flow",
            agentName: "Claude",
            startedAt: now,
            endedAt: now.addingTimeInterval(120),
            events: [
                TrajectoryEvent(
                    ts: nowMs,
                    type: .thinking,
                    content: "The user wants to understand why login fails intermittently. Let me trace the auth middleware chain to find potential race conditions.",
                    agent: "Claude",
                    significance: "medium",
                    metadata: nil
                ),
                TrajectoryEvent(
                    ts: nowMs + 30000,
                    type: .toolCall,
                    content: "Found session validation logic with async token refresh that lacks proper locking.",
                    agent: "Claude",
                    significance: "low",
                    metadata: ["tool": "Read"]
                ),
                TrajectoryEvent(
                    ts: nowMs + 90000,
                    type: .finding,
                    content: "Race condition identified: concurrent requests can trigger simultaneous token refreshes, causing one request to use a stale token.",
                    agent: "Claude",
                    significance: "high",
                    metadata: ["confidence": "0.85"]
                ),
                TrajectoryEvent(
                    ts: nowMs + 120000,
                    type: .decision,
                    content: "Add mutex lock around token refresh logic",
                    agent: "Claude",
                    significance: "high",
                    metadata: [
                        "confidence": "0.9",
                        "reasoning": "A mutex ensures only one request refreshes the token at a time, while others wait for the fresh token."
                    ]
                ),
            ],
            summary: nil
        )
    }
}
