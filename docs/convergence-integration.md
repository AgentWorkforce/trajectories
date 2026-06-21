# Convergence Integration — the Trajectory Lens in Agent Relay Loop

**How trajectory data maps into the Agent Relay Loop convergence store.**

Agent Relay Loop converges three capture lenses into one normalized event store
(`convergence_events` in `relayhistory-cloud`):

- **cost/usage** — `burn`
- **reasoning** — `trajectories` (this repo)
- **recall** — `ai-hist` / `relayhistory`

This doc is the **source-of-truth mapping for the reasoning lens**: what a tool emits
when it pushes trajectory data, and how it lands in the store. It is the trajectory
slice of the ratified WS-1 contract.

> **Authoritative schema:** `relayhistory-cloud/docs/decisions/2026-06-21-normalized-agent-event-schema.md`
> (the WS-1 ADR). This doc describes the same contract from the trajectory side; if they
> ever diverge, the ADR wins.

---

## The convergence envelope

A client emits one **envelope per event** in the `records[]` of `POST /v1/ingest`.
Tenancy (`orgId`/`workspaceId`/`machineId`/`userId`) is **never sent** — the server
derives it from the `rth_at_*` auth context. The client sends provenance + content only.

```jsonc
{
  "v": 1,
  "kind": "decision",                  // event class — IN THE PK
  "source": "trajectories",            // capture lens/harness — IN THE PK
  "lens": "trajectories",              // non-PK query facet
  "sessionId": "traj_abc",             // = the trajectory id — IN THE PK
  "eventId": "decision:traj_abc:0",    // deterministic, namespaced — IN THE PK
  "ts": "2026-06-21T10:00:00.000Z",    // ISO-8601 (convert epoch-ms → ISO before emit)
  "type": "decision",
  "content": "Question: …\nChose: …",  // RAW readable text (no `Task:` prefix — server adds it)
  "confidence": 0.9,                   // source-native float 0..1 (server converts)
  "actorName": "planner",              // from persona_id / agent
  "taskTitle": "Build WS-1 schema",    // structured field (server folds into content)
  "record": { "decision": { "chosen": "…", "alternatives": ["…"] } }
}
```

Natural key (PK): `(orgId, machineId, source, sessionId, kind, eventId)`. Re-pushing the
same event upserts the same row — sync is idempotent.

---

## Field mapping: trajectory schema → convergence envelope

| Trajectory source (`src/core/schema.ts`) | Convergence field | Notes |
| --- | --- | --- |
| `Trajectory.id` (`traj_…`) | `sessionId` | the trajectory IS the session for this lens |
| `TrajectoryEvent.ts` (epoch-ms `number`) | `ts` | **convert epoch-ms → ISO-8601** before emit |
| `TrajectoryEvent.type` | `type` | reasoning vocab carried through |
| `TrajectoryEvent.content` | `content` | raw; server scrubs + prepends `Task:` |
| `TrajectoryEvent.significance` | `significance` | enum (`low\|medium\|high\|critical`) — never numeric |
| `TrajectoryEvent.confidence` / `Decision.confidence` / `Retrospective.confidence` | `confidence` | float `0..1` on the wire; server → `confidence_basis_points` (×10000) |
| `TrajectoryEvent.tags` | `tags` | carried through |
| `TrajectoryEvent.raw` | — | **dropped** by default-tier scrub; never emitted |
| `agents[].name` / `chapter.agentName` (`persona_id`) | `actorName` | "which engineer/agent" attribution |
| `Trajectory.projectId` | `projectId` | |
| `Trajectory.task.title/description/status` | `taskTitle` / `taskDescription` / `taskStatus` | structured fields; `taskTitle` feeds embedding via server `Task:` enrichment |
| `Trajectory.task.source` `{system,id}` | `taskRef` | future cross-lens correlation seed (often `null`; not persisted by `ai-hist` yet) |
| `Decision` `{question,chosen,reasoning,alternatives}` | `content` + `record.decision` | client renders readable `content`; `alternatives` is `string[] \| {option,reason}[]` |
| `Retrospective.{summary,approach,learnings[],suggestions[],challenges[]}` | fan-out events | see below |
| agent-trace `files[].path/ranges` | `filesTouched` / `codeChurn` | |

