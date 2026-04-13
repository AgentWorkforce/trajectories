// ── Server → Client Messages ────────────────────────────────────────

export interface AgentMessageEvent {
  type: "agent_message";
  from: string;
  content: string;
  persona: { id: string; name: string; emoji: string; color: string } | null;
  timestamp: string;
}

export interface TypingEvent {
  type: "typing";
  persona: string;
  isTyping: boolean;
}

export interface SessionStartedEvent {
  type: "session_started";
  sessionId: string;
  personas: string[];
}

export interface ErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

export type ServerToClientMessage =
  | AgentMessageEvent
  | TypingEvent
  | SessionStartedEvent
  | ErrorEvent;

// ── Client → Server Messages ────────────────────────────────────────

export interface SendMessagePayload {
  type: "send_message";
  sessionId: string;
  message: string;
  personas: string[];
}

export interface StartSessionPayload {
  type: "start_session";
  trajectoryId: string;
  personas: string[];
  preferredCLI?: string;
}

export interface StopSessionPayload {
  type: "stop_session";
  sessionId: string;
}

export interface AddPersonaPayload {
  type: "add_persona";
  sessionId: string;
  personaId: string;
}

export interface RemovePersonaPayload {
  type: "remove_persona";
  sessionId: string;
  personaId: string;
}

export type ClientToServerMessage =
  | SendMessagePayload
  | StartSessionPayload
  | StopSessionPayload
  | AddPersonaPayload
  | RemovePersonaPayload;

// ── Type Guard ──────────────────────────────────────────────────────

const CLIENT_MESSAGE_TYPES = new Set<string>([
  "send_message",
  "start_session",
  "stop_session",
  "add_persona",
  "remove_persona",
]);

export function isClientMessage(data: unknown): data is ClientToServerMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as Record<string, unknown>).type === "string" &&
    CLIENT_MESSAGE_TYPES.has((data as Record<string, unknown>).type as string)
  );
}
