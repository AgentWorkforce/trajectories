import SwiftUI

// MARK: - CLISettingsView

struct CLISettingsView: View {
    @EnvironmentObject var cliSettingsStore: CLISettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.spacingLG) {
            SectionHeader(title: "AI Assistant", icon: "cpu")

            BookCard {
                VStack(alignment: .leading, spacing: Theme.spacingMD) {
                    Text("Preferred CLI")
                        .font(Typography.body.bold())
                        .foregroundColor(Theme.textPrimary)

                    Button(action: {
                        cliSettingsStore.setPreferredCLI(nil)
                    }) {
                        HStack(spacing: Theme.spacingBase) {
                            Image(systemName: cliSettingsStore.preferredCLI == nil ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(cliSettingsStore.preferredCLI == nil ? Theme.blue : Theme.textTertiary)
                                .font(.system(size: 18))

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Automatic")
                                    .font(Typography.body)
                                    .foregroundColor(Theme.textPrimary)

                                if let automaticCLI {
                                    Text("Currently using \(displayName(for: automaticCLI.name))")
                                        .font(Typography.caption)
                                        .foregroundColor(Theme.textTertiary)
                                }
                            }

                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    ForEach(preferredCLIChoices) { cli in
                        Button(action: {
                            cliSettingsStore.setPreferredCLI(cli.name)
                        }) {
                            HStack(spacing: Theme.spacingBase) {
                                Image(systemName: cliSettingsStore.preferredCLI == cli.name ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(cliSettingsStore.preferredCLI == cli.name ? Theme.blue : Theme.textTertiary)
                                    .font(.system(size: 18))

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(displayName(for: cli.name))
                                        .font(Typography.body)
                                        .foregroundColor(Theme.textPrimary)

                                    HStack(spacing: Theme.spacingSM) {
                                        if let version = cli.version {
                                            Text("v\(version)")
                                                .font(Typography.caption)
                                                .foregroundColor(Theme.textTertiary)
                                        }

                                        if !cli.path.isEmpty {
                                            Text(cli.path)
                                                .font(Typography.caption)
                                                .foregroundColor(Theme.textTertiary)
                                                .lineLimit(1)
                                                .truncationMode(.middle)
                                        }
                                    }
                                }

                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            BookCard {
                VStack(alignment: .leading, spacing: Theme.spacingBase) {
                    Text("Detected CLIs")
                        .font(Typography.body.bold())
                        .foregroundColor(Theme.textPrimary)

                    ForEach(cliSettingsStore.availability) { availability in
                        HStack(spacing: Theme.spacingSM) {
                            Circle()
                                .fill(availability.isDetected ? Theme.success : Theme.error)
                                .frame(width: 8, height: 8)

                            Text(availability.displayName)
                                .font(Typography.body)
                                .foregroundColor(Theme.textPrimary)

                            Spacer()

                            if availability.isDetected {
                                Text(availability.info?.version ?? "unknown")
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.textTertiary)
                            } else {
                                Text("not installed")
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.textTertiary)
                            }

                            if availability.isSupportedForChat {
                                Text("Supported for chat")
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.blue)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Theme.blue.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }

            Button(action: {
                Task {
                    await cliSettingsStore.refreshDetectedCLIs()
                }
            }) {
                HStack(spacing: 6) {
                    if cliSettingsStore.isRefreshing {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Theme.blue)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }

                    Text("Refresh Detection")
                }
                .font(Typography.body)
                .foregroundColor(Theme.blue)
            }
            .buttonStyle(.plain)
            .disabled(cliSettingsStore.isRefreshing)
        }
        .padding(Theme.spacingMD)
    }

    private var automaticCLI: CLIInfo? {
        guard let effectiveCLI = cliSettingsStore.effectiveCLI else {
            return nil
        }
        return cliSettingsStore.detectedCLIs.first { $0.name == effectiveCLI }
    }

    private var preferredCLIChoices: [CLIInfo] {
        cliSettingsStore.detectedCLIs.filter { cli in
            CLISettingsStore.supportedChatCLIs.contains(cli.name)
        }
    }

    private func displayName(for name: String) -> String {
        guard let first = name.first else { return name }
        return String(first).uppercased() + name.dropFirst()
    }
}

// MARK: - Preview

struct CLISettingsView_Previews: PreviewProvider {
    static var previews: some View {
        CLISettingsView()
            .environmentObject(CLISettingsStore())
            .frame(width: 500)
            .padding()
    }
}
