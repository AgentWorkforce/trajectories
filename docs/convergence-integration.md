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

---

## Addendum (v1.1): compacted roll-up schema — the LLM-compaction lens

**Why this exists.** The LLM-compaction workflow writes
`~/Projects/<repo>/.trajectories/compacted/compact_*.json` — roll-ups that distill many
source trajectories into the highest signal-per-byte reasoning (decisions, lessons, key
findings). Empirically these carry **more Pair-surfaceable value** than per-run `completed/`
trajectories (a 200-file sample of `completed/` was ~94% `summary`/`approach` only — 0
decisions/suggestions; the compacted roll-ups average ~9 decisions + ~27 keyFindings + ~8
lessons each). `parse_trajectory_file` historically **skipped** `type == "compacted"`
(treated as non-ingestable summaries) — which is why an all-`prompt` corpus reached prod and
Pair stayed silent on real data. This addendum defines how to ingest them.

**Compacted envelope (observed shape):**
```jsonc
{
  "id": "compact_d60kxya4ert0_2026-04-20",   // → sessionId / trajectoryId / eventId namespace
  "type": "compacted",
  "sourceTrajectories": ["traj_…", …],        // provenance only — NOT mapped to events
  "decisions":   [{ question, chosen, reasoning, impact }, …],
  "decisionGroups": [{ category, decisions:[…] }, …],   // categorization view — NOT mapped (double-count)
  "keyFindings": ["…", …],
  "keyLearnings":["…", …],
  "lessons":     [{ context, lesson, recommendation }, …],
  "conventions": [{ pattern, rationale, scope }, …],
  "narrative":   "…",
  "openQuestions":["…", …]
}
```

**Mapping: compacted field → convergence event**

| Compacted field | `kind` | `eventId` | value |
| --- | --- | --- | --- |
| `decisions[i]` | `decision` | `decision:<id>:<i>` | high |
| `lessons[i]` (`recommendation` is the actionable nudge) | `reflection` | `reflection:<id>:lesson:<i>` | **highest — the "remember to…" equivalent** |
| `keyFindings[i]` | `finding` | `finding:<id>:keyfinding:<i>` | med |
| `keyLearnings[i]` | `finding` | `finding:<id>:learning:<i>` | med |
| `conventions[i]` | `reflection` | `reflection:<id>:convention:<i>` | med |
| `narrative` | `reflection` | `reflection:<id>:summary` | low |
| `openQuestions[i]` | `finding` | `finding:<id>:openquestion:<i>` | low |
| `decisionGroups` | — | *(skip)* | categorization of `decisions[]`; emitting it double-counts. Optionally fold `.category` into the matching decision event's `tags`. |

**Rules (consistent with the v1 contract above):**
- `sessionId` = `trajectoryId` = the compaction `id`; `source`/`lens = "trajectories"`.
- Every compacted-derived event carries `tag: "compacted"` so roll-up reasoning is
  distinguishable from per-run trajectory events (and Pair/queries can filter if desired).
- Index by **natural stored array order**; never sort/dedup/filter before indexing (idempotent PK).
- `content` = raw readable text (e.g. a lesson → `"Lesson: …\nRecommendation: …"`); the
  **server** scrubs + Task-enriches. Client never pre-prefixes.
- No per-item `confidence` in this schema → `confidence` omitted → `confidence_basis_points = null`.
  `significance` omitted unless the workflow emits it.
- `parse_trajectory_file` must **stop skipping** `type == "compacted"` (add a compacted branch);
  `map_compacted` applies the table above. Per-run trajectory mapping is unchanged.

**Acceptance fixture (`compact_fixture`) — pinned both ends like `traj_abc`:**

A compacted file with 2 `decisions`, 2 `keyFindings`, 1 `keyLearnings`, 2 `lessons`,
1 `conventions`, a `narrative`, and 1 `openQuestions` produces exactly **10 rows**:

| eventId | kind |
| --- | --- |
| `decision:compact_fixture:0` | decision |
| `decision:compact_fixture:1` | decision |
| `finding:compact_fixture:keyfinding:0` | finding |
| `finding:compact_fixture:keyfinding:1` | finding |
| `finding:compact_fixture:learning:0` | finding |
| `finding:compact_fixture:openquestion:0` | finding |
| `reflection:compact_fixture:convention:0` | reflection |
| `reflection:compact_fixture:lesson:0` | reflection |
| `reflection:compact_fixture:lesson:1` | reflection |
| `reflection:compact_fixture:summary` | reflection |

All rows: `source`/`lens = "trajectories"`, `session_id = "compact_fixture"`, `tag` contains
`"compacted"`, `content` server-prefixed with `Task:`; re-push → still 10 rows (idempotent).
Counts: `decision×2`, `finding×4` (2 keyfinding + 1 learning + 1 openquestion),
`reflection×4` (2 lesson + 1 convention + 1 summary).

**Scrub-bait (load-bearing — pins server-scrub on the new path):** `lessons[0].recommendation`
in the fixture carries a planted secret
`ghp_FAKE0000000000000000000000000000abcd`. The resulting
`reflection:compact_fixture:lesson:0` `content` **must** contain `[REDACTED]` and **must not**
contain `ghp_`. (A clean-only fixture would make a "scrub ✅" vacuous — same self-validating-bait
principle as the per-run `finding:traj_abc:learning:0` bait.)

