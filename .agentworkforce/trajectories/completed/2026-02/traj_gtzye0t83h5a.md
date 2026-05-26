# Trajectory: agent-trace spec compliance and ecosystem positioning

> **Status:** ✅ Completed
> **Confidence:** 95%
> **Started:** February 19, 2026 at 08:46 AM
> **Completed:** February 19, 2026 at 08:47 AM

---

## Summary

Aligned agent-trace output to 0.1.0 spec: contributor type (ai), model_id field, semver version string, UUID trace IDs via crypto.randomUUID(), models.dev model format. Updated README with ecosystem stack positioning, multi-agent as top-level feature, and roadmap with MCP server. PR #12 opened. Key learning: our ID format was never a deliberate decision — crypto.randomUUID() was always available. agent-trace has no adopters list yet — first implementation listing is a traction opportunity.

**Approach:** Fetched agent-trace schema, diffed against our trace.ts output, made targeted changes across types.ts/schema.ts/trace.ts/show.ts, updated tests, resolved merge conflict with main, recorded all decisions as trajectory events.

---

## Key Decisions

### Use 'ai' instead of 'agent' for ContributorType
- **Chose:** Use 'ai' instead of 'agent' for ContributorType
- **Rejected:** Keep 'agent' as a non-compliant extension
- **Reasoning:** agent-trace spec defines the enum as human/ai/mixed/unknown — 'agent' is not a valid value. Aligning to spec for interoperability.

### Rename model to model_id on TraceContributor
- **Chose:** Rename model to model_id on TraceContributor
- **Rejected:** Keep 'model' with a custom convention
- **Reasoning:** agent-trace spec uses model_id field name with models.dev convention (org/model). Renamed to match spec exactly.

### Switch version field from number (1) to semver string ('1.0.0')
- **Chose:** Switch version field from number (1) to semver string ('1.0.0')
- **Rejected:** Keep version: 1 as a number (non-compliant)
- **Reasoning:** agent-trace spec defines version as a semantic version string, not a number. Changed to '1.0.0' for full compliance.

### Switch generateTraceId() from custom nanoid-style to crypto.randomUUID()
- **Chose:** Switch generateTraceId() from custom nanoid-style to crypto.randomUUID()
- **Rejected:** Keep trace_[nanoid] format and document the variance
- **Reasoning:** agent-trace spec requires UUID format for trace record IDs. Node 20+ has crypto.randomUUID() built in with zero added dependencies. Our minimum is already Node 20+.

### Normalize detectModel() output to models.dev format (org/model-name)
- **Chose:** Normalize detectModel() output to models.dev format (org/model-name)
- **Rejected:** Pass through raw env var value unchanged
- **Reasoning:** agent-trace spec uses models.dev convention. ANTHROPIC_MODEL=claude-opus-4 should become anthropic/claude-opus-4 for interoperability across tools.

---

## Chapters

### 1. Initial work
*Agent: Discoverer*

- Use 'ai' instead of 'agent' for ContributorType: Use 'ai' instead of 'agent' for ContributorType
- Rename model to model_id on TraceContributor: Rename model to model_id on TraceContributor
- Switch version field from number (1) to semver string ('1.0.0'): Switch version field from number (1) to semver string ('1.0.0')
- Switch generateTraceId() from custom nanoid-style to crypto.randomUUID(): Switch generateTraceId() from custom nanoid-style to crypto.randomUUID()
- Normalize detectModel() output to models.dev format (org/model-name): Normalize detectModel() output to models.dev format (org/model-name)
