import SwiftUI

// MARK: - Persona Card

struct PersonaCard: View {
    let persona: ChatPersona
    let isActive: Bool
    var compact: Bool = false

    var body: some View {
        HStack(spacing: compact ? 3 : Theme.spacingXS) {
            Text(persona.emoji)
                .font(.system(size: compact ? 11 : 13))

            Text(persona.name)
                .caption()
                .font(nameFont)
                .foregroundStyle(nameColor)
                .lineLimit(1)
        }
        .padding(.horizontal, compact ? Theme.spacingSM : Theme.spacingBase)
        .padding(.vertical, compact ? 3 : Theme.spacingXS)
        .background(backgroundColor)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(borderColor, lineWidth: 1)
        )
        .opacity(isActive ? 1.0 : 0.6)
        .animation(.easeInOut(duration: 0.2), value: isActive)
    }

    private var nameFont: Font {
        .system(
            size: compact ? 10 : 11,
            weight: isActive ? .semibold : .medium
        )
    }

    private var nameColor: Color {
        isActive ? Theme.textPrimary : Theme.textTertiary
    }

    private var backgroundColor: Color {
        isActive
            ? persona.color.opacity(0.12)
            : Theme.sidebarBg.opacity(0.5)
    }

    private var borderColor: Color {
        isActive
            ? persona.color.opacity(0.35)
            : Theme.borderLight
    }
}

// MARK: - Preview

#if false // Disabled: #Preview requires Xcode
#Preview("Persona Cards") {
    let personas = [
        ChatPersona(id: "critic", name: "Critic", emoji: "?", description: "", colorHex: "#c87f6b"),
        ChatPersona(id: "historian", name: "Historian", emoji: "?", description: "", colorHex: "#7eb8da"),
        ChatPersona(id: "analyst", name: "Analyst", emoji: "?", description: "", colorHex: "#8fae8b")
    ]

    HStack(spacing: Theme.spacingSM) {
        ForEach(personas) { persona in
            PersonaCard(persona: persona, isActive: persona.id == "historian")
        }
    }
    .padding(Theme.spacingLG)
    .background(Theme.pageBg)
}
#endif
