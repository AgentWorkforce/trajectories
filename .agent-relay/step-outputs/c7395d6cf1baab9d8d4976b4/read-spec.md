# Spec: personas.ts for Trail Viewer Server

## File: `personas.ts`

```typescript
/**
 * Persona definitions and utilities for the Trail Viewer server.
 */

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

export const PERSONAS: Record<string, Persona> = {
  architect: {
    id: "architect",
    name: "Architect",
    emoji: "🏗",
    description:
      "Focuses on system design, architecture decisions, and structural patterns",
    color: "#7eb8da",
  },
  detective: {
    id: "detective",
    name: "Detective",
    emoji: "🔍",
    description:
      "Investigates issues, traces problems, and uncovers root causes",
    color: "#b5a2d4",
  },
  mentor: {
    id: "mentor",
    name: "Mentor",
    emoji: "🧑‍🏫",
    description:
      "Explains concepts, suggests learning resources, and guides understanding",
    color: "#7ec89b",
  },
  critic: {
    id: "critic",
    name: "Critic",
    emoji: "🤔",
    description:
      "Challenges assumptions, identifies risks, and plays devil's advocate",
    color: "#f2d479",
  },
  historian: {
    id: "historian",
    name: "Historian",
    emoji: "📜",
    description:
      "Provides context from past decisions, patterns, and project evolution",
    color: "#e8a87c",
  },
  optimizer: {
    id: "optimizer",
    name: "Optimizer",
    emoji: "⚡",
    description:
      "Focuses on performance, efficiency, and resource optimization",
    color: "#89c4c4",
  },
};

export function buildPersonaPrompt(
  persona: Persona,
  trajectoryContext: string
): string {
  return `You are the ${persona.name} (${persona.emoji}). ${persona.description}.

## Your Trajectory Context

${trajectoryContext}

## Guidelines

- Stay in character as the ${persona.name} at all times
- Be concise — aim for 2-4 paragraphs max per response
- Reference specific parts of the trajectory when relevant
- Disagree constructively when you see issues
- Build on what other personas have said when in group discussions

Respond naturally as ${persona.name}. Do not break character.`;
}

export function stripThinking(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
}

export function stripAnsi(text: string): string {
  return text
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1B\][^\x07]*\x07/g, "")
    .replace(/\x1B\(B/g, "")
    .trim();
}

export function getPersonaById(id: string): Persona | undefined {
  return PERSONAS[id];
}

export function getAllPersonas(): Persona[] {
  return Object.values(PERSONAS);
}
```

OWNER_DECISION: COMPLETE
REASON: Complete personas.ts spec written to .relay/specs/78-personas.md with all required interfaces, constants, and functions.
