import { workflow } from "@agent-relay/sdk/workflows";

/**
 * Spotlight Importer — macOS Spotlight indexes trajectory files.
 *
 * Pattern: pipeline (Claude plans the extension → Codex implements)
 *
 * Creates a Spotlight Importer extension target that indexes .json trajectory
 * files so users can search "JWT auth trajectory" or "payment decision" from
 * Spotlight and jump directly into Trail Viewer.
 *
 * Creates:
 *   trail-viewer/SpotlightImporter/Info.plist
 *   trail-viewer/SpotlightImporter/TrajectoryImporter.swift
 *   trail-viewer/Sources/Services/SpotlightRegistration.swift
 *
 * Also modifies:
 *   trail-viewer/Package.swift (add SpotlightImporter target)
 */
const result = await workflow("96-spotlight-importer")
  .description(
    "Add Spotlight indexing so trajectories are searchable from macOS Spotlight",
  )
  .pattern("dag")
  .channel("wf-96-spotlight")
  .maxConcurrency(3)
  .timeout(1_800_000)

  .agent("planner", {
    cli: "claude",
    role: "macOS Spotlight integration architect — expert in CSSearchableItem, UTType, and mdimporter",
    preset: "lead",
    retries: 2,
  })
  .agent("impl-1", {
    cli: "codex",
    role: "Swift macOS extension implementer",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-2", {
    cli: "codex",
    role: "Swift macOS extension implementer",
    preset: "worker",
    retries: 2,
  })

  .step("read-package", {
    type: "deterministic",
    command: "cat trail-viewer/Package.swift",
    captureOutput: true,
  })

  .step("plan", {
    agent: "planner",
    dependsOn: ["read-package"],
    task: `Design Spotlight integration for Trail Viewer. Output COMPLETE code for 3 files + Package.swift update.

Current Package.swift:
{{steps.read-package.output}}

Trail Viewer stores trajectories as JSON files in .trajectories/completed/YYYY-MM/traj_xxx.json.
Each trajectory has: id, task.title, task.description, status, tags[], agents[], chapters[].events[],
retrospective.summary, retrospective.learnings[], and decisions (nested in events).

We want Spotlight to index:
- Trajectory title (task.title) → kMDItemTitle
- Description (task.description) → kMDItemDescription
- Tags → kMDItemKeywords
- Agent names → kMDItemAuthors
- Status → kMDItemKind
- Decision questions and chosen answers → kMDItemTextContent (concatenated)
- Retrospective summary and learnings → kMDItemTextContent (appended)
- File path → for opening in Trail Viewer via URL scheme

When a user clicks a Spotlight result, it should open Trail Viewer and navigate to that trajectory.

Design these files:

FILE 1: SpotlightRegistration.swift (in main app Sources/Services/)
  Uses CoreSpotlight framework (CSSearchableIndex, CSSearchableItem, CSSearchableItemAttributeSet).

  class SpotlightRegistration:
    static func indexTrajectory(_ trajectory: Trajectory, at fileURL: URL)
      - Create CSSearchableItemAttributeSet with contentType .json
      - Set .title = trajectory.task.title
      - Set .contentDescription = trajectory.task.description ?? trajectory.retrospective?.summary
      - Set .keywords = trajectory.tags + agent names
      - Set .authorNames = trajectory.agents.map { $0.name }
      - Set .textContent = concatenation of:
          - All decision questions + chosen answers
          - Retrospective summary + learnings
          - Chapter titles
      - Set .relatedUniqueIdentifier = trajectory.id
      - Set .thumbnailData = generate a small trajectory icon (optional)
      - Create CSSearchableItem with uniqueIdentifier = trajectory.id,
        domainIdentifier = "com.trailviewer.trajectories"
      - Index via CSSearchableIndex.default().indexSearchableItems()

    static func indexAllTrajectories(from directory: URL) async
      - Walk .trajectories/ directory
      - Parse each JSON as Trajectory
      - Index each one
      - Log count indexed

    static func removeTrajectory(_ id: String)
      - CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: [id])

    static func removeAllTrajectories()
      - deleteSearchableItems(withDomainIdentifiers: ["com.trailviewer.trajectories"])

    static func handleSpotlightActivity(_ userActivity: NSUserActivity) -> String?
      - Check userActivity.activityType == CSSearchableItemActionType
      - Extract trajectory ID from userActivity.userInfo?[CSSearchableItemActivityIdentifier]
      - Return the trajectory ID for navigation

  Also register for CSSearchableItemActionType in the app's .onContinueUserActivity handler
  so clicking a Spotlight result opens the trajectory.

FILE 2: Info.plist for Spotlight metadata
  A simple Info.plist that declares the app handles:
  - com.apple.CoreSpotlight.ContinueSearchAction
  - UTType for .json files in .trajectories/ directories
  NOTE: For a pure SwiftUI SPM app, this may be handled via the app's
  Info.plist or .entitlements rather than a separate importer extension.
  Design the simplest approach that works with Swift Package Manager.

FILE 3: Updated Package.swift
  Add CoreSpotlight framework dependency to the main target:
  - .linkedFramework("CoreSpotlight")
  The app will do the indexing itself on launch (no separate extension needed
  for SPM-based apps — mdimporter extensions require Xcode projects).

OUTPUT: Complete Swift code for SpotlightRegistration.swift,
the Package.swift diff/update, and any Info.plist content needed.

Prefer the IN-APP indexing approach (SpotlightRegistration called on launch)
over a separate mdimporter extension, since we're using SPM not Xcode.`,
    verification: { type: "output_contains", value: "SpotlightRegistration" },
  })

  .step("impl-spotlight", {
    agent: "impl-1",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Services/SpotlightRegistration.swift from this spec:

{{steps.plan.output}}

Extract the SpotlightRegistration.swift code and write it to disk.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/SpotlightRegistration.swift",
    },
  })

  .step("impl-package-update", {
    agent: "impl-2",
    dependsOn: ["plan"],
    task: `Update trail-viewer/Package.swift to add CoreSpotlight framework based on this spec:

{{steps.plan.output}}

Read the current Package.swift, apply the changes described in the spec,
and write the updated file.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only edit this one file.`,
    verification: { type: "exit_code" },
  })

  .step("verify", {
    type: "deterministic",
    dependsOn: ["impl-spotlight", "impl-package-update"],
    command: `test -f trail-viewer/Sources/Services/SpotlightRegistration.swift && grep -q "CoreSpotlight" trail-viewer/Package.swift && echo "Spotlight integration files present"`,
    failOnError: true,
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["verify"],
    command:
      'cd trail-viewer && git add Sources/Services/SpotlightRegistration.swift Package.swift && git commit -m "feat: add Spotlight indexing — trajectories searchable from macOS Spotlight"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("96-spotlight-importer:", result.status);
