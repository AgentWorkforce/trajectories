# Chat Service — `trail-viewer/server/src/chat-service.ts`

Write this file to `trail-viewer/server/src/chat-service.ts`:

```typescript
/**
 * ChatService — manages multiple ChatSessions and broadcasts events to listeners.
 */

import { ChatSession, MessageCallback, TypingCallback, ChatMessage } from './chat-session';
import { PERSONAS, getAllPersonas, Persona } from './personas';
import { randomUUID } from 'crypto';

export class ChatService {
  private sessions: Map<string, ChatSession>;
  private messageCallbacks: Set<MessageCallback>;
  private typingCallbacks: Set<TypingCallback>;

  constructor() {
    this.sessions = new Map();
    this.messageCallbacks = new Set();
    this.typingCallbacks = new Set();
  }

  async startSession(
    trajectoryId: string,
    trajectoryContext: string,
    personaIds: string[],
    preferredCLI?: string
  ): Promise<string> {
    const session = new ChatSession(trajectoryId, trajectoryContext, preferredCLI);

    session.onMessage = (message: ChatMessage) => {
      this.broadcastMessage(message);
    };

    session.onTyping = (personaId: string, isTyping: boolean) => {
      this.broadcastTyping(personaId, isTyping);
    };

    await session.startSession(personaIds);
    this.sessions.set(session.sessionId, session);

    return session.sessionId;
  }

  async sendMessage(sessionId: string, text: string, targetPersonas: string[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    await session.sendMessage(text, targetPersonas);
  }

  async addPersona(sessionId: string, personaId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    await session.addPersona(personaId);
  }

  async removePersona(sessionId: string, personaId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    await session.removePersona(personaId);
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    await session.stop();
    this.sessions.delete(sessionId);
  }

  getPersonas(): Persona[] {
    return getAllPersonas();
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.add(callback);
  }

  onTyping(callback: TypingCallback): void {
    this.typingCallbacks.add(callback);
  }

  private broadcastMessage(message: ChatMessage): void {
    for (const callback of this.messageCallbacks) {
      callback(message);
    }
  }

  private broadcastTyping(personaId: string, isTyping: boolean): void {
    for (const callback of this.typingCallbacks) {
      callback(personaId, isTyping);
    }
  }
}
```
