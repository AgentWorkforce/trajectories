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
