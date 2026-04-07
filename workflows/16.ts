import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("16-settings-models")
  .description(
    "Create trail-viewer/Sources/Data/SettingsModels.swift — CLI info, availability, and app preferences",
  )
  .pattern("pipeline")
  .channel("wf-16-settings-models")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift data model architect",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "Swift implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a SettingsModels.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation

2. CLIInfo (struct, Codable, Identifiable, Hashable):
   - id computed as name (for Identifiable)
   - name: String (e.g., "claude", "codex")
   - version: String? (detected version string)
   - path: String (absolute path to the CLI executable)

3. CLIAvailability (struct, Codable, Identifiable, Hashable):
   - id computed as name
   - name: String
   - info: CLIInfo? (nil if not detected)
   - isSupportedForChat: Bool

   Computed:
   - isDetected: Bool { info != nil }
   - displayName: String — capitalize first letter of name
   - statusDescription: String — "v{version}" if detected, "Not found" otherwise

4. AppPreferences (struct, Codable, Hashable):
   - recentPaths: [String] = []
   - preferredCLI: String? = nil
   - showChatPanel: Bool = true
   - sidebarVisible: Bool = true
   - lastOpenedPath: String? = nil

   Static:
   - defaultPreferences: AppPreferences (all defaults)

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "CLIInfo" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Data/SettingsModels.swift from this spec:

{{steps.plan.output}}

Extract the SettingsModels.swift code and write it to trail-viewer/Sources/Data/SettingsModels.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/SettingsModels.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/SettingsModels.swift && git commit -m "feat: add SettingsModels.swift — CLI info, availability, and app preferences"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("16-settings-models:", result.status);
