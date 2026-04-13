Updated [`src/cli/commands/compact.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/cli/commands/compact.ts) to support LLM compaction with mechanical fallback. The command now:
- adds `--llm`, `--mechanical`, `--focus <areas>`, and default-on markdown output (`--markdown` / `--no-markdown`)
- auto-selects LLM compaction when a provider is available unless `--mechanical` is set
- keeps `loadTrajectories()` intact
- uses the LLM flow you specified: serialize, build prompt, estimate tokens, call provider, parse response, merge deterministic mechanical metadata, save JSON, save `.md`, print summary
- keeps dry-run working for LLM by printing the constructed prompt and `Estimated: ~{input} input tokens, ~{output} output tokens`

Added [`src/compact/config.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/config.ts) for env / `.trajectories/config.json` loading with defaults:
- `provider=auto`
- `maxInputTokens=30000`
- `maxOutputTokens=4000`
- `temperature=0.3`

Updated compact exports and provider resolution in:
- [`src/compact/index.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/index.ts)
- [`src/compact/provider.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/provider.ts)

Added tests in [`tests/compact/llm-compact.test.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/tests/compact/llm-compact.test.ts) covering:
- serializer output
- parser behavior
- markdown generation
- fallback to mechanical compaction when no LLM provider exists

Verified:
- `npm run typecheck`
- `npm run test:run -- tests/compact/llm-compact.test.ts`

Artifacts produced:
- modified [`src/cli/commands/compact.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/cli/commands/compact.ts)
- added [`src/compact/config.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/config.ts)
- modified [`src/compact/index.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/index.ts)
- modified [`src/compact/provider.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/provider.ts)
- added [`tests/compact/llm-compact.test.ts`](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/tests/compact/llm-compact.test.ts)

CLI_UPDATE_COMPLETE
