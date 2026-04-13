## [0.5.4](https://github.com/AgentWorkforce/trajectories/compare/v0.5.3...v0.5.4) (2026-04-13)


### Bug Fixes

* **cli:** resolve version from package.json instead of hardcoding ([87aee2b](https://github.com/AgentWorkforce/trajectories/commit/87aee2ba417ac8898bf4883e8448aa3c7533abf7))
* **trailers:** propagate legacy id regex to parser + git hook (devin) ([0afcd74](https://github.com/AgentWorkforce/trajectories/commit/0afcd7417d14407b08742732bed9848f2256dc99)), closes [#22](https://github.com/AgentWorkforce/trajectories/issues/22)
* **workflows:** use file_exists verification for lead PR step ([7c892a1](https://github.com/AgentWorkforce/trajectories/commit/7c892a121c93946fa3dda2da3de738e41113cf31))


### Features

* **storage:** reconcile index from disk on FileStorage.initialize ([a387b5c](https://github.com/AgentWorkforce/trajectories/commit/a387b5ccfab942c4f82eb58cd35b610f8c417b65))
* **storage:** tolerate legacy trajectory shapes + harden reconcile ([eee1a44](https://github.com/AgentWorkforce/trajectories/commit/eee1a4494b251b41adbfb10e47e59e5cfdbb877c))
## [0.5.3](https://github.com/AgentWorkforce/trajectories/compare/v0.5.2...v0.5.3) (2026-04-13)


### Bug Fixes

* address 18 review findings across compact, provider, config, and workflow ([9e8e0c5](https://github.com/AgentWorkforce/trajectories/commit/9e8e0c5ab819469e44b2049821ae651c03848864))
* CI failures + devin review (readNumber empty-string + lint + build) ([66cc7a1](https://github.com/AgentWorkforce/trajectories/commit/66cc7a1b43bf6ab6d73e96134716ac9ce8d08d1b)), closes [#17](https://github.com/AgentWorkforce/trajectories/issues/17)


### Features

* add LLM compaction workflow + agent-relay SDK ([10fd4da](https://github.com/AgentWorkforce/trajectories/commit/10fd4da7414e7baf74b938546b45f67c438a8a11))
* LLM-powered trajectory compaction ([fd7612a](https://github.com/AgentWorkforce/trajectories/commit/fd7612aa18d840e7a0440c379423d7dbf5561363))
* **sdk:** autoCompact option on TrajectoryClient auto-runs compactWorkflow on complete ([6298078](https://github.com/AgentWorkforce/trajectories/commit/62980788ce90e1b46b553b098703427c1a74fb40))
* trail start honors TRAJECTORIES_WORKFLOW_ID + auto-compact template ([92b6f98](https://github.com/AgentWorkforce/trajectories/commit/92b6f98e4cc398b75e1dd06a4ca1df5b7b68fcf2))
* workflow-aware auto-compaction (SDK tag + trail compact --workflow) ([21de705](https://github.com/AgentWorkforce/trajectories/commit/21de7051d42b008d4ef0b0e1f9f91d5fa873825a))
## [0.5.2](https://github.com/AgentWorkforce/trajectories/compare/v0.5.1...v0.5.2) (2026-02-20)



## [0.5.1](https://github.com/AgentWorkforce/trajectories/compare/v0.5.0...v0.5.1) (2026-02-20)


### Features

* add --branch flag and uncompacted-default behavior ([eba1a58](https://github.com/AgentWorkforce/trajectories/commit/eba1a58f760e5a009cf9814bf59da2cd31873921))
* add trajectory compaction for PR merges ([00132e4](https://github.com/AgentWorkforce/trajectories/commit/00132e4a40ef1698da994b188f6832a52a852dac))



# [0.5.0](https://github.com/AgentWorkforce/trajectories/compare/v0.4.1...v0.5.0) (2026-02-19)


### Bug Fixes

* biome format issues in package.json and schema.ts ([e7efc7b](https://github.com/AgentWorkforce/trajectories/commit/e7efc7b5bc91643e2c53f1eb6db42ff9f635de42))
* resolve lint errors and write-back bug in trace migration ([fc75d34](https://github.com/AgentWorkforce/trajectories/commit/fc75d34f81370a6d9dccd48ba34e78c416e1521b))
* update show.ts to use model_id instead of model on TraceContributor ([fad5fd2](https://github.com/AgentWorkforce/trajectories/commit/fad5fd2f4db92863d1f0467190a7e18e54d7d96e))
* update stale TraceRecord.id comment to reflect UUID format ([b6521b7](https://github.com/AgentWorkforce/trajectories/commit/b6521b7ef0e1f6254dd8a02a119e1c0b6f518847))
* update trace tests to match spec-compliant output ([b3af621](https://github.com/AgentWorkforce/trajectories/commit/b3af621a84d2523520d3c0f70b9e51bebb478ca6))
* use crypto.randomUUID() for trace IDs per agent-trace spec ([0203a6c](https://github.com/AgentWorkforce/trajectories/commit/0203a6c52d02f31c00813515b529a7283a7ef8ca))


### Features

* agent-trace spec compliance and ecosystem positioning ([bac2f2f](https://github.com/AgentWorkforce/trajectories/commit/bac2f2f1d92321901a72d2ae4620e6732bf9d802))
* auto-generate CHANGELOG.md on release ([a048a6a](https://github.com/AgentWorkforce/trajectories/commit/a048a6a9716381be4a27d8474c886e96e2f4b3eb))
* transparent migrate-on-read for legacy trace files ([87eaa3a](https://github.com/AgentWorkforce/trajectories/commit/87eaa3a5c64d7541bc1e3f895f75a401e89f1d10))



# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Actions workflow for automatic npm publishing with OIDC trusted publishers

## [0.1.1] - 2025-01-01

### Fixed

- CLI export paths for proper npm package distribution

## [0.1.0] - 2025-01-01

### Added

- Initial release
- `trail` CLI for capturing agent work trajectories
- Core commands: `start`, `status`, `decision`, `complete`, `list`, `show`, `export`
- File system storage backend (`.trajectories/` directory)
- Export formats: markdown, json, timeline, html
- Web viewer with `--open` flag for browser-based viewing
- Trajectory format with chapters, events, decisions, and retrospectives
- Confidence scores for agent self-assessment
- Task source linking (Linear, GitHub Issues, etc.)

[Unreleased]: https://github.com/AgentWorkforce/trajectories/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/AgentWorkforce/trajectories/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AgentWorkforce/trajectories/releases/tag/v0.1.0
