import SwiftUI

// MARK: - Typing Indicator

struct TypingIndicator: View {
    let persona: ChatPersona?

    @State private var animating = false

    private let dotCount = 3
    private let dotSize: CGFloat = 6
    private let cycleDuration: Double = 1.2

    var body: some View {
        HStack(spacing: Theme.spacingSM) {
            if let persona {
                PersonaCard(persona: persona, isActive: true, compact: true)
            }

            HStack(spacing: 5) {
                ForEach(0..<dotCount, id: \.self) { index in
                    Circle()
                        .fill(dotColor)
                        .frame(width: dotSize, height: dotSize)
                        .opacity(animating ? 1.0 : 0.3)
                        .animation(
                            .easeInOut(duration: cycleDuration / 2)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * (cycleDuration / Double(dotCount))),
                            value: animating
                        )
                }
            }
            .padding(.horizontal, Theme.spacingBase)
            .padding(.vertical, Theme.spacingSM)
            .background(Theme.cardBg)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Theme.borderLight, lineWidth: 1)
            )
            .accessibilityLabel(persona == nil ? "Typing indicator" : "\(persona!.name) is typing")
        }
        .onAppear { animating = true }
    }

    private var dotColor: Color {
        if let persona {
            return persona.color.opacity(0.8)
        }
        return Theme.textTertiary
    }
}

// MARK: - Preview

#Preview("Typing Indicator") {
    let persona = ChatPersona(
        id: "analyst",
        name: "Analyst",
        emoji: "?",
        description: "Deep thinker",
        colorHex: "#8fae8b"
    )

    VStack(spacing: Theme.spacingLG) {
        TypingIndicator(persona: nil)
        TypingIndicator(persona: persona)
    }
    .padding(Theme.spacingXL)
    .background(Theme.pageBg)
}
