import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getDefaultTrajectoryDataDir,
  getSearchPaths,
} from "../storage/file.js";

export interface CompactionConfig {
  provider: string;
  model: string | undefined;
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
}

const DEFAULT_CONFIG: CompactionConfig = {
  provider: "auto",
  model: undefined,
  maxInputTokens: 30000,
  maxOutputTokens: 4000,
  temperature: 0.3,
};

export function getCompactionConfig(): CompactionConfig {
  const fileConfig = loadFileConfig();

  return {
    provider:
      readStringEnv("TRAJECTORIES_LLM_PROVIDER") ??
      readString(fileConfig.provider) ??
      DEFAULT_CONFIG.provider,
    model:
      readStringEnv("TRAJECTORIES_LLM_MODEL") ??
      readString(fileConfig.model) ??
      DEFAULT_CONFIG.model,
    maxInputTokens:
      readNumberEnv("TRAJECTORIES_LLM_MAX_INPUT_TOKENS") ??
      readNumber(fileConfig.maxInputTokens) ??
      DEFAULT_CONFIG.maxInputTokens,
    maxOutputTokens:
      readNumberEnv("TRAJECTORIES_LLM_MAX_OUTPUT_TOKENS") ??
      readNumber(fileConfig.maxOutputTokens) ??
      DEFAULT_CONFIG.maxOutputTokens,
    temperature:
      readNumberEnv("TRAJECTORIES_LLM_TEMPERATURE") ??
      readNumber(fileConfig.temperature) ??
      DEFAULT_CONFIG.temperature,
  };
}

function loadFileConfig(): Partial<CompactionConfig> {
  const configPath = join(getPrimaryConfigDir(), "config.json");
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as unknown;
    if (!isRecord(raw)) {
      return {};
    }

    // Merge precedence (last wins): root < compaction < llm
    // e.g. { "model": "x", "compaction": { "model": "y" }, "llm": { "model": "z" } }
    // results in model = "z"
    const merged: Record<string, unknown> = {};
    for (const section of [raw, raw.compaction, raw.llm]) {
      if (!isRecord(section)) {
        continue;
      }

      for (const [key, value] of Object.entries(section)) {
        if (key === "compaction" || key === "llm") {
          continue;
        }
        merged[key] = value;
      }
    }

    return {
      provider: readString(merged.provider),
      model: readString(merged.model),
      maxInputTokens: readNumber(merged.maxInputTokens),
      maxOutputTokens: readNumber(merged.maxOutputTokens),
      temperature: readNumber(merged.temperature),
    };
  } catch {
    return {};
  }
}

function getPrimaryConfigDir(): string {
  const searchPaths = getSearchPaths();
  return searchPaths[0] ?? getDefaultTrajectoryDataDir();
}

function readStringEnv(name: string): string | undefined {
  return readString(process.env[name]);
}

function readNumberEnv(name: string): number | undefined {
  return readNumber(process.env[name]);
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  // Treat empty / whitespace-only strings as unset, matching readString's
  // behavior. Otherwise `Number("") === 0` would silently override the
  // default maxInputTokens / maxOutputTokens (nullish coalescing does NOT
  // fall back for 0), truncating serialized trajectories to an empty
  // string or sending max_tokens: 0 to the LLM API.
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
