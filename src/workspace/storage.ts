/**
 * Workspace storage - persists decisions, patterns, knowledge
 */

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  Workspace,
  WorkspaceDecision,
  WorkspacePattern,
  WorkspaceKnowledge,
  WorkspaceQuery,
  WorkspaceQueryResult,
} from "./types.js";
import { generateRandomId } from "../core/id.js";

export class WorkspaceStorage {
  private basePath: string;
  private decisionsPath: string;
  private patternsPath: string;
  private knowledgePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || join(process.cwd(), ".agent-workspace");
    this.decisionsPath = join(this.basePath, "decisions");
    this.patternsPath = join(this.basePath, "patterns");
    this.knowledgePath = join(this.basePath, "knowledge");
  }

  async initialize(): Promise<void> {
    await mkdir(this.decisionsPath, { recursive: true });
    await mkdir(this.patternsPath, { recursive: true });
    await mkdir(this.knowledgePath, { recursive: true });
  }

  // Decisions

  async addDecision(
    decision: Omit<WorkspaceDecision, "id">
  ): Promise<WorkspaceDecision> {
    const id = `dec_${generateRandomId()}`;
    const full: WorkspaceDecision = { ...decision, id };
    await writeFile(
      join(this.decisionsPath, `${id}.json`),
      JSON.stringify(full, null, 2)
    );
    return full;
  }

  async getDecision(id: string): Promise<WorkspaceDecision | null> {
    const path = join(this.decisionsPath, `${id}.json`);
    if (!existsSync(path)) return null;
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  }

  async listDecisions(): Promise<WorkspaceDecision[]> {
    if (!existsSync(this.decisionsPath)) return [];
    const files = await readdir(this.decisionsPath);
    const decisions: WorkspaceDecision[] = [];
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await readFile(join(this.decisionsPath, file), "utf-8");
        decisions.push(JSON.parse(content));
      }
    }
    return decisions.sort(
      (a, b) =>
        new Date(b.sourceDate).getTime() - new Date(a.sourceDate).getTime()
    );
  }

  async updateDecision(
    id: string,
    updates: Partial<WorkspaceDecision>
  ): Promise<WorkspaceDecision | null> {
    const existing = await this.getDecision(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id };
    await writeFile(
      join(this.decisionsPath, `${id}.json`),
      JSON.stringify(updated, null, 2)
    );
    return updated;
  }

  // Patterns

  async addPattern(
    pattern: Omit<WorkspacePattern, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkspacePattern> {
    const id = `pat_${generateRandomId()}`;
    const now = new Date().toISOString();
    const full: WorkspacePattern = {
      ...pattern,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await writeFile(
      join(this.patternsPath, `${id}.json`),
      JSON.stringify(full, null, 2)
    );
    return full;
  }

  async getPattern(id: string): Promise<WorkspacePattern | null> {
    const path = join(this.patternsPath, `${id}.json`);
    if (!existsSync(path)) return null;
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  }

  async listPatterns(): Promise<WorkspacePattern[]> {
    if (!existsSync(this.patternsPath)) return [];
    const files = await readdir(this.patternsPath);
    const patterns: WorkspacePattern[] = [];
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await readFile(join(this.patternsPath, file), "utf-8");
        patterns.push(JSON.parse(content));
      }
    }
    return patterns.sort((a, b) => a.title.localeCompare(b.title));
  }

  // Knowledge

  async addKnowledge(
    knowledge: Omit<WorkspaceKnowledge, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkspaceKnowledge> {
    const id = `know_${generateRandomId()}`;
    const now = new Date().toISOString();
    const full: WorkspaceKnowledge = {
      ...knowledge,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await writeFile(
      join(this.knowledgePath, `${id}.json`),
      JSON.stringify(full, null, 2)
    );
    return full;
  }

  async getKnowledge(id: string): Promise<WorkspaceKnowledge | null> {
    const path = join(this.knowledgePath, `${id}.json`);
    if (!existsSync(path)) return null;
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  }

  async listKnowledge(): Promise<WorkspaceKnowledge[]> {
    if (!existsSync(this.knowledgePath)) return [];
    const files = await readdir(this.knowledgePath);
    const knowledge: WorkspaceKnowledge[] = [];
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await readFile(join(this.knowledgePath, file), "utf-8");
        knowledge.push(JSON.parse(content));
      }
    }
    return knowledge.sort((a, b) => a.title.localeCompare(b.title));
  }

  // Query

  async query(q: WorkspaceQuery): Promise<WorkspaceQueryResult> {
    const result: WorkspaceQueryResult = {
      decisions: [],
      patterns: [],
      knowledge: [],
      trajectories: [],
    };

    const searchText = q.query.toLowerCase();
    const limit = q.limit || 10;

    // Search decisions
    if (!q.type || q.type === "decision" || q.type === "any") {
      const decisions = await this.listDecisions();
      result.decisions = decisions
        .filter((d) => {
          const text =
            `${d.title} ${d.decision} ${d.reasoning} ${d.tags.join(" ")}`.toLowerCase();
          return text.includes(searchText);
        })
        .slice(0, limit);
    }

    // Search patterns
    if (!q.type || q.type === "pattern" || q.type === "any") {
      const patterns = await this.listPatterns();
      result.patterns = patterns
        .filter((p) => {
          const text =
            `${p.title} ${p.description} ${p.when} ${p.tags.join(" ")}`.toLowerCase();
          return text.includes(searchText);
        })
        .slice(0, limit);
    }

    // Search knowledge
    if (!q.type || q.type === "knowledge" || q.type === "any") {
      const knowledge = await this.listKnowledge();
      result.knowledge = knowledge
        .filter((k) => {
          const text =
            `${k.title} ${k.content} ${k.tags.join(" ")}`.toLowerCase();
          return text.includes(searchText);
        })
        .slice(0, limit);
    }

    return result;
  }

  // Export full workspace state
  async export(): Promise<Workspace> {
    return {
      projectId: "default",
      decisions: await this.listDecisions(),
      patterns: await this.listPatterns(),
      knowledge: await this.listKnowledge(),
      version: 1,
      lastUpdated: new Date().toISOString(),
    };
  }
}