---

## Event-id scheme (deterministic, kind-namespaced, collision-free)

`TrajectoryEvent` has **no native id**, so ids are synthesized deterministically so the
same event always re-pushes to the same PK:

| Source | `kind` | `eventId` |
| --- | --- | --- |
| chapter stream event | (event type) | `trajevent:<chapterId>:<arrayIndex>` *(deferred — see scope)* |
| decision[i] | `decision` | `decision:<trajectoryId>:<i>` |
| retrospective `learnings[i]` | `finding` | `finding:<trajectoryId>:learning:<i>` |
| retrospective `challenges[i]` | `finding` | `finding:<trajectoryId>:challenge:<i>` |
| retrospective `suggestions[i]` | `reflection` | `reflection:<trajectoryId>:suggestion:<i>` |
| retrospective `summary` | `reflection` | `reflection:<trajectoryId>:summary` |
| retrospective `approach` | `reflection` | `reflection:<trajectoryId>:approach` |

**Rules that keep this collision-free:**
- `kind` is in the PK, and the `:<arrayName>:` segment disambiguates same-kind arrays
  (so `finding:…:learning:0` ≠ `finding:…:challenge:0`).
- Retrospective events key off **`trajectoryId`, not `chapterId`** — the retrospective is
  trajectory-level and has no chapter.
- Index by **natural stored array order** — never sort/dedupe/filter before indexing, or
  indices shift and idempotency breaks.
- Emit explicit ids; never rely on a server fallback for retro events.

---

## Server-owned transforms (do NOT do these client-side)

The ingest server is the boundary that normalizes. Clients send raw + source-native:

- **Confidence:** wire carries float `0..1`; server `toBasisPoints()` → `confidence_basis_points`
  (int `0..10000`). One conversion point. Do not pre-convert. Confidence is **not** shadowed
  in `record` — single persisted scale.
- **Task enrichment:** server prepends `Task: <taskTitle>` (and `Task description:`) to
  `content` before embedding. The client sends **raw** content — do **not** pre-prefix, or
  you double it.
- **Scrub (compliance boundary):** server redacts secrets/PII in `content` in place; drops
  `raw` wholesale; minimizes `record` to a bounded allowlist; normalizes home-dir paths
  (`/Users/<name>/` → `~`). Client-side scrub is defense-in-depth only, never the boundary.

---

## v1 scope vs deferred

- **v1 (shipping):** the **distilled** lens — `decisions` + `retrospective`. This is the
  highest signal-per-byte (it powers Plan/WS-5) and is what `ai-hist`'s local store
  persists today.
- **Deferred to WS-6/Pair:** the full **chapter event stream** (`trajevent:*` —
  prompts/thinking/tool_calls). It is not in `ai-hist`'s local store and requires re-parsing
  the source trajectory file via its `path`. Sequenced with Pair because the raw sequence is
  what real-time failure-mode warnings need.

---

## Acceptance fixture

The trajectory→row contract is pinned end-to-end by one shared fixture (`traj_abc`),
asserted from both ends:

- **client:** `ai-hist-core` Rust `matches_trajectory_expert_acceptance_fixture`
- **server:** `relayhistory-cloud` PGlite `ingest-integration.test.ts`

A decision (confidence 0.9) + a retrospective (summary/approach 0.8; one learning,
suggestion, challenge) produces exactly 6 rows:

| eventId | kind | confidence_basis_points |
| --- | --- | --- |
| `decision:traj_abc:0` | decision | 9000 |
| `reflection:traj_abc:summary` | reflection | 8000 |
| `reflection:traj_abc:approach` | reflection | 8000 |
| `finding:traj_abc:learning:0` | finding | null |
| `reflection:traj_abc:suggestion:0` | reflection | null |
| `finding:traj_abc:challenge:0` | finding | null |

All rows: `source`/`lens = "trajectories"`, `session_id = "traj_abc"`,
`task_title = "Build WS-1 schema"`, `content` server-prefixed with `Task:`, re-push → still
6 rows (idempotent).