### Security acceptance criteria (per reviewer — the mapper is reviewed against these)
1. **Scrub fires on the new path** — the planted bait above ingests as `[REDACTED]` (server-side
   scrub, the compliance boundary; `recommendation`/`reasoning`/`narrative` text is exactly where
   a real secret would hide).
2. **No raw-blob echo** — only the scrubbed, distilled `content` is stored/surfaceable; the raw
   compacted JSON (`sourceTrajectories`, full blob) is **dropped wholesale** (same `raw`-drop
   principle as per-run trajectories). Pair snippets never expose the un-distilled blob.
3. **Tenancy server-derived** — `orgId`/`machineId`/`workspaceId` come from the auth context
   server-side; the mapper/client never asserts them from the file.
4. **Idempotent PK** — natural-order eventIds + the `compacted` tag ⇒ re-ingest is a no-op, never
   duplicate citations (the dup-citation usefulness issue, avoided by construction).

---

## Addendum (v1.2): the Learn lens — distill *ordinary session history* into Pair signal

**Why this exists (the adoption ceiling).** Pair surfaces `decision`/`finding`/`reflection`
events and **excludes `prompt`**. Those high-signal kinds come from *distilled* reasoning —
which today requires either trajectory capture (per-run) or the compaction roll-ups (v1.1).
**Most users have neither** — they have ordinary Claude Code / Codex **session/prompt history**.
So Pair returns empty `allow` for them (verified: on a 24.4k all-`prompt` prod corpus Pair was
silent until distilled events existed). The **Learn lens** closes this: distill a user's own
session history into the same convergence events, so Pair works **without** pre-existing
trajectories.

**Producer-pluggable architecture.** Pair stays source-agnostic: every producer (per-run
trajectories, compaction roll-ups, **Learn-distill**, future mining) emits the **same
convergence envelope** and flows through the **single `/v1/ingest` scrub chokepoint** → it
inherits scrub + tenancy + idempotency for free. Pair never knows the source.

**Pipeline (maximal reuse — most of this is already shipped):**
```
session history → [input adapter] → distiller (reuse compaction prompt+schema) →
  compacted-rollup schema → [reuse the merged v1.1 map_compacted] → decision/finding/reflection → ingest
```
- **Input adapter (new):** build distiller input from a **full session transcript** —
  prompt + response + **tool-call outputs** — not bare prompts (quality collapses on prompts
  alone). Window by session (or session-cluster).
- **Distiller (reuse):** `COMPACTION_SYSTEM_PROMPT` + `COMPACTED_OUTPUT_SCHEMA`
  (`src/compact/prompts.ts`) already turn "work sessions" into decisions/keyFindings/lessons.
  Output = the v1.1 compacted-rollup schema → **reuse `map_compacted`** unchanged.
- **eventId namespace (new):** namespace by a **stable distillation-unit id**,
  `learn_<stableHash(sessionWindow)>` — same kind/segment scheme as v1.1
  (`reflection:learn_<h>:lesson:<i>`, `decision:learn_<h>:<i>`, …) + `tag:["learn"]`.
  The hash must be **content-stable** so re-distilling the same window yields the **same
  eventIds** (idempotent PK → no duplicate citations across re-distill windows).

**🔒 LLM-locality / privacy model (the headline design decision — gates default-on):**
The distiller input is the **full transcript incl. tool-call outputs** — the *peak*
secret/file-content density in the corpus, and it is **pre-scrub** at distill time (our scrub
is at ingest, *after* distillation). Therefore:
- **Default-on ⇒ LOCAL distillation REQUIRED** — raw transcript must not leave the machine to a
  cloud LLM. The compaction provider already supports a `baseUrl` override
  (`OPENAI_BASE_URL`/`ANTHROPIC_BASE_URL`) → point at a local model (e.g. Ollama).
- **Cloud-LLM distillation ⇒ explicit opt-in + disclosure**, and only sound if the
  distill-provider == the agent-provider the user already trusts with these sessions.
- **Invariant either way:** raw history **never reaches Agent Relay / relayhistory servers** —
  only distilled + scrubbed events sync. Distillation is **client-orchestrated** (the user's own
  LLM key); the server only ever sees post-distill, post-scrub events.

**Ranking note (from prod real-data verification):** generic `reflection:summary`/`:approach`
events are abundant (on a real corpus: thousands of summaries vs. tens of decisions) and **flood
out** the high-value `:lesson`/`decision`/`:suggestion` signal. The Learn lens **must not** emit
a `:summary`/`:approach` per session (it would bury the actionable signal). Either (a) omit
generic summaries from the Learn output, or (b) the Pair ranker **down-weights**
`:summary`/`:approach` relative to `:lesson`/`decision`/`:suggestion`. Favor the *actionable*
kinds; summaries are context, not warnings.

**Acceptance fixture (`learn_fixture`) — pinned both ends, with bait:** a single session
transcript distills to a bounded event set (e.g. 1 decision + 2 lessons + 1 keyFinding); the
transcript contains a planted `ghp_FAKE…` in a tool-call output, and the resulting
`reflection:learn_<h>:lesson:<i>` `content` **must** be `[REDACTED]` (scrub on the Learn path).
Re-distilling the same transcript → identical eventIds (idempotent).

**Security acceptance (reviewed against):** (1) all Learn output through the ingest-scrub
chokepoint (bait → `[REDACTED]`); (2) distillation locality — default-on only if local;
cloud-LLM opt-in + disclosed; raw never to Agent Relay servers; (3) stable/idempotent eventIds.
