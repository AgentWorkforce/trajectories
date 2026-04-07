# Event Type Views — "The Beautiful Notebook" Design

All 8 Swift files for Trail Viewer event type views. Light mode, warm paper book aesthetic.

---

## FILE 1: EventCardBase.swift

```swift
import SwiftUI

// MARK: - EventCardBase

struct EventCardBase<Content: View>: View {
    let event: TrajectoryEvent
    let chapterAgent: String?
    @ViewBuilder let content: () -> Content

    init(
        event: TrajectoryEvent,
        chapterAgent: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.event = event
        self.chapterAgent = chapterAgent
        self.content = content
    }

    private var showAgentBadge: Bool {
        guard let eventAgent = event.agent,
              let chapAgent = chapterAgent else { return false }
        return eventAgent != chapAgent
    }

    private var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: event.timestamp)
    }

    private var confidenceText: String? {
        guard let meta = event.metadata,
              let conf = meta["confidence"],
              let value = Double(conf) else { return nil }
        return "\(Int(value * 100))%"
    }

    var body: some View {
        HStack(alignment: .top, spacing: Theme.spacingBase) {
            // Left: Significance dot
            SignificanceDot(level: event.significance?.rawValue ?? "low")
                .padding(.top, 5)

            // Center: Content
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Right: Timestamp + optional badges
            VStack(alignment: .trailing, spacing: Theme.spacingXS) {
                Text(formattedTime)
                    .caption()

                if showAgentBadge, let agentName = event.agent {
                    AgentAvatar(name: agentName, size: 20)
                }

                if let conf = confidenceText {
                    Text(conf)
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundColor(Theme.textTertiary)
                }
            }
        }
        .padding(.vertical, Theme.spacingMD)
    }
}

// MARK: - Preview

struct EventCardBase_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "preview-1",
            type: .note,
            timestamp: Date(),
            agent: "Architect",
            content: "This is a sample event card with some body text to demonstrate the layout.",
            significance: .medium,
            metadata: ["confidence": "0.85"],
            chapterId: "ch-1"
        )

        EventCardBase(event: event, chapterAgent: "Lead") {
            Text(event.content)
                .bodyStyle()
        }
        .padding()
        .background(Theme.pageBg)
        .previewLayout(.sizeThatFits)
    }
}
```

---

## FILE 2: NoteEventView.swift

```swift
import SwiftUI

// MARK: - NoteEventView

struct NoteEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            HStack(alignment: .top, spacing: Theme.spacingSM) {
                Image(systemName: "book.fill")
                    .font(.system(size: 16))
                    .foregroundColor(Theme.textTertiary)
                    .frame(width: 20, alignment: .center)

                Text(event.content)
                    .bodyStyle()
            }
        }
    }
}

// MARK: - Preview

struct NoteEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "note-1",
            type: .note,
            timestamp: Date(),
            agent: "Lead",
            content: "Began investigating the authentication flow. The session token appears to be stored in local storage rather than an HTTP-only cookie, which is a security concern.",
            significance: .low,
            metadata: nil,
            chapterId: "ch-1"
        )

        NoteEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
```

---

## FILE 3: FindingEventView.swift

```swift
import SwiftUI

// MARK: - FindingEventView

struct FindingEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            HStack(spacing: 0) {
                // Left border — 3pt blue rule
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Theme.blue)
                    .frame(width: 3)

                // Content indented
                Text(event.content)
                    .bodyStyle()
                    .padding(.leading, Theme.spacingBase)
                    .padding(.vertical, Theme.spacingXS)
            }
        }
    }
}

// MARK: - Preview

struct FindingEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "finding-1",
            type: .finding,
            timestamp: Date(),
            agent: "Analyst",
            content: "The rate limiter on /api/auth/login is set to 1000 req/min — far too permissive for a login endpoint. Industry standard is 5–10 attempts per minute per IP.",
            significance: .high,
            metadata: nil,
            chapterId: "ch-1"
        )

        FindingEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
```

---

## FILE 4: ThinkingEventView.swift

```swift
import SwiftUI

// MARK: - ThinkingEventView

struct ThinkingEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    @State private var isExpanded = false

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                // Collapsed header — always visible
                Button(action: {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isExpanded.toggle()
                    }
                }) {
                    HStack(spacing: Theme.spacingSM) {
                        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(Theme.textTertiary)
                            .frame(width: 12)

                        Text("Thinking…")
                            .font(.system(size: 13.5, design: .serif))
                            .italic()
                            .foregroundColor(Theme.textTertiary)
                    }
                }
                .buttonStyle(.plain)

                // Expanded content
                if isExpanded {
                    Text(event.content)
                        .font(.system(size: 13, design: .serif))
                        .italic()
                        .foregroundColor(Theme.textTertiary)
                        .lineSpacing(13 * 0.5)
                        .padding(.leading, 20)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }
}

// MARK: - Preview

struct ThinkingEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "thinking-1",
            type: .thinking,
            timestamp: Date(),
            agent: "Lead",
            content: "If we migrate the session store from localStorage to HTTP-only cookies, we need to consider CSRF protection. The existing CORS configuration should handle most cases, but we should also add a CSRF token for state-mutating requests.",
            significance: .low,
            metadata: nil,
            chapterId: "ch-1"
        )

        VStack {
            ThinkingEventView(event: event)
        }
        .padding()
        .background(Theme.pageBg)
        .previewLayout(.sizeThatFits)
    }
}
```

