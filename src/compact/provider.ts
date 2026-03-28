import type { CompactionConfig } from "./config.js";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface CompactionLLM {
  complete(messages: Message[], options?: CompletionOptions): Promise<string>;
}

interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface AnthropicResponse {
  content?: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: string;
      }
  >;
  error?: {
    message?: string;
  };
}

export const DEFAULT_OPENAI_MODEL = "gpt-4o";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MAX_TOKENS = 4096;

export class OpenAIProvider implements CompactionLLM {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model =
      normalizeModel(config.model) ??
      normalizeModel(process.env.TRAJECTORIES_LLM_MODEL) ??
      DEFAULT_OPENAI_MODEL;
    this.baseUrl =
      config.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL;

    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAIProvider");
    }
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {},
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options.temperature ?? 0.2,
        response_format: options.jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    const body = (await parseJson(response)) as OpenAIChatResponse;
    if (!response.ok) {
      throw new Error(
        body.error?.message ??
          `OpenAI request failed with status ${response.status}`,
      );
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response did not include completion content");
    }

    return content;
  }
}

export class AnthropicProvider implements CompactionLLM {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model =
      normalizeModel(config.model) ??
      normalizeModel(process.env.TRAJECTORIES_LLM_MODEL) ??
      DEFAULT_ANTHROPIC_MODEL;
    this.baseUrl =
      config.baseUrl ??
      process.env.ANTHROPIC_BASE_URL ??
      DEFAULT_ANTHROPIC_BASE_URL;

    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for AnthropicProvider");
    }
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {},
  ): Promise<string> {
    const systemMessages = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content.trim())
      .filter(Boolean);

    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        model: this.model,
        system:
          systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
        messages:
          conversation.length > 0
            ? conversation
            : [{ role: "user", content: "Summarize the provided sessions." }],
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options.temperature ?? 0.2,
      }),
    });

    const body = (await parseJson(response)) as AnthropicResponse;
    if (!response.ok) {
      throw new Error(
        body.error?.message ??
          `Anthropic request failed with status ${response.status}`,
      );
    }

    const textBlocks = (body.content ?? []).filter(
      (
        block,
      ): block is Extract<
        AnthropicResponse["content"],
        Array<unknown>
      >[number] & {
        type: "text";
        text: string;
      } =>
        block.type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    );
    const content = textBlocks
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!content) {
      throw new Error("Anthropic response did not include text content");
    }

    return content;
  }
}

export function resolveProvider(
  config: Partial<CompactionConfig> = {},
): CompactionLLM | null {
  const explicitProvider = (
    config.provider ?? process.env.TRAJECTORIES_LLM_PROVIDER
  )?.toLowerCase();
  const model = normalizeModel(config.model);

  if (explicitProvider === "openai") {
    return process.env.OPENAI_API_KEY ? new OpenAIProvider({ model }) : null;
  }

  if (explicitProvider === "anthropic") {
    return process.env.ANTHROPIC_API_KEY
      ? new AnthropicProvider({ model })
      : null;
  }

  if (explicitProvider && explicitProvider !== "auto") {
    return null;
  }

  if (process.env.OPENAI_API_KEY) {
    return new OpenAIProvider({ model });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({ model });
  }

  return null;
}

function normalizeModel(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 500)}`);
  }
}
