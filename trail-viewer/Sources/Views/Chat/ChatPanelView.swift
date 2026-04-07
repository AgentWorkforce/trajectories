import SwiftUI

struct ChatPanelView: View {
    @EnvironmentObject var chatStore: ChatStore
    @EnvironmentObject var trajectoryStore: TrajectoryStore
    @State private var inputText: String = ""

    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Header
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Discuss")
                        .font(Typography.sectionTitle)
                    Spacer()
                    if chatStore.isActive {
                        Button("End Discussion") {
                            Task { await chatStore.stopChat() }
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
            if chatStore.isActive {
                PersonaSelector()
            }

            // MARK: - Content Area
            Group {
                if trajectoryStore.selectedTrajectory == nil {
                    NoTrajectorySelectedState()
                } else if !chatStore.isActive {
                    NoSessionStartedState(
                        personaCount: chatStore.personas.count,
                        onStartSession: {
                            if let id = trajectoryStore.selectedTrajectory?.id {
                                Task { await chatStore.startChat(trajectoryId: id) }
                            }
                        }
                    )
                } else if chatStore.chatMessages.isEmpty {
                    NoMessagesHint()
                } else {
                    ScrollViewReader { proxy in
                        ScrollView(.vertical, showsIndicators: true) {
                            LazyVStack(spacing: Theme.spacingSM) {
                                ForEach(chatStore.chatMessages) { message in
                                    ChatBubble(
                                        message: message,
                                        persona: chatStore.personas.first(where: { $0.id == message.persona })
                                    )
                                    .id(message.id)
                                }

                                if !chatStore.typingPersonas.isEmpty {
                                    let typingId = chatStore.typingPersonas.first
                                    let typingPersona = chatStore.personas.first(where: { $0.id == typingId })
                                    TypingIndicator(persona: typingPersona)
                                }
                            }
                            .padding(Theme.spacingMD)
                        }
                        .onChange(of: chatStore.chatMessages.count) { _, _ in
                            if let lastId = chatStore.chatMessages.last?.id {
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
            ChatInputBar(
                text: $inputText,
                onSend: { text in
                    Task { await chatStore.sendMessage(text: text) }
                    inputText = ""
                },
                isConnected: chatStore.isActive
            )
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
