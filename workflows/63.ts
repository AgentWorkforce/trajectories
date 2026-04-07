import { workflow } from "@agent-relay/sdk/workflows";

/**
 * Wave 15 — App integration via HUB-SPOKE pattern.
 *
 * Pattern: HUB-SPOKE — Claude integration lead stays alive as persistent
 * coordinator. Workers implement files, lead reviews and adjusts.
 *
 * This replaces 4 separate pipelines (old 63-66) because:
 * - Integration is coordinative — lead must see ContentView before writing App
 * - Files have tight coupling (StatusBar→ContentView→TrailViewerApp)
 * - Live coordinator catches integration mismatches early
 * - Lead reviews final wiring and can fix issues
 *
 * Creates: StatusBar.swift, KeyboardShortcuts.swift, ContentView.swift (rewrite),
 *          TrailViewerApp.swift (rewrite)
 */

const result = await workflow("63-app-integration-hubspoke")
  .description(
    "Hub-spoke: integration lead coordinates wiring all views together",
  )
  .pattern("hub-spoke")
  .channel("wf-63-integration")
  .maxConcurrency(4)
  .timeout(3_600_000)

  .agent("planner", {
    cli: "claude",
    role: "Integration planner — designs the wiring spec with clean stdout",
    preset: "lead",
    retries: 2,
  })
  .agent("reviewer", {
    cli: "claude",
    role: "Integration reviewer — reads files, verifies wiring, fixes issues",
    preset: "lead",
    retries: 2,
  })
  .agent("impl-1", {
    cli: "codex",
    role: "SwiftUI integration implementer",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-2", {
    cli: "codex",
    role: "SwiftUI integration implementer",
    preset: "worker",
    retries: 2,
  })

  .step("read-existing", {
    type: "deterministic",
    command: `echo "=== ContentView ===" && cat trail-viewer/Sources/ContentView.swift 2>/dev/null || echo "(not found)" && echo "=== TrailViewerApp ===" && cat trail-viewer/Sources/TrailViewerApp.swift 2>/dev/null || echo "(not found)" && echo "=== Available Views ===" && find trail-viewer/Sources/Views -name "*.swift" -type f 2>/dev/null | sort`,
    captureOutput: true,
  })

  .step("plan-integration", {
    agent: "planner",
    dependsOn: ["read-existing"],
    task: `You are the integration lead. Plan COMPLETE Swift code for 4 files that wire the entire app.

Current state:\n{{steps.read-existing.output}}

DESIGN: Light-mode book aesthetic. Warm paper, serif headings, pastel blue + yellow.

FILE 1: StatusBar.swift — Bottom bar (28pt). Left: connection dot + status. Center: trajectory count. Right: "⌘K Search · ⌘⇧C Chat". sidebarBg, thin top border.

FILE 2: KeyboardShortcuts.swift — Notification.Name: .toggleChatPanel, .showCommandPalette, .toggleSidebar, .refreshTrajectories, .showSettings. ViewModifier that listens + updates state.

FILE 3: ContentView.swift (REWRITE) — Three-column NavigationSplitView. Sidebar: TrajectoryListView. Content: TrajectoryDetailView or WelcomeView. Trailing: ChatPanelView (conditional). StatusBar via .safeAreaInset. CommandPalette overlay. Toolbar + keyboard shortcuts.

FILE 4: TrailViewerApp.swift (REWRITE) — All stores as @State. .environment() injection. ToastContainer overlay. On appear: start server, refresh CLIs, load data. Full menu bar with CLI picker, shortcuts.

DEPENDENCY ORDER: StatusBar + Shortcuts first (parallel), then ContentView (uses both), then App (uses ContentView).

Output ALL 4 files with clear markers.

IMPORTANT: Write your complete output to the file .relay/specs/63-integration.md on disk. This ensures clean handoff to the implementers.`,
    verification: {
      type: "file_exists",
      value: ".relay/specs/63-integration.md",
    },
  })

  .step("read-spec", {
    type: "deterministic",
    dependsOn: ["plan-integration"],
    command: "cat .relay/specs/63-integration.md",
    captureOutput: true,
  })

  // StatusBar + KeyboardShortcuts (parallel — no dependencies on each other)
  .step("impl-status-bar", {
    agent: "impl-1",
    dependsOn: ["read-spec"],
    task: "Create trail-viewer/Sources/Views/StatusBar.swift from spec:\n\n{{steps.read-spec.output}}\n\nWrite to disk. Only this one file.",
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/StatusBar.swift",
    },
  })

  .step("impl-keyboard", {
    agent: "impl-2",
    dependsOn: ["read-spec"],
    task: "Create trail-viewer/Sources/Services/KeyboardShortcuts.swift from spec:\n\n{{steps.read-spec.output}}\n\nWrite to disk. Only this one file.",
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Services/KeyboardShortcuts.swift",
    },
  })

  // ContentView depends on StatusBar + KeyboardShortcuts
  .step("impl-content-view", {
    agent: "impl-1",
    dependsOn: ["impl-status-bar", "impl-keyboard"],
    task: "OVERWRITE trail-viewer/Sources/ContentView.swift from spec:\n\n{{steps.read-spec.output}}\n\nExtract the REWRITE version. Replace existing file.",
    verification: { type: "exit_code" },
  })

  // TrailViewerApp depends on ContentView
  .step("impl-app-entry", {
    agent: "impl-2",
    dependsOn: ["impl-content-view"],
    task: "OVERWRITE trail-viewer/Sources/TrailViewerApp.swift from spec:\n\n{{steps.read-spec.output}}\n\nExtract the REWRITE version. Replace existing file.",
    verification: { type: "exit_code" },
  })

  // Hub reviews the integration
  .step("review", {
    agent: "reviewer",
    dependsOn: ["impl-app-entry"],
    task: `Review the integration. Read these 4 files and verify they're wired correctly:
1. trail-viewer/Sources/Views/StatusBar.swift
2. trail-viewer/Sources/Services/KeyboardShortcuts.swift
3. trail-viewer/Sources/ContentView.swift
4. trail-viewer/Sources/TrailViewerApp.swift

Check: @Environment injections match, keyboard shortcuts consistent, imports correct.
If anything is wrong, fix the file directly. If good, confirm "INTEGRATION_VERIFIED".`,
    verification: { type: "output_contains", value: "INTEGRATION_VERIFIED" },
  })

  .step("verify-files", {
    type: "deterministic",
    dependsOn: ["review"],
    command: `cd trail-viewer && for f in Sources/Views/StatusBar.swift Sources/Services/KeyboardShortcuts.swift Sources/ContentView.swift Sources/TrailViewerApp.swift; do if [ ! -f "$f" ]; then echo "MISSING: $f"; exit 1; fi; done && echo "All integration files present"`,
    failOnError: true,
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["verify-files"],
    command:
      'cd trail-viewer && git add -A && git commit -m "feat: wire all views — hub-spoke integration with lead review"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("63-app-integration-hubspoke:", result.status);
