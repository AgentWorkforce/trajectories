import SwiftUI

struct PersonaSelector: View {
    @EnvironmentObject var chatStore: ChatStore

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingSM) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.spacingSM) {
                    ForEach(chatStore.personas) { persona in
                        PersonaCard(
                            persona: persona,
                            isActive: chatStore.activePersonas.contains(persona.id)
                        )
                        .onTapGesture {
                            chatStore.togglePersona(persona.id)
                        }
                    }

                    Button(action: {
                        for persona in chatStore.personas {
                            if !chatStore.activePersonas.contains(persona.id) {
                                chatStore.togglePersona(persona.id)
                            }
                        }
                    }) {
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
            .environmentObject(ChatStore())
            .previewLayout(.sizeThatFits)
    }
}
