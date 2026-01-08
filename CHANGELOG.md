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