---

## FILE 5: ToolCallEventView.swift

```swift
import SwiftUI

// MARK: - ToolCallEventView

struct ToolCallEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    @State private var isExpanded = false

    private var toolName: String {
        event.metadata?["tool"] ?? "unknown"
    }

    private var isLongContent: Bool {
        event.content.count > 300
    }

    private var displayContent: String {
        if !isExpanded && isLongContent {
            return String(event.content.prefix(280)) + "…"
        }
        return event.content
    }

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            VStack(alignment: .leading, spacing: Theme.spacingSM) {
                // Tool name header
                HStack(spacing: Theme.spacingSM) {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Theme.textTertiary)

                    Text(toolName)
                        .font(.system(size: 13, weight: .semibold, design: .monospaced))
                        .foregroundColor(Theme.textPrimary)
                }

                // Code content box
                VStack(alignment: .leading, spacing: 0) {
                    Text(displayContent)
                        .codeStyle()
                        .padding(Theme.spacingBase)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Theme.sidebarBg)
                .cornerRadius(Theme.radiusMD)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusMD)
                        .strokeBorder(Theme.borderLight, lineWidth: 0.5)
                )

                // Expand/collapse for long output
                if isLongContent {
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isExpanded.toggle()
                        }
                    }) {
                        Text(isExpanded ? "Show less" : "Show more")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Theme.blue)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Preview

struct ToolCallEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "tool-1",
            type: .toolCall,
            timestamp: Date(),
            agent: "Worker",
            content: "grep -r 'localStorage.setItem' src/auth/\n\nsrc/auth/session.ts:42:  localStorage.setItem('session_token', token)\nsrc/auth/refresh.ts:18:  localStorage.setItem('refresh_token', refresh)",
            significance: .medium,
            metadata: ["tool": "grep"],
            chapterId: "ch-1"
        )

        ToolCallEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
```

---

## FILE 6: ReflectionEventView.swift

```swift
import SwiftUI

// MARK: - ReflectionEventView

struct ReflectionEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            VStack(alignment: .leading, spacing: 0) {
                Text(event.content)
                    .font(.system(size: 13.5, design: .serif))
                    .italic()
                    .foregroundColor(Theme.textSecondary)
                    .lineSpacing(13.5 * 0.5)
                    .padding(Theme.spacingBase)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Theme.yellowMuted)
            .cornerRadius(Theme.radiusMD)
        }
    }
}

// MARK: - Preview

struct ReflectionEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "reflection-1",
            type: .reflection,
            timestamp: Date(),
            agent: "Lead",
            content: "In hindsight, we should have audited the token storage mechanism earlier. The localStorage approach was inherited from the initial prototype and never revisited during the security hardening phase.",
            significance: .medium,
            metadata: nil,
            chapterId: "ch-1"
        )

        ReflectionEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
```

---

## FILE 7: ErrorEventView.swift

```swift
import SwiftUI

// MARK: - ErrorEventView

struct ErrorEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            HStack(spacing: 0) {
                // Red left border — 3pt
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Theme.error)
                    .frame(width: 3)

                HStack(alignment: .top, spacing: Theme.spacingSM) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Theme.error)
                        .frame(width: 20, alignment: .center)

                    Text(event.content)
                        .bodyStyle()
                        .foregroundColor(Theme.textPrimary)
                }
                .padding(Theme.spacingBase)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.error.opacity(0.1))
                .cornerRadius(Theme.radiusMD)
            }
        }
    }
}

// MARK: - Preview

struct ErrorEventView_Previews: PreviewProvider {
    static var previews: some View {
        let event = TrajectoryEvent(
            id: "error-1",
            type: .error,
            timestamp: Date(),
            agent: "Worker",
            content: "Build failed: Type 'SessionManager' has no member 'setHttpOnlyCookie'. The API was renamed in v2.3 — need to use 'setCookieWithOptions' instead.",
            significance: .high,
            metadata: nil,
            chapterId: "ch-1"
        )

        ErrorEventView(event: event)
            .padding()
            .background(Theme.pageBg)
            .previewLayout(.sizeThatFits)
    }
}
```

---

## FILE 8: MessageEventView.swift

