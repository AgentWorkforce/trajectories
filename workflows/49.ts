import { workflow } from "@agent-relay/sdk/workflows";

/**
 * Wave 12 — ALL 6 chat components in a single fan-out workflow.
 *
 * Pattern: FAN-OUT — One Claude designer plans all 6 chat components,
 * then 3 Codex workers implement 2 files each in parallel.
 *
 * This replaces 6 separate pipelines (old 49-54) because:
 * - Components are independent (no cross-dependencies)
 * - One design pass ensures consistent chat UX language
 * - Shared channel lets workers see each other's file paths for imports
 *
 * Creates (6 files):
 *   Chat/MarkdownRenderer.swift, Chat/CodeBlockView.swift,
 *   Chat/TypingIndicator.swift, Chat/PersonaCard.swift,
 *   Chat/ChatBubble.swift, Chat/ChatInputBar.swift
 */

const DESIGN_BRIEF = `
DESIGN: Chat panel = margin notes area, study group discussing the book.
Light and bookish, NOT like Slack. Persona colors for agents, pastel blue for user.
`;

const result = await workflow("49-chat-components-fanout")
  .description(
    "Fan-out: design all 6 chat components together, implement in parallel",
  )
  .pattern("fan-out")
  .channel("wf-49-chat-components")
  .maxConcurrency(4)
  .timeout(2_400_000)

  .agent("designer", {
    cli: "claude",
    role: "Chat UX designer — designs all 6 components for consistent experience",
    preset: "lead",
    retries: 2,
  })
  .agent("impl-1", {
    cli: "codex",
    role: "SwiftUI implementer (Markdown + CodeBlock)",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-2", {
    cli: "codex",
    role: "SwiftUI implementer (Typing + PersonaCard)",
    preset: "worker",
    retries: 2,
  })
  .agent("impl-3", {
    cli: "codex",
    role: "SwiftUI implementer (ChatBubble + InputBar)",
    preset: "worker",
    retries: 2,
  })

  .step("design-all", {
    agent: "designer",
    task: `Design ALL 6 chat components. Output COMPLETE Swift code for all 6 files.

${DESIGN_BRIEF}

FILE 1: MarkdownRenderer.swift — markdown → AttributedString. **bold**, *italic*, \`code\`, \`\`\`blocks\`\`\`, [links](url).
FILE 2: CodeBlockView.swift — Monospace on sidebarBg, copy button, language label.
FILE 3: TypingIndicator.swift — 3 dots, opacity pulse 1.2s staggered.
FILE 4: PersonaCard.swift — Capsule pill, emoji+name, active/inactive states.
FILE 5: ChatBubble.swift — User (right, blueMuted) vs Agent (left, cardBg, persona border).
FILE 6: ChatInputBar.swift — Multi-line TextEditor, send button, Cmd+Enter.

All use Theme, Typography. Assume ChatMessage, ChatPersona models exist. Include Previews.
Output ALL 6 files with clear markers.`,
    verification: { type: "output_contains", value: "ChatBubble" },
  })

  .step("impl-markdown", {
    agent: "impl-1",
    dependsOn: ["design-all"],
    task: "Create 2 files from spec:\n\n{{steps.design-all.output}}\n\n1. trail-viewer/Sources/Views/Chat/MarkdownRenderer.swift\n2. trail-viewer/Sources/Views/Chat/CodeBlockView.swift\n\nWrite BOTH to disk. Do NOT output to stdout.",
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Chat/MarkdownRenderer.swift",
    },
  })

  .step("impl-indicators", {
    agent: "impl-2",
    dependsOn: ["design-all"],
    task: "Create 2 files from spec:\n\n{{steps.design-all.output}}\n\n1. trail-viewer/Sources/Views/Chat/TypingIndicator.swift\n2. trail-viewer/Sources/Views/Chat/PersonaCard.swift\n\nWrite BOTH to disk. Do NOT output to stdout.",
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Chat/PersonaCard.swift",
    },
  })

  .step("impl-bubbles", {
    agent: "impl-3",
    dependsOn: ["design-all"],
    task: "Create 2 files from spec:\n\n{{steps.design-all.output}}\n\n1. trail-viewer/Sources/Views/Chat/ChatBubble.swift\n2. trail-viewer/Sources/Views/Chat/ChatInputBar.swift\n\nWrite BOTH to disk. Do NOT output to stdout.",
    verification: {
      type: "file_exists",
      value: "trail-viewer/Sources/Views/Chat/ChatBubble.swift",
    },
  })

  .step("verify-all", {
    type: "deterministic",
    dependsOn: ["impl-markdown", "impl-indicators", "impl-bubbles"],
    command: `cd trail-viewer && for f in Sources/Views/Chat/MarkdownRenderer.swift Sources/Views/Chat/CodeBlockView.swift Sources/Views/Chat/TypingIndicator.swift Sources/Views/Chat/PersonaCard.swift Sources/Views/Chat/ChatBubble.swift Sources/Views/Chat/ChatInputBar.swift; do if [ ! -f "$f" ]; then echo "MISSING: $f"; exit 1; fi; done && echo "All 6 chat components present"`,
    failOnError: true,
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["verify-all"],
    command:
      'cd trail-viewer && git add Sources/Views/Chat/ && git commit -m "feat: add all 6 chat components (fan-out)"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("49-chat-components-fanout:", result.status);
