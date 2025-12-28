import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceStorage } from "../../src/workspace/storage.js";

describe("WorkspaceStorage", () => {
  let tempDir: string;
  let storage: WorkspaceStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "workspace-test-"));
    storage = new WorkspaceStorage(tempDir);
    await storage.initialize();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Decisions", () => {
    it("should add a decision", async () => {
      const decision = await storage.addDecision({
        title: "Use JWT for auth",
        context: "Implementing authentication",
        decision: "JWT over sessions",
        reasoning: "Stateless scaling",
        alternatives: ["Sessions", "OAuth"],
        sourceTrajectory: "traj_abc123",
        sourceDate: "2024-01-15T10:00:00Z",
        tags: ["auth", "security"],
        status: "active",
      });

      expect(decision.id).toMatch(/^dec_/);
      expect(decision.title).toBe("Use JWT for auth");
    });

    it("should retrieve a decision", async () => {
      const added = await storage.addDecision({
        title: "Use PostgreSQL",
        context: "Database selection",
        decision: "PostgreSQL over MySQL",
        reasoning: "JSON support and extensions",
        sourceTrajectory: "traj_xyz789",
        sourceDate: "2024-01-10T10:00:00Z",
        tags: ["database"],
        status: "active",
      });

      const retrieved = await storage.getDecision(added.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe("Use PostgreSQL");
    });

    it("should list all decisions", async () => {
      await storage.addDecision({
        title: "Decision 1",
        context: "Context",
        decision: "Choice",
        reasoning: "Reason",
        sourceTrajectory: "traj_1",
        sourceDate: "2024-01-15T10:00:00Z",
        tags: [],
        status: "active",
      });

      await storage.addDecision({
        title: "Decision 2",
        context: "Context",
        decision: "Choice",
        reasoning: "Reason",
        sourceTrajectory: "traj_2",
        sourceDate: "2024-01-16T10:00:00Z",
        tags: [],
        status: "active",
      });

      const decisions = await storage.listDecisions();
      expect(decisions).toHaveLength(2);
    });

    it("should update a decision", async () => {
      const added = await storage.addDecision({
        title: "Original title",
        context: "Context",
        decision: "Choice",
        reasoning: "Reason",
        sourceTrajectory: "traj_1",
        sourceDate: "2024-01-15T10:00:00Z",
        tags: [],
        status: "active",
      });

      const updated = await storage.updateDecision(added.id, {
        status: "superseded",
        supersededBy: "dec_new123",
      });

      expect(updated?.status).toBe("superseded");
      expect(updated?.supersededBy).toBe("dec_new123");
    });
  });

  describe("Patterns", () => {
    it("should add a pattern", async () => {
      const pattern = await storage.addPattern({
        title: "API Endpoint",
        description: "Standard REST endpoint structure",
        when: "Creating new API endpoints",
        structure: "router.get('/path', handler)",
        sourceTrajectories: [],
        tags: ["api", "rest"],
      });

      expect(pattern.id).toMatch(/^pat_/);
      expect(pattern.title).toBe("API Endpoint");
      expect(pattern.createdAt).toBeDefined();
    });

    it("should list patterns", async () => {
      await storage.addPattern({
        title: "Pattern A",
        description: "Description",
        when: "When",
        structure: "Structure",
        sourceTrajectories: [],
        tags: [],
      });

      const patterns = await storage.listPatterns();
      expect(patterns).toHaveLength(1);
    });
  });

  describe("Knowledge", () => {
    it("should add knowledge", async () => {
      const knowledge = await storage.addKnowledge({
        title: "Architecture Overview",
        category: "architecture",
        content: "# Overview\nThis project uses...",
        sourceTrajectories: [],
        tags: ["architecture"],
      });

      expect(knowledge.id).toMatch(/^know_/);
      expect(knowledge.category).toBe("architecture");
    });

    it("should list knowledge", async () => {
      await storage.addKnowledge({
        title: "Conventions",
        category: "convention",
        content: "# Conventions\nWe follow...",
        sourceTrajectories: [],
        tags: [],
      });

      const knowledge = await storage.listKnowledge();
      expect(knowledge).toHaveLength(1);
    });
  });

  describe("Query", () => {
    it("should search decisions", async () => {
      await storage.addDecision({
        title: "Use JWT for authentication",
        context: "Auth implementation",
        decision: "JWT",
        reasoning: "Stateless",
        sourceTrajectory: "traj_1",
        sourceDate: "2024-01-15T10:00:00Z",
        tags: ["auth"],
        status: "active",
      });

      await storage.addDecision({
        title: "Use PostgreSQL",
        context: "Database",
        decision: "PostgreSQL",
        reasoning: "JSON support",
        sourceTrajectory: "traj_2",
        sourceDate: "2024-01-15T10:00:00Z",
        tags: ["database"],
        status: "active",
      });

      const results = await storage.query({ query: "auth" });
      expect(results.decisions).toHaveLength(1);
      expect(results.decisions[0].title).toContain("JWT");
    });

    it("should search patterns", async () => {
      await storage.addPattern({
        title: "REST Endpoint",
        description: "Standard REST API endpoint",
        when: "Creating API endpoints",
        structure: "router.get(...)",
        sourceTrajectories: [],
        tags: ["api"],
      });

      const results = await storage.query({
        query: "api",
        type: "pattern",
      });

      expect(results.patterns).toHaveLength(1);
    });

    it("should search knowledge", async () => {
      await storage.addKnowledge({
        title: "Testing Guide",
        category: "guide",
        content: "# Testing\nWe use vitest for testing...",
        sourceTrajectories: [],
        tags: ["testing"],
      });

      const results = await storage.query({
        query: "testing",
        type: "knowledge",
      });

      expect(results.knowledge).toHaveLength(1);
    });

    it("should limit results", async () => {
      for (let i = 0; i < 5; i++) {
        await storage.addDecision({
          title: `Auth decision ${i}`,
          context: "Auth",
          decision: "Choice",
          reasoning: "Reason",
          sourceTrajectory: `traj_${i}`,
          sourceDate: "2024-01-15T10:00:00Z",
          tags: ["auth"],
          status: "active",
        });
      }

      const results = await storage.query({ query: "auth", limit: 2 });
      expect(results.decisions).toHaveLength(2);
    });
  });

  describe("Export", () => {
    it("should export full workspace", async () => {
      await storage.addDecision({
        title: "Decision",
        context: "Context",
        decision: "Choice",
        reasoning: "Reason",
        sourceTrajectory: "traj_1",
        sourceDate: "2024-01-15T10:00:00Z",
        tags: [],
        status: "active",
      });

      await storage.addPattern({
        title: "Pattern",
        description: "Desc",
        when: "When",
        structure: "Structure",
        sourceTrajectories: [],
        tags: [],
      });

      const exported = await storage.export();
      expect(exported.decisions).toHaveLength(1);
      expect(exported.patterns).toHaveLength(1);
      expect(exported.version).toBe(1);
    });
  });
});
