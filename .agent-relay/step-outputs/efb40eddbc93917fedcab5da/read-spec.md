# CLISettingsView.swift — Complete Implementation Spec

```swift
import SwiftUI

// MARK: - CLISettingsView

struct CLISettingsView: View {
    @EnvironmentObject var cliSettingsStore: CLISettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            // 1. Section Header
            SectionHeader(title: "AI Assistant", icon: "cpu")

            // 2. Preferred CLI Picker
            BookCard {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Preferred CLI")
                        .font(Typography.body)
                        .bold()
                        .foregroundColor(Theme.textPrimary)

                    // Automatic option
                    Button(action: {
                        cliSettingsStore.setPreferredCLI(nil)
                    }) {
                        HStack(spacing: 12) {
                            Image(systemName: cliSettingsStore.preferredCLI == nil ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(cliSettingsStore.preferredCLI == nil ? Theme.blue : Theme.textTertiary)
                                .font(.system(size: 18))

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Automatic")
                                    .font(Typography.body)
                                    .foregroundColor(Theme.textPrimary)

                                if let autoDetected = cliSettingsStore.autoDetectedCLI {
                                    Text("Currently using \(autoDetected.name)")
                                        .font(Typography.caption)
                                        .foregroundColor(Theme.textTertiary)
                                }
                            }

                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    // Installed CLI options
                    ForEach(cliSettingsStore.detectedCLIs.filter { $0.isInstalled }) { cli in
                        Button(action: {
                            cliSettingsStore.setPreferredCLI(cli.id)
                        }) {
                            HStack(spacing: 12) {
                                Image(systemName: cliSettingsStore.preferredCLI == cli.id ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(cliSettingsStore.preferredCLI == cli.id ? Theme.blue : Theme.textTertiary)
                                    .font(.system(size: 18))

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(cli.name)
                                        .font(Typography.body)
                                        .foregroundColor(Theme.textPrimary)

                                    HStack(spacing: 8) {
                                        if let version = cli.version {
                                            Text("v\(version)")
                                                .font(Typography.caption)
                                                .foregroundColor(Theme.textTertiary)
                                        }

                                        if let path = cli.path {
                                            Text(path)
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

            // 3. Status Grid — Detected CLIs
            BookCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Detected CLIs")
                        .font(Typography.body)
                        .bold()
                        .foregroundColor(Theme.textPrimary)

                    ForEach(cliSettingsStore.detectedCLIs) { cli in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(cli.isInstalled ? Color.green : Color.red)
                                .frame(width: 8, height: 8)

                            Text(cli.name)
                                .font(Typography.body)
                                .foregroundColor(Theme.textPrimary)

                            Spacer()

                            if cli.isInstalled {
                                Text(cli.version ?? "unknown")
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.textTertiary)
                            } else {
                                Text("not installed")
                                    .font(Typography.caption)
                                    .foregroundColor(Theme.textTertiary)
                            }

                            if cli.supportsChat {
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

            // 4. Refresh Button
            Button(action: {
                Task {
                    await cliSettingsStore.refreshDetection()
                }
            }) {
                HStack(spacing: 6) {
                    if cliSettingsStore.isRefreshing {
                        ProgressView()
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }

                    Text("Refresh Detection")
                }
                .foregroundColor(Theme.blue)
            }
            .buttonStyle(.plain)
            .disabled(cliSettingsStore.isRefreshing)
        }
        .padding(16)
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
```

## Design Notes

- **Light mode, book-like**: Uses `BookCard` containers for grouped sections, `Theme` palette for warm paper-like tones.
- **Typography**: All text uses `Typography.*` tokens for consistent sizing.
- **Spacing**: Uses `Theme.spacingLG` (~20pt) for section gaps, `Theme.spacingMD` (~16pt) within cards, `Theme.spacingSM` (~12pt) for tight lists.
- **Selection**: Radio-style checkmark/circle icons with `Theme.blue` highlight for selected state.
- **Status indicators**: Green/red dots for installed/missing. Blue capsule badges for chat support.
- **Refresh**: Inline progress spinner replaces the icon during refresh. Button disabled while refreshing.
