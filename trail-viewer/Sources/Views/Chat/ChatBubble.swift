import SwiftUI

// MARK: - ChatBubble

struct ChatBubble: View {
    let message: ChatMessage
    let persona: ChatPersona?

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            if message.isUser {
                Spacer(minLength: 60)
            }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: Theme.spacingXS) {
                if !message.isUser, let persona {
                    PersonaCard(persona: persona, isActive: true, compact: true)
                }

                VStack(alignment: .leading, spacing: Theme.spacingSM) {
                    Text(MarkdownRenderer.render(message.content))
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(message.timestamp, style: .time)
                        .font(.system(size: 10))
                        .foregroundColor(Theme.textTertiary)
                }
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, Theme.spacingBase)
                .background(bubbleBackground)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
                .overlay(bubbleBorder)
            }

            if !message.isUser {
                Spacer(minLength: 60)
            }
        }
    }

    private var bubbleBackground: Color {
        message.isUser ? Theme.blueMuted : Theme.cardBg
    }

    private var bubbleBorder: some View {
        RoundedRectangle(cornerRadius: Theme.radiusLG)
            .stroke(borderColor, lineWidth: 1)
    }

    private var borderColor: Color {
        if message.isUser {
            return Theme.blueLight
        }
        if let persona {
            return persona.color.opacity(0.3)
        }
        return Theme.borderLight
    }
}

// MARK: - SystemMessageView

struct SystemMessageView: View {
    let message: ChatMessage

    var body: some View {
        HStack(spacing: Theme.spacingBase) {
            Rectangle()
                .fill(Theme.borderLight)
                .frame(width: 1)
                .padding(.vertical, 2)

            Text(message.content)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Theme.textTertiary)
                .italic()

            Spacer(minLength: 0)
        }
        .padding(.horizontal, Theme.spacingLG)
        .padding(.vertical, Theme.spacingXS)
    }
}

// MARK: - Preview

struct ChatBubble_Previews: PreviewProvider {
    static var previews: some View {
        let persona = ChatPersona(
            id: "critic",
            name: "Critic",
            emoji: "🧐",
            description: "Finds flaws",
            colorHex: "#c87f6b"
        )

        let agentMessage = ChatMessage(
            from: "critic",
            content: "The author's use of **unreliable narration** here is *fascinating*. Notice how the `timestamp` metadata contradicts the narrative.",
            persona: "critic"
        )

        let userMessage = ChatMessage(
            from: "user",
            content: "Can you elaborate on that? I didn't catch the contradiction."
        )

        let systemMessage = ChatMessage(
            from: "system",
            content: "Critic has joined the discussion."
        )

        return VStack(alignment: .leading, spacing: Theme.spacingBase) {
            SystemMessageView(message: systemMessage)
            ChatBubble(message: agentMessage, persona: persona)
            ChatBubble(message: userMessage, persona: nil)
        }
        .padding(Theme.spacingLG)
        .frame(width: 420)
        .background(Theme.pageBg)
    }
}
