import SwiftUI

struct FileChange: Hashable, Codable {
    let path: String
    let status: String
    let additions: Int
    let deletions: Int
    let content: String?
}

struct FileDetailModal: View {
    let files: [FileChange]
    @Binding var isPresented: Bool
    @State private var selectedFileIndex: Int = 0

    private var selectedFile: FileChange {
        guard selectedFileIndex >= 0, selectedFileIndex < files.count else {
            return files.first ?? FileChange(path: "", status: "", additions: 0, deletions: 0, content: nil)
        }
        return files[selectedFileIndex]
    }

    var body: some View {
        ZStack {
            Theme.textPrimary.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            HStack(spacing: 0) {
                fileListPane

                Rectangle()
                    .fill(Theme.borderLight)
                    .frame(width: 0.5)

                fileContentPane
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(40)
            .background(Theme.pageBg)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.2), radius: 30, y: 10)
            .padding(Theme.spacingXL)
        }
        .onAppear {
            selectedFileIndex = min(selectedFileIndex, max(files.count - 1, 0))
        }
        .onChange(of: files.count) { _ in
            selectedFileIndex = min(selectedFileIndex, max(files.count - 1, 0))
        }
        .onExitCommand {
            isPresented = false
        }
        .onKeyPress(.leftArrow) {
            guard !files.isEmpty else { return .ignored }
            selectedFileIndex = max(0, selectedFileIndex - 1)
            return .handled
        }
        .onKeyPress(.rightArrow) {
            guard !files.isEmpty else { return .ignored }
            selectedFileIndex = min(files.count - 1, selectedFileIndex + 1)
            return .handled
        }
        .onKeyPress(.escape) {
            isPresented = false
            return .handled
        }
    }

    // MARK: - File List Pane

    private var fileListPane: some View {
        VStack(spacing: 0) {
            Text("Files")
                .font(Typography.heading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Theme.spacingMD)

            RuleLine()

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(files.enumerated()), id: \.offset) { index, file in
                        Button(action: { selectedFileIndex = index }) {
                            HStack(spacing: Theme.spacingSM) {
                                Image(systemName: fileIcon(for: file.status))
                                    .foregroundColor(fileStatusColor(for: file.status))
                                    .frame(width: 16)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(fileName(from: file.path))
                                        .font(Typography.body)
                                        .foregroundColor(Theme.textPrimary)
                                        .lineLimit(1)

                                    Text(file.path)
                                        .font(Typography.caption)
                                        .foregroundColor(Theme.textTertiary)
                                        .lineLimit(1)
                                        .truncationMode(.head)
                                }

                                Spacer(minLength: Theme.spacingSM)

                                if file.additions > 0 || file.deletions > 0 {
                                    HStack(spacing: 2) {
                                        Text("+\(file.additions)")
                                            .foregroundColor(.green)
                                            .font(Typography.caption)

                                        Text("-\(file.deletions)")
                                            .foregroundColor(.red)
                                            .font(Typography.caption)
                                    }
                                }
                            }
                            .padding(.horizontal, Theme.spacingMD)
                            .padding(.vertical, Theme.spacingSM)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(selectedFileIndex == index ? Theme.blue.opacity(0.1) : .clear)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .background(Theme.sidebarBg)
        .frame(width: 240)
    }

    // MARK: - File Content Pane

    private var fileContentPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: Theme.spacingMD) {
                Text(selectedFile.path)
                    .font(Typography.caption.monospaced())
                    .foregroundColor(Theme.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)

                Spacer()

                Text("\(selectedFile.additions) additions, \(selectedFile.deletions) deletions")
                    .font(Typography.caption)
                    .foregroundColor(Theme.textTertiary)

                Button(action: { isPresented = false }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(Theme.textTertiary)
                        .font(.system(size: 16))
                }
                .buttonStyle(.plain)
            }
            .padding(Theme.spacingMD)

            RuleLine()

            ScrollView([.horizontal, .vertical]) {
                if let content = selectedFile.content {
                    CodeContentView(content: content)
                } else {
                    Text("Content not available")
                        .font(Typography.body)
                        .foregroundColor(Theme.textTertiary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(Theme.spacingLG)
                }
            }
            .background(Theme.pageBg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private func fileIcon(for status: String) -> String {
        switch status.lowercased() {
        case "added":
            return "plus.circle"
        case "modified":
            return "pencil.circle"
        case "deleted":
            return "minus.circle"
        default:
            return "doc.circle"
        }
    }

    private func fileStatusColor(for status: String) -> Color {
        switch status.lowercased() {
        case "added":
            return .green
        case "modified":
            return Theme.blue
        case "deleted":
            return .red
        default:
            return Theme.textSecondary
        }
    }

    private func fileName(from path: String) -> String {
        (path as NSString).lastPathComponent
    }
}

// MARK: - Code Content View

private struct CodeContentView: View {
    let content: String

    private var lines: [String] {
        content.components(separatedBy: "\n")
    }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .trailing, spacing: 0) {
                ForEach(1...max(lines.count, 1), id: \.self) { lineNumber in
                    Text("\(lineNumber)")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(Theme.textTertiary)
                        .frame(width: 40, alignment: .trailing)
                        .padding(.trailing, 8)
                        .padding(.vertical, 1)
                }
            }
            .background(Theme.sidebarBg)

            Rectangle()
                .fill(Theme.borderLight)
                .frame(width: 0.5)

            Text(content)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(Theme.textPrimary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Theme.spacingMD)
                .padding(.vertical, 1)
        }
    }
}

// MARK: - Local Typography

private enum Typography {
    static let heading = Font.system(size: 15, weight: .semibold)
    static let body = Font.system(size: 13.5)
    static let caption = Font.system(size: 11, weight: .medium)
}

// MARK: - Preview

struct FileDetailModal_Previews: PreviewProvider {
    static var previews: some View {
        FileDetailModal(
            files: [
                FileChange(
                    path: "Sources/Models/User.swift",
                    status: "modified",
                    additions: 12,
                    deletions: 3,
                    content: "import Foundation\n\nstruct User: Codable {\n    let id: UUID\n    let name: String\n    let email: String\n    var isActive: Bool\n\n    init(id: UUID = UUID(), name: String, email: String) {\n        self.id = id\n        self.name = name\n        self.email = email\n        self.isActive = true\n    }\n}"
                ),
                FileChange(
                    path: "Sources/Views/ProfileView.swift",
                    status: "added",
                    additions: 45,
                    deletions: 0,
                    content: "import SwiftUI\n\nstruct ProfileView: View {\n    let user: User\n\n    var body: some View {\n        VStack {\n            Text(user.name)\n            Text(user.email)\n        }\n    }\n}"
                ),
                FileChange(
                    path: "Sources/Legacy/OldAuth.swift",
                    status: "deleted",
                    additions: 0,
                    deletions: 87,
                    content: nil
                )
            ],
            isPresented: .constant(true)
        )
        .frame(width: 1000, height: 700)
    }
}
