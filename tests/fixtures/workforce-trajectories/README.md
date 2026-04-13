# Workforce trajectory fixtures

Hand-crafted fixtures modeled after real-world trajectory JSON files
produced by the workforce workflow runner. Each fixture intentionally
exercises at least one constraint that the original trajectory schema
rejected, so that relaxing the schema without breaking legacy-read
support is detectable via test.

## Layout constraints being tested

| Fixture | Layout | What makes it "legacy" |
|---|---|---|
| `completed/traj_1775734701264_ba65c69b.json` | Flat root | Flat `completed/` root (no `YYYY-MM/` subdir); timestamp-hex id with underscore; `role: "workflow-runner"`/`"specialist"`; `source.system: "workflow-runner"`; omitted `commits`/`filesChanged`/`projectId`/`tags` |
| `completed/2026-04/traj_1775832005024_c2cf5052.json` | `YYYY-MM` subdir | Same legacy shape but in a month subdirectory — verifies both layouts reconcile |

If you add new fixtures, keep them ~2 KB or less. The point is to lock
down real-world schema violations as a contract, not to mirror the full
workforce corpus.
