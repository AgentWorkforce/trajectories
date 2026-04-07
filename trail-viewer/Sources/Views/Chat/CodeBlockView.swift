import AppKit
import SwiftUI

// Monospace code block on a warm surface with language label and copy action.
struct CodeBlockView: View {
    let code: String
    let language: String

    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: Theme.spacingSM) {
                Text(language.isEmpty ? "plain text" : language.lowercased())
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.textTertiary)
                    .textCase(.uppercase)
                    .tracking(0.5)

                Spacer()

                Button(action: copyCode) {
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10))
                        Text(copied ? "Copied" : "Copy")
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundStyle(copied ? Theme.success : Theme.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Theme.spacingBase)
            .padding(.vertical, Theme.spacingSM)
            .background(Theme.sidebarBg.opacity(0.7))

            ScrollView(.horizontal, showsIndicators: false) {
                Text(code)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Theme.textPrimary)
                    .lineSpacing(4)
                    .textSelection(.enabled)
                    .padding(Theme.spacingBase)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(Theme.sidebarBg)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusMD)
                .stroke(Theme.borderLight, lineWidth: 1)
        )
        .animation(.easeInOut(duration: 0.2), value: copied)
    }

    private func copyCode() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        copied = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            copied = false
        }
    }
}

// MARK: - Preview

struct CodeBlockView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: Theme.spacingMD) {
            CodeBlockView(
                code: """
                func greet(_ name: String) -> String {
                    return "Hello, \\(name)!"
                }
                """,
                language: "swift"
            )

            CodeBlockView(
                code: "npm install @agent/sdk",
                language: ""
            )
        }
        .padding(Theme.spacingLG)
        .frame(width: 420)
        .background(Theme.pageBg)
    }
}
