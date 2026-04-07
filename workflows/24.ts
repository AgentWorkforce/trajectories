import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("24-cli-settings-store")
  .description(
    "Create trail-viewer/Sources/Data/CLISettingsStore.swift — CLI preferences with UserDefaults persistence",
  )
  .pattern("pipeline")
  .channel("wf-24-cli-settings-store")
  .maxConcurrency(2)
  .timeout(1_200_000)

  .agent("planner", {
    cli: "claude",
    role: "Swift state management architect",
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
    task: `Output the COMPLETE contents of a CLISettingsStore.swift file for the Trail Viewer macOS app.

Requirements:

1. Import Foundation
2. Import SwiftUI (for @Observable and @MainActor)

3. @MainActor @Observable class CLISettingsStore:

   Static:
   - supportedChatCLIs: [String] = ["claude", "codex", "opencode", "gemini", "aider"]
   - userDefaultsKey = "CLISettingsStore.preferredCLI"
   - detectedCLIsKey = "CLISettingsStore.detectedCLIs"

   Properties:
   - private(set) var detectedCLIs: [CLIInfo] = []
   - var preferredCLI: String? (backed by UserDefaults — read/write through didSet calling persistPreferredCLI())
   - private(set) var isRefreshing: Bool = false

   Computed:

   detectedChatCLIs: [CLIInfo]
   - detectedCLIs filtered to those whose name is in supportedChatCLIs

   effectiveCLI: String?
   - If preferredCLI is set and is in detectedChatCLIs names, return it
   - Otherwise return first detected chat CLI name, or nil

   effectiveCLILabel: String
   - If effectiveCLI is not nil, capitalize first letter and return
   - Otherwise return "None detected"

   availability: [CLIAvailability]
   - Map CLIDetector.knownCLIs to CLIAvailability:
     - For each CLI name, check if it exists in detectedCLIs
     - isSupportedForChat = supportedChatCLIs.contains(name)

   Methods:

   init():
   - Load preferredCLI from UserDefaults
   - Load cached detectedCLIs from UserDefaults (stored as JSON Data)

   setPreferredCLI(_ cli: String?):
   - preferredCLI = cli
   - Persist to UserDefaults

   refreshDetectedCLIs() async:
   - Set isRefreshing = true
   - let detected = await CLIDetector.detectAll()
   - detectedCLIs = detected
   - Cache to UserDefaults as JSON Data
   - Reconcile: if preferredCLI is set but no longer in detected, clear it
   - Set isRefreshing = false

   Private persistPreferredCLI():
   - Save preferredCLI to UserDefaults (nil removes the key)

   Private loadCachedCLIs():
   - Read JSON Data from UserDefaults, decode to [CLIInfo]
   - On failure, return empty array

Output the full file contents ready to write to disk.`,
    verification: { type: "output_contains", value: "CLISettingsStore" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Data/CLISettingsStore.swift from this spec:

{{steps.plan.output}}

Extract the CLISettingsStore.swift code and write it to trail-viewer/Sources/Data/CLISettingsStore.swift.
Create the trail-viewer/Sources/Data directory if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Data/CLISettingsStore.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Data/CLISettingsStore.swift && git commit -m "feat: add CLISettingsStore.swift — CLI preferences with UserDefaults persistence"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("24-cli-settings-store:", result.status);
