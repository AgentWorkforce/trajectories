# 79 — ChatSession (chat-session.ts)

Trail Viewer server module managing multi-persona chat sessions over agent relay.

**Path:** `trail-viewer/server/src/chat-session.ts`
**Lines:** ~250

---

```typescript
/**
 * ChatSession — manages multi-persona chat sessions for trajectory discussions.
 * Spawns AI agents with persona prompts and relays messages between them and the user.
 */

import { AgentRelay } from "@agent-relay/sdk";
import { resolveSpawnConfig } from "./cli-resolver";
import {
  PERSONAS,
  buildPersonaPrompt,
  stripThinking,
  stripAnsi,
  Persona,
} from "./personas";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  from: string; // persona id or "user"
  content: string;
  persona?: Persona;
  timestamp: Date;
}

export type MessageCallback = (message: ChatMessage) => void;
export type TypingCallback = (personaId: string, isTyping: boolean) => void;

// ---------------------------------------------------------------------------
// ChatSession
// ---------------------------------------------------------------------------

export class ChatSession {
  readonly sessionId: string;
  readonly trajectoryId: string;
  readonly channel: string;

  private relay: AgentRelay;
  private agents: Map<string, { personaId: string; agentName: string }> =
    new Map();
  private trajectoryContext: string;
  private preferredCLI: string | undefined;

  onMessage: MessageCallback | null = null;
  onTyping: TypingCallback | null = null;

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor(
    trajectoryId: string,
    trajectoryContext: string,
    preferredCLI?: string
  ) {
    this.sessionId = randomUUID();
    this.trajectoryId = trajectoryId;
    this.trajectoryContext = trajectoryContext;
    this.preferredCLI = preferredCLI;
    this.channel = `chat-traj-${trajectoryId}`;
    this.relay = new AgentRelay();
    this.agents = new Map();
    this.onMessage = null;
    this.onTyping = null;
  }

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  async startSession(personaIds: string[]): Promise<void> {
    // Spawn an agent for each requested persona
    for (const personaId of personaIds) {
      const persona = PERSONAS[personaId];
      if (!persona) continue;

      await this.spawnPersonaAgent(persona);
    }

    // Subscribe to the shared channel for incoming messages
    await this.relay.subscribe(this.channel);

    // Wire up the message handler
    this.relay.on("message", (envelope: any) => {
      if (envelope.channel === this.channel) {
        this.handleChannelMessage(envelope);
      }
    });
  }

  // -----------------------------------------------------------------------
  // Sending messages
  // -----------------------------------------------------------------------

  async sendMessage(text: string, targetPersonas: string[]): Promise<void> {
    // Post the user message to the channel for the record
    await this.relay.publish(this.channel, {
      from: "user",
      content: text,
    });

    // Inject the user message into each targeted persona agent's stdin
    for (const personaId of targetPersonas) {
      const agentEntry = this.findAgentByPersonaId(personaId);
      if (!agentEntry) continue;

      this.onTyping?.(personaId, true);

      await this.relay.inject(agentEntry.agentName, `User says: ${text}`);
    }
  }

  // -----------------------------------------------------------------------
  // Channel message handler
  // -----------------------------------------------------------------------

  private handleChannelMessage(envelope: any): void {
    const sender: string = envelope.from ?? "unknown";
    const rawContent: string = envelope.content ?? "";

    // Determine which persona sent this message
    const agentEntry = this.agents.get(sender);
    const personaId = agentEntry?.personaId;
    const persona = personaId ? PERSONAS[personaId] : undefined;

    // Clean the content
    const cleanedContent = stripThinking(stripAnsi(rawContent));
    if (!cleanedContent) return;

    // Mark typing as done for this persona
    if (personaId) {
      this.onTyping?.(personaId, false);
    }

    // Build and emit the ChatMessage
    const message: ChatMessage = {
      id: randomUUID(),
      from: personaId ?? sender,
      content: cleanedContent,
      persona,
      timestamp: new Date(),
    };

    this.onMessage?.(message);

    // Cross-agent fanout: inject this message into every OTHER agent's PTY
    // so they can see and respond to what this persona said.
    for (const [agentName, entry] of this.agents) {
      if (agentName === sender) continue;

      const senderLabel = persona?.name ?? sender;
      this.relay
        .inject(agentName, `${senderLabel} says: ${cleanedContent}`)
        .catch(() => {
          // Swallow injection errors — agent may have exited
        });
    }
  }

  // -----------------------------------------------------------------------
  // Dynamic persona management
  // -----------------------------------------------------------------------

  async addPersona(personaId: string): Promise<void> {
    const persona = PERSONAS[personaId];
    if (!persona) return;

    // Don't add if already present
    if (this.findAgentByPersonaId(personaId)) return;

    await this.spawnPersonaAgent(persona);
  }

  async removePersona(personaId: string): Promise<void> {
    const agentEntry = this.findAgentByPersonaId(personaId);
    if (!agentEntry) return;

    await this.relay.release(agentEntry.agentName);
    this.agents.delete(agentEntry.agentName);
  }

  // -----------------------------------------------------------------------
  // Teardown
  // -----------------------------------------------------------------------

  async stop(): Promise<void> {
    // Release every spawned agent
    const releasePromises: Promise<void>[] = [];
    for (const [agentName] of this.agents) {
      releasePromises.push(
        this.relay.release(agentName).catch(() => {
          // Agent may already be gone
        })
      );
    }
    await Promise.all(releasePromises);

    this.agents.clear();

    // Unsubscribe from the channel
    await this.relay.unsubscribe(this.channel);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async spawnPersonaAgent(persona: Persona): Promise<void> {
    const prompt = buildPersonaPrompt(persona, this.trajectoryContext);
    const spawnConfig = resolveSpawnConfig(this.preferredCLI);
    const agentName = `persona-${persona.id}-${this.sessionId.slice(0, 8)}`;

    await this.relay.spawn(agentName, {
      command: spawnConfig.command,
      args: spawnConfig.args,
      env: spawnConfig.env,
      task: prompt,
      channel: this.channel,
    });

    this.agents.set(agentName, {
      personaId: persona.id,
      agentName,
    });
  }

  private findAgentByPersonaId(
    personaId: string
  ): { personaId: string; agentName: string } | undefined {
    for (const [, entry] of this.agents) {
      if (entry.personaId === personaId) return entry;
    }
    return undefined;
  }
}
```