```swift
import SwiftUI

// MARK: - MessageEventView

struct MessageEventView: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    private var isSent: Bool {
        event.type == .messageSent
    }

    var body: some View {
        EventCardBase(event: event, chapterAgent: chapterAgent) {
            if isSent {
                sentBubble
            } else {
                receivedBubble
            }
        }
    }

    // MARK: - Sent Bubble (right-aligned, blue)

    private var sentBubble: some View {
        HStack {
            Spacer(minLength: 40)

            VStack(alignment: .trailing, spacing: Theme.spacingXS) {
                Text("You")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Theme.blue)

                Text(event.content)
                    .bodyStyle()
                    .padding(Theme.spacingBase)
                    .background(Theme.blueMuted)
                    .cornerRadius(Theme.radiusLG)
            }
        }
    }

    // MARK: - Received Bubble (left-aligned, card bg)

    private var receivedBubble: some View {
        HStack(alignment: .top, spacing: Theme.spacingSM) {
            AgentAvatar(name: event.agent ?? "Agent", size: 24)

            VStack(alignment: .leading, spacing: Theme.spacingXS) {
                Text(event.agent ?? "Agent")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Theme.textSecondary)

                Text(event.content)
                    .bodyStyle()
                    .padding(Theme.spacingBase)
                    .background(Theme.cardBg)
                    .cornerRadius(Theme.radiusLG)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusLG)
                            .strokeBorder(Theme.borderLight, lineWidth: 0.5)
                    )
            }

            Spacer(minLength: 40)
        }
    }
}

// MARK: - Preview

struct MessageEventView_Previews: PreviewProvider {
    static var previews: some View {
        let sentEvent = TrajectoryEvent(
            id: "msg-sent-1",
            type: .messageSent,
            timestamp: Date(),
            agent: "Lead",
            content: "Please audit the session token storage in src/auth/ and report back on any security concerns.",
            significance: .medium,
            metadata: nil,
            chapterId: "ch-1"
        )

        let receivedEvent = TrajectoryEvent(
            id: "msg-recv-1",
            type: .messageReceived,
            timestamp: Date(),
            agent: "Worker",
            content: "Found three instances of localStorage usage for sensitive tokens. Will prepare a migration plan to HTTP-only cookies.",
            significance: .medium,
            metadata: nil,
            chapterId: "ch-1"
        )

        VStack(spacing: Theme.spacingLG) {
            MessageEventView(event: sentEvent)
            MessageEventView(event: receivedEvent)
        }
        .padding()
        .background(Theme.pageBg)
        .previewLayout(.sizeThatFits)
    }
}
```

---

## Usage: Event Router

A helper to select the correct view for any event type:

```swift
import SwiftUI

// MARK: - EventViewRouter

struct EventViewRouter: View {
    let event: TrajectoryEvent
    var chapterAgent: String? = nil

    var body: some View {
        switch event.type {
        case .note:
            NoteEventView(event: event, chapterAgent: chapterAgent)
        case .finding:
            FindingEventView(event: event, chapterAgent: chapterAgent)
        case .thinking:
            ThinkingEventView(event: event, chapterAgent: chapterAgent)
        case .toolCall, .toolResult:
            ToolCallEventView(event: event, chapterAgent: chapterAgent)
        case .reflection:
            ReflectionEventView(event: event, chapterAgent: chapterAgent)
        case .error:
            ErrorEventView(event: event, chapterAgent: chapterAgent)
        case .messageSent, .messageReceived:
            MessageEventView(event: event, chapterAgent: chapterAgent)
        case .decision:
            // DecisionCard is a separate component per spec
            FindingEventView(event: event, chapterAgent: chapterAgent)
        case .codeChange, .fileCreate, .fileModify:
            ToolCallEventView(event: event, chapterAgent: chapterAgent)
        case .checkpoint:
            NoteEventView(event: event, chapterAgent: chapterAgent)
        }
    }
}
```

---

## Design Notes

- **EventCardBase** provides the universal wrapper: significance dot (left), content (center), timestamp + agent badge + confidence (right). All 7 content views are composed inside it.
- **Consistent spacing**: All views use `Theme.spacingMD` (16pt) vertical padding via EventCardBase.
- **Typography**: Body text uses `.bodyStyle()` (13.5pt). Tool calls use `.codeStyle()` (12pt monospaced). Thinking/reflection use serif italic for editorial flavor.
- **Color palette**: Warm paper tones from Theme. Each event type gets a distinct visual cue (blue border for findings, yellow wash for reflections, red tint for errors, blue bubble for sent messages).
- **Collapsibility**: ThinkingEventView and ToolCallEventView support expand/collapse with `.easeInOut(duration: 0.2)` animation.
- **Agent awareness**: EventCardBase conditionally shows an AgentAvatar when the event's agent differs from the chapter's agent — no redundant badges.
- **All imports reference Design/ folder components**: Theme, Typography modifiers, SignificanceDot, AgentAvatar.
