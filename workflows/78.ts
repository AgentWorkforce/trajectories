import { workflow } from "@agent-relay/sdk/workflows";

const result = await workflow("78-personas")
  .description(
    "Create trail-viewer/server/src/personas.ts — 6 chat persona definitions with prompt builder",
  )
  .pattern("pipeline")
  .channel("wf-78-personas")
  .maxConcurrency(2)
  .timeout(900_000)

  .agent("planner", {
    cli: "claude",
    role: "TypeScript backend architect for persona system",
    preset: "lead",
    retries: 2,
  })
  .agent("impl", {
    cli: "codex",
    role: "TypeScript implementer",
    preset: "worker",
    retries: 2,
  })

  .step("plan", {
    agent: "planner",
    task: `Output the COMPLETE contents of a TypeScript file: personas.ts for the Trail Viewer server.

Requirements:
- Define and export interface Persona:
  - id: string
  - name: string
  - emoji: string
  - description: string
  - color: string (hex color)

- Export const PERSONAS: Record<string, Persona> with exactly 6 personas:
  1. architect: { id: "architect", name: "Architect", emoji: "\\u{1F3D7}", description: "Focuses on system design, architecture decisions, and structural patterns", color: "#7eb8da" }
  2. detective: { id: "detective", name: "Detective", emoji: "\\u{1F50D}", description: "Investigates issues, traces problems, and uncovers root causes", color: "#b5a2d4" }
  3. mentor: { id: "mentor", name: "Mentor", emoji: "\\u{1F9D1}\\u{200D}\\u{1F3EB}", description: "Explains concepts, suggests learning resources, and guides understanding", color: "#7ec89b" }
  4. critic: { id: "critic", name: "Critic", emoji: "\\u{1F914}", description: "Challenges assumptions, identifies risks, and plays devil's advocate", color: "#f2d479" }
  5. historian: { id: "historian", name: "Historian", emoji: "\\u{1F4DC}", description: "Provides context from past decisions, patterns, and project evolution", color: "#e8a87c" }
  6. optimizer: { id: "optimizer", name: "Optimizer", emoji: "\\u{26A1}", description: "Focuses on performance, efficiency, and resource optimization", color: "#89c4c4" }

- Export function buildPersonaPrompt(persona: Persona, trajectoryContext: string): string
  - Returns a system prompt string that includes:
    1. Role assignment: "You are the {persona.name} ({persona.emoji}). {persona.description}."
    2. A section "## Your Trajectory Context" with the full trajectoryContext injected
    3. Guidelines section:
       - "Stay in character as the {persona.name} at all times"
       - "Be concise — aim for 2-4 paragraphs max per response"
       - "Reference specific parts of the trajectory when relevant"
       - "Disagree constructively when you see issues"
       - "Build on what other personas have said when in group discussions"
    4. A closing line: "Respond naturally as {persona.name}. Do not break character."

- Export function stripThinking(text: string): string
  - Remove <thinking>...</thinking> blocks (including multiline) from text
  - Use regex: /<thinking>[\\s\\S]*?<\\/thinking>/g
  - Trim the result

- Export function stripAnsi(text: string): string
  - Remove ANSI escape codes from text
  - Use regex to strip all ANSI sequences: /\\x1B\\[[0-9;]*[a-zA-Z]/g and /\\x1B\\][^\\x07]*\\x07/g
  - Also handle \\x1B(B and similar
  - Trim the result

- Export function getPersonaById(id: string): Persona | undefined
  - Return PERSONAS[id]

- Export function getAllPersonas(): Persona[]
  - Return Object.values(PERSONAS)

Output the COMPLETE TypeScript file ready to write to disk.`,
    verification: { type: "output_contains", value: "buildPersonaPrompt" },
  })

  .step("implement", {
    agent: "impl",
    dependsOn: ["plan"],
    task: `Create trail-viewer/server/src/personas.ts from this spec:

{{steps.plan.output}}

Extract the TypeScript code and write it to trail-viewer/server/src/personas.ts.
Create the directory trail-viewer/server/src/ if it does not exist.
IMPORTANT: Write the file to disk. Do NOT output to stdout. Only create this one file.`,
    verification: {
      type: "file_exists",
      value: "trail-viewer/server/src/personas.ts",
    },
  })

  .step("commit", {
    type: "deterministic",
    dependsOn: ["implement"],
    command:
      'cd trail-viewer && git add server/src/personas.ts && git commit -m "feat: add persona definitions — 6 chat personas with prompt builder and text utilities"',
    failOnError: true,
  })

  .onError("retry", { maxRetries: 2, retryDelayMs: 5_000 })
  .run({ cwd: process.cwd() });

console.log("78-personas:", result.status);
