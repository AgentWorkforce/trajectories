import SwiftUI

struct PersonaSelector: View {
    @EnvironmentObject var chatStore: ChatStore

    private var selectedPersona: ChatPersona? {
        guard let id = chatStore.selectedPersonaId else { return nil }
        return chatStore.personas.first { $0.id == id }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(chatStore.personas) { persona in
                        PersonaCard(
                            persona: persona,
                            isActive: chatStore.activePersonaIds.contains(persona.id),
                            onToggle: { chatStore.togglePersona(id: persona.id) }
                        )
                    }

                    Button(action: { chatStore.activateAllPersonas() }) {
                        Text("Ask all")
                            .font(Typography.caption)
                            .foregroundColor(Theme.blue)
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.vertical, 6)
                            .overlay(Capsule().stroke(Theme.blue, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Theme.spacingMD)
            }

            if let persona = selectedPersona {
                Text(persona.description)
                    .font(Typography.caption.italic())
                    .foregroundColor(Theme.textTertiary)
                    .padding(.horizontal, Theme.spacingMD)
                    .transition(.opacity)
                    .animation(.easeInOut(duration: 0.2), value: chatStore.selectedPersonaId)
            }

            RuleLine()
        }
        .padding(.vertical, Theme.spacingSM)
        .background(Theme.cardBg)
        .frame(maxHeight: 60)
    }
}

struct PersonaSelector_Previews: PreviewProvider {
    static var previews: some View {
        PersonaSelector()
            .environmentObject(ChatStore.preview)
            .previewLayout(.sizeThatFits)
    }
}
