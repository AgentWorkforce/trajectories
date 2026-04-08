/**
 * ChatSession — manages multi-persona chat sessions for trajectory discussions.
 * Spawns AI agents with persona prompts and relays messages between them and the user.
 */

import { randomUUID } from "node:crypto";
import { AgentRelay } from "@agent-relay/sdk";
import { resolveSpawnConfig } from "./cli-resolver";
import {
  PERSONAS,
  type Persona,
  buildPersonaPrompt,
  stripAnsi,
  stripThinking,
} from "./personas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  from: string;
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
    preferredCLI?: string,
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
    // Listen for messages from spawned agents
    this.relay.onMessageReceived = (msg: any) => {
      this.handleChannelMessage({
        from: msg.from,
        content: msg.text,
        channel: this.channel,
      });
    };

    for (const personaId of personaIds) {
      const persona = PERSONAS[personaId];
      if (!persona) continue;

      await this.spawnPersonaAgent(persona);
    }
  }

  // -----------------------------------------------------------------------
  // Sending messages
  // -----------------------------------------------------------------------

  async sendMessage(text: string, targetPersonas: string[]): Promise<void> {
    await this.relay.publish(this.channel, {
      from: "user",
      content: text,
    });

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

    const agentEntry = this.agents.get(sender);
    const personaId = agentEntry?.personaId;
    const persona = personaId ? PERSONAS[personaId] : undefined;

    const cleanedContent = stripThinking(stripAnsi(rawContent));
    if (!cleanedContent) return;

    if (personaId) {
      this.onTyping?.(personaId, false);
    }

    const message: ChatMessage = {
      id: randomUUID(),
      from: personaId ?? sender,
      content: cleanedContent,
      persona,
      timestamp: new Date(),
    };

    this.onMessage?.(message);

    for (const [agentName] of this.agents) {
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
    const releasePromises: Promise<void>[] = [];
    for (const [agentName] of this.agents) {
      releasePromises.push(
        this.relay.release(agentName).catch(() => {
          // Agent may already be gone
        }),
      );
    }
    await Promise.all(releasePromises);

    this.agents.clear();
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async spawnPersonaAgent(persona: Persona): Promise<void> {
    const prompt = buildPersonaPrompt(persona, this.trajectoryContext);
    const spawnConfig = resolveSpawnConfig(this.preferredCLI);
    const agentName = `persona-${persona.id}-${this.sessionId.slice(0, 8)}`;

    await this.relay.spawn(agentName, spawnConfig.command, prompt, {
      args: spawnConfig.args,
      channels: [this.channel],
    });

    this.agents.set(agentName, {
      personaId: persona.id,
      agentName,
    });
  }

  private findAgentByPersonaId(
    personaId: string,
  ): { personaId: string; agentName: string } | undefined {
    for (const [, entry] of this.agents) {
      if (entry.personaId === personaId) return entry;
    }
    return undefined;
  }
}
