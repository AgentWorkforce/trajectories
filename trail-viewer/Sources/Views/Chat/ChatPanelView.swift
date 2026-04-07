import SwiftUI

struct ChatPanelView: View {
    @EnvironmentObject var chatStore: ChatStore
    @EnvironmentObject var trajectoryStore: TrajectoryStore
    @State private var scrollToBottom = false

    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Discuss")
                        .font(Typography.sectionTitle)
                    Spacer()
                    if chatStore.isSessionActive {
                        Button("End Discussion") {
                            chatStore.endSession()
                        }
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)
                        .buttonStyle(.plain)
                    }
                }
                if let trajectory = trajectoryStore.selectedTrajectory {
                    Text(trajectory.title)
                        .font(Typography.caption)
                        .foregroundColor(Theme.textTertiary)
                        .lineLimit(1)
                }
            }
            .padding(Theme.spacingMD)

            RuleLine()

            // MARK: - Persona Selector
            if chatStore.isSessionActive {
                PersonaSelector()
            }

            // MARK: - Content Area
            Group {
                if trajectoryStore.selectedTrajectory == nil {
                    NoTrajectorySelectedState()
                } else if !chatStore.isSessionActive {
                    NoSessionStartedState(
                        personaCount: chatStore.personas.count,
                        onStartSession: { chatStore.startSession() }
                    )
                } else if chatStore.messages.isEmpty {
                    NoMessagesHint()
                } else {
                    ScrollViewReader { proxy in
                        ScrollView(.vertical, showsIndicators: true) {
                            LazyVStack(spacing: Theme.spacingSM) {
                                ForEach(chatStore.messages) { message in
                                    ChatBubble(
                                        message: message,
                                        persona: chatStore.personas.first(where: { $0.id == message.personaId })
                                    )
                                    .id(message.id)
                                }

                                if chatStore.isTyping, let typingPersona = chatStore.typingPersona {
                                    TypingIndicator(
                                        personaColor: Theme.agentColors[typingPersona.id] ?? Theme.blue
                                    )
                                }
                            }
                            .padding(Theme.spacingMD)
                        }
                        .onChange(of: chatStore.messages.count) { _ in
                            if let lastId = chatStore.messages.last?.id {
                                withAnimation {
                                    proxy.scrollTo(lastId, anchor: .bottom)
                                }
                            }
                        }
                    }
                }
            }
            .frame(maxHeight: .infinity)

            // MARK: - Input Bar
            ChatInputBar(onSend: { text in
                Task { await chatStore.sendMessage(text) }
            })
        }
        .frame(width: 340)
        .background(Theme.pageBg)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Theme.borderLight)
                .frame(width: 0.5)
        }
        .transition(.move(edge: .trailing))
    }
}

// MARK: - Preview

struct ChatPanelView_Previews: PreviewProvider {
    static var previews: some View {
        ChatPanelView()
            .environmentObject(ChatStore())
            .environmentObject(TrajectoryStore())
            .frame(height: 700)
    }
}
