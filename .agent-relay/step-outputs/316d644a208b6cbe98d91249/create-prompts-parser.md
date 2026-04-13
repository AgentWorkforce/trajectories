Created [prompts.ts](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/prompts.ts), [parser.ts](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/parser.ts), and [markdown.ts](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/markdown.ts).

`prompts.ts` exports `COMPACTION_SYSTEM_PROMPT`, `COMPACTED_OUTPUT_SCHEMA`, `PromptOptions`, a simple chat `Message` type, and `buildCompactionPrompt(...)` that emits system/user messages with schema guidance, focus areas, and raw serialized trajectory input.

`parser.ts` exports the shared compaction types plus `parseCompactionResponse(...)` and `mergeCompactionWithMetadata(...)`. The parser tries direct JSON, fenced JSON, balanced-object extraction, then prose-section recovery from `##` headings. It normalizes/validates `narrative`, `decisions`, `conventions`, `lessons`, and `openQuestions`, always returning a usable `LLMCompactedOutput`.

`markdown.ts` exports `generateCompactionMarkdown(...)`, producing the requested human-readable report with Summary, Key Decisions table, Conventions, Lessons, Open Questions, and Stats.

Verification:
- `npx tsc --noEmit`
- `npx biome check src/compact/prompts.ts src/compact/parser.ts src/compact/markdown.ts`

Artifacts produced:
- `src/compact/prompts.ts`
- `src/compact/parser.ts`
- `src/compact/markdown.ts`

PROMPTS_PARSER_COMPLETE
