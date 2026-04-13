import SwiftUI

// MARK: - ChatInputBar

struct ChatInputBar: View {
    @Binding var text: String
    let onSend: (String) -> Void
    let isConnected: Bool

    @FocusState private var isFocused: Bool

    private let minHeight: CGFloat = 36
    private let maxHeight: CGFloat = 120

    var body: some View {
        HStack(alignment: .bottom, spacing: Theme.spacingSM) {
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("Add a margin note...")
                        .font(.system(size: 13.5))
                        .foregroundColor(Theme.textTertiary)
                        .padding(.horizontal, Theme.spacingSM)
                        .padding(.vertical, Theme.spacingSM)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $text)
                    .font(.system(size: 13.5))
                    .foregroundColor(Theme.textPrimary)
                    .scrollContentBackground(.hidden)
                    .focused($isFocused)
                    .frame(minHeight: minHeight, maxHeight: maxHeight)
            }
            .padding(.horizontal, Theme.spacingSM)
            .padding(.vertical, Theme.spacingXS)
            .background(Theme.cardBg)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLG))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radiusLG)
                    .stroke(
                        isFocused ? Theme.blue.opacity(0.5) : Theme.border,
                        lineWidth: 1
                    )
            )
            .animation(.easeInOut(duration: 0.15), value: isFocused)

            Button(action: sendMessage) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 28))
                    .foregroundColor(canSend ? Theme.blue : Theme.borderLight)
                    .symbolRenderingMode(.hierarchical)
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .keyboardShortcut(.return, modifiers: .command)
        }
        .padding(.horizontal, Theme.spacingMD)
        .padding(.vertical, Theme.spacingBase)
        .background(Theme.pageBg)
        .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: -2)
    }

    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && isConnected
    }

    private func sendMessage() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, isConnected else { return }
        onSend(trimmed)
        text = ""
    }
}

// MARK: - Preview

struct ChatInputBar_Previews: PreviewProvider {
    struct PreviewWrapper: View {
        @State private var text = ""

        var body: some View {
            VStack {
                Spacer()
                ChatInputBar(
                    text: $text,
                    onSend: { message in
                        print("Sent: \(message)")
                    },
                    isConnected: true
                )
            }
            .frame(width: 420, height: 200)
            .background(Theme.pageBg)
        }
    }

    static var previews: some View {
        PreviewWrapper()
    }
}
