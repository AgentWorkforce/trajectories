/**
 * Workspace types - knowledge layer extracted from trajectories
 */

/**
 * A decision promoted to the workspace for future reference
 */
export interface WorkspaceDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  reasoning: string;
  alternatives?: string[];
  consequences?: string[];
  sourceTrajectory: string;
  sourceDate: string;
  tags: string[];
  status: "active" | "superseded" | "deprecated";
  supersededBy?: string;
}

/**
 * A reusable pattern extracted from trajectories
 */
export interface WorkspacePattern {
  id: string;
  title: string;
  description: string;
  when: string; // When to use this pattern
  structure: string; // Template or structure
  example?: string; // Example usage
  sourceTrajectories: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Knowledge document - architecture, conventions, etc
 */
export interface WorkspaceKnowledge {
  id: string;
  title: string;
  category: "architecture" | "convention" | "guide" | "reference";
  content: string; // Markdown content
  sourceTrajectories: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Query for searching the workspace
 */
export interface WorkspaceQuery {
  type?: "decision" | "pattern" | "knowledge" | "trajectory" | "any";
  query: string;
  context?: string; // Current task context
  tags?: string[];
  limit?: number;
}

/**
 * Result from a workspace query
 */
export interface WorkspaceQueryResult {
  decisions: WorkspaceDecision[];
  patterns: WorkspacePattern[];
  knowledge: WorkspaceKnowledge[];
  trajectories: Array<{
    id: string;
    title: string;
    relevance: string;
  }>;
}

/**
 * The full workspace state
 */
export interface Workspace {
  projectId: string;
  decisions: WorkspaceDecision[];
  patterns: WorkspacePattern[];
  knowledge: WorkspaceKnowledge[];
  version: number;
  lastUpdated: string;
}
