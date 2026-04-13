Added the new compaction modules under [src/compact/provider.ts](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/provider.ts), [src/compact/serializer.ts](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/serializer.ts), and [src/compact/index.ts](/Users/khaliqgant/Projects/Agent%20Workforce/trajectories/src/compact/index.ts).

`provider.ts` now defines `Message`, `CompletionOptions`, and `CompactionLLM`, plus raw-`fetch` `OpenAIProvider` and `AnthropicProvider` implementations with env-driven defaults and `resolveProvider()` auto-detection via `TRAJECTORIES_LLM_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `TRAJECTORIES_LLM_MODEL`. No SDK or new dependency was added.

`serializer.ts` now implements `serializeForLLM(trajectories, maxTokens?)` with the requested session header format, agent roles, filtered chapter events, structured decision/finding extraction, retrospective rendering, files/commits output, and proportional chapter truncation using the `~4 chars/token` budget rule while skipping low-significance events and raw tool call/result noise.

`index.ts` re-exports the new compact modules.

Validation completed successfully with:
- `pnpm exec tsc --noEmit`
- `pnpm exec biome check 'src/compact/provider.ts' 'src/compact/serializer.ts' 'src/compact/index.ts'`

Artifacts produced:
- `src/compact/provider.ts`
- `src/compact/serializer.ts`
- `src/compact/index.ts`

LLM_ENGINE_COMPLETE
