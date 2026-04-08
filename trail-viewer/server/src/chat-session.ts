/**
 * ChatSession — manages multi-persona chat sessions for trajectory discussions.
 * Spawns AI agents with persona prompts and relays messages between them and the user.
 *
 * Pattern follows MySeniorDev's chat-session.ts:
 *   - AgentRelay auto-starts broker on first spawn
 *   - relay.claude.spawn() / relay.codex.spawn() for agent lifecycle
 *   - relay.human().sendMessage() for user→agent delivery
 *   - relay.onMessageReceived for agent→server delivery
 *   - broker-managed channel fanout between subscribed agents
 */

import { randomUUID } from "node:crypto";
import { AgentRelay, type Message } from "@agent-relay/sdk";
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

interface AgentEntry {
  personaId: string;
  agentName: string;
}

// ---------------------------------------------------------------------------
// ChatSession
// ---------------------------------------------------------------------------

export class ChatSession {
  readonly sessionId: string;
  readonly trajectoryId: string;
  readonly channel: string;

  private relay: AgentRelay;
  private agents: Map<string, AgentEntry> = new Map();
  private personaNames: Set<string> = new Set();
  private trajectoryContext: string;
  private preferredCLI: string | undefined;
  private recentMessages: Map<string, number> = new Map();

  onMessage: MessageCallback | null = null;
  onTyping: TypingCallback | null = null;

  /** Observer URL for the auto-created workspace (available after first spawn). */
  get observerUrl(): string | undefined {
    return (this.relay as unknown as { observerUrl?: string }).observerUrl;
  }

  /** Relaycast workspace API key, when exposed by the underlying relay instance. */
  get relayApiKey(): string | undefined {
    const relay = this.relay as unknown as {
      apiKey?: string;
      relayApiKey?: string;
      workspaceKey?: string;
    };

    return relay.apiKey ?? relay.relayApiKey ?? relay.workspaceKey;
  }

  /** Workspace ID for the active relay workspace, when exposed by the relay instance. */
  get workspaceId(): string | undefined {
    const relay = this.relay as unknown as {
      workspaceId?: string;
      resolvedWorkspaceId?: string;
    };

    return relay.workspaceId ?? relay.resolvedWorkspaceId;
  }

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
    this.channel = `chat-traj-${this.sessionId.slice(0, 8)}`;
    this.relay = new AgentRelay();
  }

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  async startSession(personaIds: string[]): Promise<void> {
    this.relay.onMessageReceived = (message: Message) => {
      if (!this.personaNames.has(message.from)) return;
      this.handleAgentMessage(message.from, message.text);
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
    const human = this.relay.human({ name: "user" });

    for (const personaId of targetPersonas) {
      const agentEntry = this.findAgentByPersonaId(personaId);
      if (!agentEntry) continue;

      this.onTyping?.(personaId, true);

      try {
        await human.sendMessage({
          to: agentEntry.agentName,
          text,
        });
      } catch (err) {
        console.error(
          `[chat-session] sendMessage to ${agentEntry.agentName} failed:`,
          err instanceof Error ? err.message : String(err),
        );
        this.onTyping?.(personaId, false);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Agent message handler
  // -----------------------------------------------------------------------

  private handleAgentMessage(from: string, rawText: string): void {
    if (!this.personaNames.has(from)) return;

    const agentEntry = this.agents.get(from);
    const personaId = agentEntry?.personaId;
    const persona = personaId ? PERSONAS[personaId] : undefined;
    const cleanedContent = stripThinking(stripAnsi(rawText));

    if (!cleanedContent) return;
    if (this.isDuplicateMessage(from, cleanedContent)) return;

    if (personaId) {
      this.onTyping?.(personaId, false);
    }

    const message: ChatMessage = {
      id: randomUUID(),
      from: personaId ?? from,
      content: cleanedContent,
      persona,
      timestamp: new Date(),
    };

    this.onMessage?.(message);
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

    const agents = await this.relay.listAgents();
    const agent = agents.find((entry) => entry.name === agentEntry.agentName);

    if (agent) {
      await agent.release({ reason: "Removed from chat session" });
    }

    this.agents.delete(agentEntry.agentName);
    this.personaNames.delete(agentEntry.agentName);
  }

  // -----------------------------------------------------------------------
  // Teardown
  // -----------------------------------------------------------------------

  async stop(): Promise<void> {
    this.agents.clear();
    this.personaNames.clear();
    this.recentMessages.clear();
    this.onMessage = null;
    this.onTyping = null;

    await this.relay.shutdown();
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private isDuplicateMessage(from: string, text: string): boolean {
    const dedupKey = `${from}:${text.slice(0, 120)}`;
    const now = Date.now();
    const lastSeen = this.recentMessages.get(dedupKey);

    if (lastSeen && now - lastSeen < 5000) {
      return true;
    }

    this.recentMessages.set(dedupKey, now);
    this.pruneRecentMessages();
    return false;
  }

  private pruneRecentMessages(): void {
    if (this.recentMessages.size <= 200) return;

    let oldestKey: string | undefined;
    let oldestTimestamp = Number.POSITIVE_INFINITY;

    for (const [key, timestamp] of this.recentMessages) {
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.recentMessages.delete(oldestKey);
    }
  }

  private async spawnPersonaAgent(persona: Persona): Promise<void> {
    const prompt = buildPersonaPrompt(persona, this.trajectoryContext);
    const agentName = `persona-${persona.id}-${this.sessionId.slice(0, 8)}`;
    const cli = (this.preferredCLI ?? "claude").toLowerCase();
    const spawner = cli === "codex" ? this.relay.codex : this.relay.claude;

    console.log(
      `[chat-session] spawning ${persona.id} as ${agentName} with cli=${cli}`,
    );

    await spawner.spawn({
      name: agentName,
      channels: [this.channel],
      task: prompt,
    });

    this.agents.set(agentName, {
      personaId: persona.id,
      agentName,
    });
    this.personaNames.add(agentName);
  }

  private findAgentByPersonaId(personaId: string): AgentEntry | undefined {
    for (const entry of this.agents.values()) {
      if (entry.personaId === personaId) return entry;
    }

    return undefined;
  }
}
