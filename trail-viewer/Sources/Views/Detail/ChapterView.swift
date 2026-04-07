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
        chapter.agent ?? "Agent"
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
                    Text("CHAPTER \(chapter.number)")
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

                    if let endTime = chapter.completedAt {
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
            NoteEventView(event: event, chapterAgent: chapter.agent)
        case .finding:
            FindingEventView(event: event, chapterAgent: chapter.agent)
        case .thinking:
            ThinkingEventView(event: event, chapterAgent: chapter.agent)
        case .toolCall:
            ToolCallEventView(event: event, chapterAgent: chapter.agent)
        case .reflection:
            ReflectionEventView(event: event, chapterAgent: chapter.agent)
        case .error:
            ErrorEventView(event: event, chapterAgent: chapter.agent)
        case .messageSent, .messageReceived:
            MessageEventView(event: event, chapterAgent: chapter.agent)
        case .decision:
            DecisionCard(decision: decision(from: event))
        default:
            NoteEventView(event: event, chapterAgent: chapter.agent)
        }
    }

    // MARK: - Helpers

    private func decision(from event: TrajectoryEvent) -> Decision {
        Decision(
            id: event.id,
            question: event.metadata?["question"] ?? "Decision",
            chosen: event.content,
            alternatives: nil,
            confidence: confidence(from: event),
            reasoning: event.metadata?["reasoning"] ?? event.metadata?["tool_result"] ?? event.metadata?["toolResult"],
            timestamp: event.timestamp
        )
    }

    private func confidence(from event: TrajectoryEvent) -> Double? {
        guard let rawValue = event.metadata?["confidence"] else { return nil }
        return Double(rawValue)
    }

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
        .background(Theme.pageBg)
    }

    static var mockChapter: Chapter {
        let now = Date()
        return Chapter(
            id: UUID().uuidString,
            title: "Investigating the Authentication Flow",
            number: 1,
            agent: "Claude",
            startedAt: now,
            completedAt: now.addingTimeInterval(120),
            events: [
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .thinking,
                    timestamp: now,
                    agent: "Claude",
                    content: "The user wants to understand why login fails intermittently. Let me trace the auth middleware chain to find potential race conditions.",
                    significance: .medium,
                    metadata: nil,
                    chapterId: nil
                ),
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .toolCall,
                    timestamp: now.addingTimeInterval(30),
                    agent: "Claude",
                    content: "Found session validation logic with async token refresh that lacks proper locking.",
                    significance: .low,
                    metadata: ["tool": "Read"],
                    chapterId: nil
                ),
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .finding,
                    timestamp: now.addingTimeInterval(90),
                    agent: "Claude",
                    content: "Race condition identified: concurrent requests can trigger simultaneous token refreshes, causing one request to use a stale token.",
                    significance: .high,
                    metadata: ["confidence": "0.85"],
                    chapterId: nil
                ),
                TrajectoryEvent(
                    id: UUID().uuidString,
                    type: .decision,
                    timestamp: now.addingTimeInterval(120),
                    agent: "Claude",
                    content: "Add mutex lock around token refresh logic",
                    significance: .high,
                    metadata: [
                        "confidence": "0.9",
                        "reasoning": "A mutex ensures only one request refreshes the token at a time, while others wait for the fresh token."
                    ],
                    chapterId: nil
                ),
            ],
            summary: nil
        )
    }
}
