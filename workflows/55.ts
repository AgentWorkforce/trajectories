import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("55-persona-selector")
  .description(
    "Create trail-viewer/Sources/Views/Chat/PersonaSelector.swift — horizontal persona picker with Ask All button",
  )
  .pattern("pipeline")
  .channel("wf-55-persona-selector")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "SwiftUI component designer",
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
    task: `Output the COMPLETE contents of a SwiftUI file: PersonaSelector.swift for the Trail Viewer macOS app.

Design direction: "The Beautiful Notebook" — LIGHT MODE, book-like reading experience.

Requirements:
- Import SwiftUI
- Define struct PersonaSelector: View
- @EnvironmentObject var chatStore: ChatStore
- Reads from chatStore:
  - personas: [ChatPersona] — all available personas
  - activePersonaIds: Set<String> — currently active persona IDs
  - selectedPersonaId: String? — the persona whose description is shown
  - togglePersona(id:) — toggles a persona active/inactive
  - activateAllPersonas() — activates all personas
- Layout:
  - VStack(alignment: .leading, spacing: Theme.spacingSM ~8pt):
    1. ScrollView(.horizontal, showsIndicators: false):
       - HStack(spacing: Theme.spacingSM):
         - ForEach(chatStore.personas) { persona in
             PersonaCard(
               persona: persona,
               isActive: chatStore.activePersonaIds.contains(persona.id),
               onToggle: { chatStore.togglePersona(id: persona.id) }
             )
           }
         - "Ask all" button at the end:
           - Button(action: { chatStore.activateAllPersonas() }):
             - Text("Ask all")
             - .font(Typography.caption)
             - .foregroundColor(Theme.blue)
             - .padding(.horizontal, Theme.spacingMD)
             - .padding(.vertical, 6)
             - .overlay(Capsule().stroke(Theme.blue, lineWidth: 1))
           - .buttonStyle(.plain)
       - .padding(.horizontal, Theme.spacingMD)
    2. If there is a selected persona (chatStore.selectedPersonaId), show description:
       - Text(selected persona's description)
       - .font(Typography.caption.italic())
       - .foregroundColor(Theme.textTertiary)
       - .padding(.horizontal, Theme.spacingMD)
       - .transition(.opacity) with animation
    3. RuleLine() at the bottom
  - Background: Theme.cardBg
  - .frame(maxHeight: 60) — compact height
  - Padding: vertical spacingSM
- Assume Theme, Typography, PersonaCard, RuleLine, ChatStore, ChatPersona are available
- Add a PreviewProvider

Output the COMPLETE Swift file ready to write to disk.`,
    verification: { type: "output_contains", value: "PersonaSelector" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/Sources/Views/Chat/PersonaSelector.swift from this spec:

{{steps.plan.output}}

Extract the Swift code and write it to trail-viewer/Sources/Views/Chat/PersonaSelector.swift.
Create the directory trail-viewer/Sources/Views/Chat/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Chat/PersonaSelector.swift",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add Sources/Views/Chat/PersonaSelector.swift && git commit -m "feat: add PersonaSelector — horizontal persona picker with Ask All button"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("55-persona-selector:", result.status);
