# Spec 85 — mock-trajectories.ts

Write the following file to `trail-viewer/server/src/mock-trajectories.ts`.

```typescript
import type {
  Trajectory,
  TrajectoryStatus,
  TrajectorySummary,
  TrajectoryQuery,
  Chapter,
  TrajectoryEvent,
  Decision,
  Retrospective,
  AgentParticipation,
} from "agent-trajectories";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const now = Date.now();
const hours = (n: number) => n * 60 * 60 * 1000;
const days = (n: number) => n * 24 * hours(1);

// ---------------------------------------------------------------------------
// 1. COMPLETED — "Implement JWT Authentication"
// ---------------------------------------------------------------------------

const jwtAuthTrajectory: Trajectory = {
  id: "traj-jwt-auth-001",
  version: 1,
  task: {
    title: "Implement JWT Authentication",
    description:
      "Add JWT-based authentication to the API, including token generation, refresh tokens, and middleware.",
  },
  status: "completed",
  startedAt: new Date(now - days(7)).toISOString(),
  completedAt: new Date(now - days(5)).toISOString(),
  agents: [
    {
      name: "lead-claude",
      role: "lead",
      joinedAt: new Date(now - days(7)).toISOString(),
      leftAt: new Date(now - days(5)).toISOString(),
    },
    {
      name: "impl-codex",
      role: "contributor",
      joinedAt: new Date(now - days(7) + hours(1)).toISOString(),
      leftAt: new Date(now - days(5)).toISOString(),
    },
  ],
  chapters: [
    {
      id: "ch-jwt-1",
      title: "Research & Planning",
      agentName: "lead-claude",
      startedAt: new Date(now - days(7)).toISOString(),
      endedAt: new Date(now - days(7) + hours(4)).toISOString(),
      events: [
        {
          ts: now - days(7),
          type: "tool_call",
          content: "Researched existing authentication patterns in the codebase",
          significance: "medium",
          tags: ["research"],
        },
        {
          ts: now - days(7) + hours(1),
          type: "finding",
          content:
            "Designed JWT flow: login → access token + refresh token, middleware validates on each request",
          significance: "high",
          tags: ["design"],
        },
        {
          ts: now - days(7) + hours(3),
          type: "decision",
          content:
            "Selected jose, jsonwebtoken, and bcrypt as core libraries after comparing alternatives",
          significance: "high",
          tags: ["libraries"],
        },
      ],
    },
    {
      id: "ch-jwt-2",
      title: "Implementation",
      agentName: "impl-codex",
      startedAt: new Date(now - days(6)).toISOString(),
      endedAt: new Date(now - days(5) + hours(6)).toISOString(),
      events: [
        {
          ts: now - days(6),
          type: "tool_call",
          content: "Created auth middleware with JWT verification and role-based access control",
          significance: "high",
          tags: ["middleware", "auth"],
        },
        {
          ts: now - days(6) + hours(2),
          type: "tool_call",
          content:
            "Implemented token generation service with configurable expiry and signing algorithms",
          significance: "high",
          tags: ["tokens"],
        },
        {
          ts: now - days(6) + hours(5),
          type: "tool_call",
          content: "Added refresh token rotation with automatic revocation of old tokens",
          significance: "high",
          tags: ["refresh-tokens"],
        },
        {
          ts: now - days(6) + hours(8),
          type: "tool_call",
          content: "Wrote User model with password hashing and email-based lookup",
          significance: "medium",
          tags: ["model", "user"],
        },
      ],
    },
    {
      id: "ch-jwt-3",
      title: "Testing & Deployment",
      agentName: "impl-codex",
      startedAt: new Date(now - days(5) + hours(8)).toISOString(),
      endedAt: new Date(now - days(5) + hours(16)).toISOString(),
      events: [
        {
          ts: now - days(5) + hours(8),
          type: "tool_call",
          content: "Wrote unit tests for token generation, validation, and refresh flow",
          significance: "medium",
          tags: ["testing", "unit"],
        },
        {
          ts: now - days(5) + hours(12),
          type: "tool_call",
          content:
            "Added integration tests covering login, protected routes, and token expiry scenarios",
          significance: "high",
          tags: ["testing", "integration"],
        },
        {
          ts: now - days(5) + hours(16),
          type: "tool_call",
          content: "Deployed to staging environment and verified end-to-end auth flow",
          significance: "high",
          tags: ["deployment", "staging"],
        },
      ],
    },
  ],
  retrospective: {
    summary:
      "Successfully implemented JWT authentication with access and refresh tokens. The system supports role-based access control and automatic token rotation.",
    approach:
      "Started with research and library selection, then implemented core auth middleware, token services, and user model. Finished with comprehensive testing and staging deployment.",
    decisions: [
      {
        question: "Which JWT library to use?",
        chosen: "jose",
        reasoning:
          "Standard compliant, actively maintained, good TypeScript support",
        alternatives: [
          { option: "jsonwebtoken", reason: "Most popular but lacks modern ES module support" },
          { option: "fast-jwt", reason: "Fast but smaller community and fewer features" },
        ],
      },
      {
        question: "Token storage strategy?",
        chosen: "HTTP-only cookies",
        reasoning: "More secure than localStorage, prevents XSS attacks",
        alternatives: [
          { option: "localStorage", reason: "Simple but vulnerable to XSS" },
          { option: "sessionStorage", reason: "Lost on tab close, poor UX" },
        ],
      },
    ],
    challenges: [
      "Handling token rotation race conditions when multiple requests fire simultaneously",
      "Ensuring backwards compatibility with existing session-based auth during migration",
    ],
    learnings: [
      "jose library provides better TypeScript types than jsonwebtoken, reducing runtime errors",
      "Refresh token rotation requires careful handling of concurrent requests to avoid accidental revocation",
      "HTTP-only cookies need proper CORS configuration for cross-origin API calls",
    ],
    suggestions: [
      "Consider adding rate limiting to the login endpoint to prevent brute-force attacks",
      "Add monitoring for failed authentication attempts to detect potential security incidents",
    ],
    confidence: 0.92,
    timeSpent: "2 days",
  },
  commits: [
    "abc1234",
    "def5678",
    "ghi9012",
  ],
  filesChanged: [
    "src/middleware/auth.ts",
    "src/services/token.ts",
    "src/models/user.ts",
    "src/routes/auth.ts",
    "tests/auth.test.ts",
  ],
  projectId: "proj-main",
  tags: ["auth", "security"],
};

// ---------------------------------------------------------------------------
// 2. ACTIVE — "Refactor Payment Pipeline"
// ---------------------------------------------------------------------------

const paymentRefactorTrajectory: Trajectory = {
  id: "traj-payment-refactor-002",
  version: 1,
  task: {
    title: "Refactor Payment Pipeline",
    description:
      "Modernize the payment processing pipeline with better abstraction, error handling, and support for multiple payment processors.",
  },
  status: "active",
  startedAt: new Date(now - days(2)).toISOString(),
  agents: [
    {
      name: "lead-claude",
      role: "lead",
      joinedAt: new Date(now - days(2)).toISOString(),
    },
    {
      name: "refactor-sonnet",
      role: "contributor",
      joinedAt: new Date(now - days(2) + hours(2)).toISOString(),
    },
  ],
  chapters: [
    {
      id: "ch-pay-1",
      title: "Analysis",
      agentName: "lead-claude",
      startedAt: new Date(now - days(2)).toISOString(),
      endedAt: new Date(now - days(2) + hours(6)).toISOString(),
      events: [
        {
          ts: now - days(2),
          type: "tool_call",
          content: "Mapped existing payment flow: 4 processors, 12 endpoints, no shared interface",
          significance: "high",
          tags: ["analysis"],
        },
        {
          ts: now - days(2) + hours(2),
          type: "finding",
          content:
            "Found 340 lines of duplicated error handling across Stripe, PayPal, and Square integrations",
          significance: "critical",
          tags: ["duplication", "tech-debt"],
        },
        {
          ts: now - days(2) + hours(5),
          type: "decision",
          content:
            "Chose Strategy pattern for payment processor abstraction over Adapter and Factory patterns",
          significance: "high",
          tags: ["architecture"],
        },
      ],
    },
    {
      id: "ch-pay-2",
      title: "Refactoring",
      agentName: "refactor-sonnet",
      startedAt: new Date(now - days(1)).toISOString(),
      events: [
        {
          ts: now - days(1),
          type: "tool_call",
          content: "Created PaymentProcessor interface and base abstract class",
          significance: "high",
          tags: ["refactoring", "interface"],
        },
        {
          ts: now - days(1) + hours(4),
          type: "tool_call",
          content: "Migrated Stripe integration to new PaymentProcessor interface",
          significance: "medium",
          tags: ["refactoring", "stripe"],
        },
        {
          ts: now - hours(6),
          type: "reflection",
          content:
            "PayPal migration in progress — their webhook format requires additional normalization layer",
          significance: "medium",
          tags: ["in-progress", "paypal"],
        },
      ],
    },
  ],
  retrospective: undefined,
  commits: ["jkl3456", "mno7890"],
  filesChanged: [
    "src/payments/processor.ts",
    "src/payments/stripe.ts",
    "src/payments/paypal.ts",
  ],
  projectId: "proj-main",
  tags: ["payments", "refactoring", "backend"],
};

// ---------------------------------------------------------------------------
// 3. ABANDONED — "Migrate to GraphQL"
// ---------------------------------------------------------------------------

const graphqlMigrationTrajectory: Trajectory = {
  id: "traj-graphql-migration-003",
  version: 1,
  task: {
    title: "Migrate to GraphQL",
    description:
      "Evaluate and migrate existing REST API endpoints to a GraphQL schema.",
  },
  status: "abandoned",
  startedAt: new Date(now - days(14)).toISOString(),
  completedAt: new Date(now - days(10)).toISOString(),
  agents: [
    {
      name: "lead-claude",
      role: "lead",
      joinedAt: new Date(now - days(14)).toISOString(),
      leftAt: new Date(now - days(10)).toISOString(),
    },
  ],
  chapters: [
    {
      id: "ch-gql-1",
      title: "Exploration",
      agentName: "lead-claude",
      startedAt: new Date(now - days(14)).toISOString(),
      endedAt: new Date(now - days(10)).toISOString(),
      events: [
        {
          ts: now - days(14),
          type: "tool_call",
          content:
            "Inventoried 47 REST endpoints across 8 resource types for potential GraphQL migration",
          significance: "medium",
          tags: ["inventory"],
        },
        {
          ts: now - days(12),
          type: "finding",
          content:
            "Prototyped GraphQL schema for User and Order types — resolver complexity significantly higher than expected",
          significance: "high",
          tags: ["prototype"],
        },
        {
          ts: now - days(10),
          type: "error",
          content:
            "Migration deemed infeasible: N+1 query problems require DataLoader for every relation, auth middleware incompatible with GraphQL context pattern, estimated 3-4 weeks for 2-person team",
          significance: "critical",
          tags: ["blocker", "abandoned"],
        },
      ],
    },
  ],
  retrospective: {
    summary:
      "Abandoned after exploration phase. The complexity of migrating 47 REST endpoints to GraphQL was too high for the current team size. The existing REST API is well-structured and meeting performance requirements. The effort-to-benefit ratio did not justify proceeding.",
    approach:
      "Inventoried existing endpoints, prototyped schema for core types, and evaluated migration effort.",
    challenges: [
      "N+1 query problems required DataLoader for every relation",
      "Existing auth middleware incompatible with GraphQL context pattern",
    ],
    learnings: [
      "GraphQL migration is better suited for greenfield projects or APIs with complex nested data requirements",
    ],
    confidence: 0.85,
  },
  commits: [],
  filesChanged: [],
  projectId: "proj-main",
  tags: ["graphql", "api", "migration"],
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const MOCK_TRAJECTORIES: Trajectory[] = [
  jwtAuthTrajectory,
  paymentRefactorTrajectory,
  graphqlMigrationTrajectory,
];

// ---------------------------------------------------------------------------
// MockTrajectoryService
// ---------------------------------------------------------------------------

function toSummary(t: Trajectory): TrajectorySummary {
  let decisionCount = 0;
  if (t.retrospective?.decisions) {
    decisionCount = t.retrospective.decisions.length;
  }

  return {
    id: t.id,
    title: t.task.title,
    status: t.status,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    chapterCount: t.chapters.length,
    decisionCount,
  };
}

export class MockTrajectoryService {
  private trajectories: Trajectory[] = MOCK_TRAJECTORIES;

  async init(): Promise<void> {
    // no-op — data is in-memory
  }

  async listTrajectories(query?: {
    status?: TrajectoryStatus;
    search?: string;
    tags?: string[];
  }): Promise<TrajectorySummary[]> {
    let results = [...this.trajectories];

    if (query?.status) {
      results = results.filter((t) => t.status === query.status);
    }

    if (query?.search) {
      const term = query.search.toLowerCase();
      results = results.filter(
        (t) =>
          t.task.title.toLowerCase().includes(term) ||
          (t.task.description ?? "").toLowerCase().includes(term),
      );
    }

    if (query?.tags && query.tags.length > 0) {
      const required = query.tags;
      results = results.filter((t) =>
        required.every((tag) => t.tags.includes(tag)),
      );
    }

    return results.map(toSummary);
  }

  async getTrajectory(id: string): Promise<Trajectory | null> {
    return this.trajectories.find((t) => t.id === id) ?? null;
  }

  async searchTrajectories(text: string): Promise<TrajectorySummary[]> {
    const term = text.toLowerCase();
    return this.trajectories
      .filter((t) => {
        const blob = JSON.stringify(t).toLowerCase();
        return blob.includes(term);
      })
      .map(toSummary);
  }

  async getTrajectoryMarkdown(id: string): Promise<string> {
    const t = await this.getTrajectory(id);
    if (!t) return "";

    const lines: string[] = [];
    lines.push(`# ${t.task.title}`);
    lines.push("");
    lines.push(`**Status:** ${t.status}  `);
    lines.push(`**Started:** ${t.startedAt}  `);
    if (t.completedAt) lines.push(`**Completed:** ${t.completedAt}  `);
    lines.push(`**Tags:** ${t.tags.join(", ")}`);
    lines.push("");

    lines.push("## Agents");
    for (const a of t.agents) {
      lines.push(`- **${a.name}** (${a.role})`);
    }
    lines.push("");

    for (const ch of t.chapters) {
      lines.push(`## ${ch.title}`);
      for (const ev of ch.events) {
        lines.push(`- [${ev.type}] ${ev.content}`);
      }
      lines.push("");
    }

    if (t.retrospective) {
      lines.push("## Retrospective");
      lines.push(t.retrospective.summary);
      lines.push("");

      if (t.retrospective.decisions?.length) {
        lines.push("### Decisions");
        for (const d of t.retrospective.decisions) {
          lines.push(`- **${d.question}** → ${d.chosen} (${d.reasoning})`);
        }
        lines.push("");
      }

      if (t.retrospective.learnings?.length) {
        lines.push("### Learnings");
        for (const l of t.retrospective.learnings) {
          lines.push(`- ${l}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  async getTrajectoryTimeline(id: string): Promise<string> {
    const t = await this.getTrajectory(id);
    if (!t) return "";

    const lines: string[] = [];
    lines.push(`Timeline: ${t.task.title}`);
    lines.push("=".repeat(40));

    for (const ch of t.chapters) {
      lines.push("");
      lines.push(`[${ch.title}]`);
      for (const ev of ch.events) {
        const time = new Date(ev.ts).toISOString().slice(0, 16);
        const sig = ev.significance ? ` (${ev.significance})` : "";
        lines.push(`  ${time} | ${ev.type}${sig}: ${ev.content}`);
      }
    }

    return lines.join("\n");
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    abandoned: number;
  }> {
    const stats = { total: this.trajectories.length, active: 0, completed: 0, abandoned: 0 };

    for (const t of this.trajectories) {
      if (t.status === "active") stats.active++;
      else if (t.status === "completed") stats.completed++;
      else if (t.status === "abandoned") stats.abandoned++;
    }

    return stats;
  }
}

export default MockTrajectoryService;
```
