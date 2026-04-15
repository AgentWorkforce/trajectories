## [0.5.5](https://github.com/AgentWorkforce/trajectories/compare/v0.5.4...v0.5.5) (2026-04-15)


### Bug Fixes

* chat feature end-to-end — server routes, Swift models, relay SDK integration ([60b6beb](https://github.com/AgentWorkforce/trajectories/commit/60b6bebe834cb5ca40b0b501248a8a97a085837c))
* **pkg:** add default condition to exports for CJS resolvers ([2ad58bf](https://github.com/AgentWorkforce/trajectories/commit/2ad58bfeb888d098b7d948f65dd8af820d1c3e46))
* port chat from MSD — broker-managed fanout, BrokerRelayConnection via SDK ([214489d](https://github.com/AgentWorkforce/trajectories/commit/214489dadf6289fe8750266407acca9d4596b8c5))
* rewrite RelayConnection to plain WebSocket for local server chat ([fd84920](https://github.com/AgentWorkforce/trajectories/commit/fd849201a23b07c511c5014a2cde1ac7eb7cff14))


### Features

* add all 6 chat components (fan-out pattern) ([458ae4c](https://github.com/AgentWorkforce/trajectories/commit/458ae4c67e5f55bdf28f9fc5dbdcfbf77c2ae481))
* add all 6 chat components (fan-out) ([27af8b2](https://github.com/AgentWorkforce/trajectories/commit/27af8b2e8b9462e7798a378fc4af4ad2b186e982))
* add all 8 event type views (fan-out pattern) ([e25e011](https://github.com/AgentWorkforce/trajectories/commit/e25e01185ce3086f8168ffc9a2954265e812cf9b))
* add all 8 event type views (fan-out pattern) ([095f05c](https://github.com/AgentWorkforce/trajectories/commit/095f05cd7ddfb0b24e90bfcca4385200b6611fc8))
* add Animations.swift — shared animation constants and shimmer effect ([d8ea108](https://github.com/AgentWorkforce/trajectories/commit/d8ea108494fefebc8b12d80f865dd70a5cbf1646))
* add API client, relay, CLI detector, server manager ([4d96681](https://github.com/AgentWorkforce/trajectories/commit/4d966815b9ba481bfa41f52cee7dfa790e2a2949))
* add APIClient.swift — async HTTP client for all REST endpoints ([0b8671d](https://github.com/AgentWorkforce/trajectories/commit/0b8671da46775a937b4ddd86520650c687c79caf))
* add APIModels.swift — API response wrappers, error types, stats ([8cc25b4](https://github.com/AgentWorkforce/trajectories/commit/8cc25b4581ee34f357ee07994ea79698e6e138b5))
* add AppConfiguration — server URLs and default paths ([4e22178](https://github.com/AgentWorkforce/trajectories/commit/4e22178dae877a855a51a95886a4bb71f455900f))
* add AppStateStore.swift — window state, recent paths, UI preferences ([9443457](https://github.com/AgentWorkforce/trajectories/commit/9443457fd4d39fac0fc8f024f30d88292c4ee5ba))
* add Badges.swift — StatusBadge, TagPill, SignificanceDot, AgentAvatar ([bd4f614](https://github.com/AgentWorkforce/trajectories/commit/bd4f614c3d895361e517f019fdb3c8bc2ee23f23))
* add BookCard.swift — paper-like card with selection and hover states ([ceb2220](https://github.com/AgentWorkforce/trajectories/commit/ceb22209d9dcb29079ea015126af3dc3f3ba1e1d))
* add chapter view and detail container ([586ce07](https://github.com/AgentWorkforce/trajectories/commit/586ce07f660356009a11e60e2446a9202dbecbd4))
* add ChapterNavigation — horizontal chapter pill navigation ([087fb94](https://github.com/AgentWorkforce/trajectories/commit/087fb9481cc9e790f77a4284d8c84cd78c974ff4))
* add ChapterView — collapsible chapter with timeline and event type routing ([bc1ae68](https://github.com/AgentWorkforce/trajectories/commit/bc1ae685c52a64502191e93272f31289369df267))
* add ChatEmptyStates — three empty state views for chat panel ([80bde6d](https://github.com/AgentWorkforce/trajectories/commit/80bde6d9c71dee953b3bb7443ce8c721698562b4))
* add ChatModels.swift — chat message, persona, and session types ([f9f1235](https://github.com/AgentWorkforce/trajectories/commit/f9f12356f439425b37c817d915269724a2bd2167))
* add ChatPanelView — full chat panel with messages, personas, and input ([292a0eb](https://github.com/AgentWorkforce/trajectories/commit/292a0eb204a7245f4b8553156b6f9bf8c85c10c6))
* add ChatStore.swift — @Observable store for chat sessions and messages ([9bb5c0a](https://github.com/AgentWorkforce/trajectories/commit/9bb5c0a0ddb6bfadcf7a881fd5fe0743a72003da))
* add CLI resolver — spawn config resolution for multiple CLI tools ([68b988d](https://github.com/AgentWorkforce/trajectories/commit/68b988df04cb43ee4fa6c63ad7a417a69200e3d4))
* add CLIDetector.swift — PATH scanning and version detection for AI CLIs ([af60a68](https://github.com/AgentWorkforce/trajectories/commit/af60a68255f960f236c0bb83f78effbc17dff3f9))
* add CLISettingsStore.swift — CLI preferences with UserDefaults persistence ([b42afb5](https://github.com/AgentWorkforce/trajectories/commit/b42afb5964e6b77a2cd26a7321a9d0f9d81cf5c1))
* add CLISettingsView — AI assistant CLI picker with detection status ([dfc828c](https://github.com/AgentWorkforce/trajectories/commit/dfc828c5d2fe42060f4659ae987e12d0695f4bb2))
* add Codable data models ([802a8e2](https://github.com/AgentWorkforce/trajectories/commit/802a8e2df9c21b992bd6c5a2afff9b47fa297ba2))
* add command palette, welcome, settings views ([ffb5c63](https://github.com/AgentWorkforce/trajectories/commit/ffb5c63139577a64e88f429f149374ce8965fc15))
* add CommandPalette — Cmd+K overlay with grouped search results and keyboard nav ([ea5397b](https://github.com/AgentWorkforce/trajectories/commit/ea5397b0e5f5c782f12f6cc397514231520629ea))
* add ConfidenceMeter — reusable gradient confidence bar component ([0ad4f6e](https://github.com/AgentWorkforce/trajectories/commit/0ad4f6eea78a95a467940df1c65aec8fd346d681))
* add decision card, retrospective view, confidence meter ([2922a72](https://github.com/AgentWorkforce/trajectories/commit/2922a72981c15c54659c8ffc13353201e1ac599f))
* add DecisionCard — striking decision display with confidence and alternatives ([0398831](https://github.com/AgentWorkforce/trajectories/commit/0398831598cb8c57b33a1bd785e3bb812fcf04be))
* add design components — cards, badges, skeleton, toast ([7bfc7dd](https://github.com/AgentWorkforce/trajectories/commit/7bfc7dd136c5c419a0bd5485d4d3fa8c1a37b339))
* add design tokens — colors, typography, animations ([a83f209](https://github.com/AgentWorkforce/trajectories/commit/a83f20944d88cf3f182cdbf4dd08d5c6e13b0bb4))
* add detail header, chapter nav, timeline rail ([841b738](https://github.com/AgentWorkforce/trajectories/commit/841b7383fff4937a3fc3845fd5b2daf14942e5d9))
* add DetailSkeleton — shimmer loading placeholder for detail view ([b3aa84f](https://github.com/AgentWorkforce/trajectories/commit/b3aa84f13c87378070d3c54ecc46f2c95e6a6500))
* add EmptyState.swift — centered empty state component ([03dfcfa](https://github.com/AgentWorkforce/trajectories/commit/03dfcfa538eee2265f5d1b18187bbc717da0906b))
* add export routes — markdown, timeline, and JSON trajectory exports ([1aad0c6](https://github.com/AgentWorkforce/trajectories/commit/1aad0c630120a20375664e111e63e6052b007fb9))
* add export sheet, file detail modal, search highlighting ([321dfa8](https://github.com/AgentWorkforce/trajectories/commit/321dfa8a7d123324353d46ead845fc0d9187d2db))
* add ExportSheet — export trajectory as Markdown, JSON, or Timeline with copy and save ([b353e58](https://github.com/AgentWorkforce/trajectories/commit/b353e58c325bb2d0b19a5b1cf1414dc24156c285))
* add FileChangesView — collapsible file paths and commit list ([1b5a9af](https://github.com/AgentWorkforce/trajectories/commit/1b5a9af281185ef429987fb2819d2ab8d08be5b9))
* add FileDetailModal — fullscreen file viewer with list pane and line-numbered content ([81fdac6](https://github.com/AgentWorkforce/trajectories/commit/81fdac6d57c52069076ea79edc2cbeb17a9a82b7))
* add FilterBar — search field and status filter pills ([0b522a0](https://github.com/AgentWorkforce/trajectories/commit/0b522a0b75fd2144c151acd82f7bf6a2fb94209b))
* add health endpoint handler with env config for trail-viewer-server ([2f00471](https://github.com/AgentWorkforce/trajectories/commit/2f00471a7fd3cb49a5f314fa51c30996758cbb3a))
* add Hono server entry — CORS, health, placeholder routes ([8de11be](https://github.com/AgentWorkforce/trajectories/commit/8de11bee514178a25d685ec9cc0969095d56a8a2))
* add LayoutConstants.swift — sidebar, panel, and content dimensions ([b71828c](https://github.com/AgentWorkforce/trajectories/commit/b71828c5bed774fcf9aa91c019f2d97aa9a61ecf))
* add LocalServerManager.swift — spawn and manage TypeScript server subprocess ([77f5a50](https://github.com/AgentWorkforce/trajectories/commit/77f5a506276ee6753eb6a2e3d3839fdbca942f0e))
* add observable stores ([4062770](https://github.com/AgentWorkforce/trajectories/commit/4062770923db1ad62b34f6bf09b91e5d3b19d661))
* add PathSettingsView — trajectory path picker with recent paths list ([683b22b](https://github.com/AgentWorkforce/trajectories/commit/683b22b7fcae3ae1626eca5450970f47a5c01473))
* add persona selector, empty states, chat panel ([388f2bc](https://github.com/AgentWorkforce/trajectories/commit/388f2bc03ce5efe085cd9d1c5d05a1b40485045b))
* add PersonaSelector — horizontal persona picker with Ask All button ([8bc7948](https://github.com/AgentWorkforce/trajectories/commit/8bc79485a4ae8c97d4153eed46fc6420b4665c71))
* add RelayConnection.swift — WebSocket client with auto-reconnect ([e2136fe](https://github.com/AgentWorkforce/trajectories/commit/e2136fe914dd189fe57fcf12a922d569ca28f428))
* add RetrospectiveView — epilogue with challenges, learnings, and suggestions ([0b5a1aa](https://github.com/AgentWorkforce/trajectories/commit/0b5a1aa2381f8d9b2527e271f29177bf8165d32b))
* add SearchHighlight — ViewModifier and HighlightedText for yellow search match highlighting ([92d5bda](https://github.com/AgentWorkforce/trajectories/commit/92d5bda7a3b2756a7b87dea03bd4a6310c7f4306))
* add SectionElements.swift — SectionHeader, RuleLine, OrnamentDivider ([3b18442](https://github.com/AgentWorkforce/trajectories/commit/3b18442c112161774853d7f7a778e67f44aa2307))
* add SettingsModels.swift — CLI info, availability, and app preferences ([eb40400](https://github.com/AgentWorkforce/trajectories/commit/eb404005b8618dc5992ed9de5023a807ccb9c9db))
* add SettingsView — settings sheet with AI Assistant, Path, and About tabs ([2bbba2e](https://github.com/AgentWorkforce/trajectories/commit/2bbba2e1b507e8dec8d617c1ed7cc51694e764b7))
* add SidebarHeader — serif title, rule line, and stats summary ([3767037](https://github.com/AgentWorkforce/trajectories/commit/3767037ea7a66fedd82767033c606a42332d0ede))
* add SidebarSkeleton — shimmer loading placeholder for sidebar ([9b6aa02](https://github.com/AgentWorkforce/trajectories/commit/9b6aa0209070de2f2c6848906e04684df015599c))
* add SkeletonView.swift — skeleton loading placeholders with shimmer ([a5a4282](https://github.com/AgentWorkforce/trajectories/commit/a5a4282ae351d0b3f8d004345912d2d4a12daa5c))
* add Theme.swift — full color palette, spacing, and radii tokens ([4bde78f](https://github.com/AgentWorkforce/trajectories/commit/4bde78f0b7e316f368a0c4b9bca3856051206ff5))
* add TimelineRail — vertical timeline with dots and connecting lines ([35e5815](https://github.com/AgentWorkforce/trajectories/commit/35e5815553b1d749c7023da6e1eff2a73bd51be0))
* add ToastView.swift — toast notifications with auto-dismiss ([82c9524](https://github.com/AgentWorkforce/trajectories/commit/82c95244bb4b332001a87fd118fb5cd6bb1f82ab))
* add TrailViewerApp.swift — [@main](https://github.com/main) entry with WindowGroup ([f509a15](https://github.com/AgentWorkforce/trajectories/commit/f509a15dff3d993e349f1ccc6d6a08d8d90f2977))
* add trajectory API routes — list, get, stats endpoints ([10c0304](https://github.com/AgentWorkforce/trajectories/commit/10c0304f9dfe18d1f716e372448b534d933a1cb1))
* add trajectory formatter — rich markdown and brief formats for agent context ([0e5e0fe](https://github.com/AgentWorkforce/trajectories/commit/0e5e0fe2c75bee72aa27afadd49836875c337e43))
* add trajectory list sidebar ([b2e0922](https://github.com/AgentWorkforce/trajectories/commit/b2e0922fe167585f55c4dfb61877ac59331de3bd))
* add trajectory service, formatter, REST routes ([afaaa70](https://github.com/AgentWorkforce/trajectories/commit/afaaa70ccf8490e21e7bf339c95e73852a5dbc1a))
* add TrajectoryDetailView — main detail container with all sections ([38477cd](https://github.com/AgentWorkforce/trajectories/commit/38477cdb3daee05fdf0db61a8935974066e82853))
* add TrajectoryHeaderView — detail header with title, metadata, and tags ([d3a218a](https://github.com/AgentWorkforce/trajectories/commit/d3a218a71585713d10fd299e3dd0c7169dafa959))
* add TrajectoryListView — main sidebar with header, filter, and trajectory list ([5e7f1e2](https://github.com/AgentWorkforce/trajectories/commit/5e7f1e210ee1bc3781207685be19e1bb3954116b))
* add TrajectoryModels.swift — Codable models for trajectories, chapters, events ([7d1ec96](https://github.com/AgentWorkforce/trajectories/commit/7d1ec96fd4936b369023c49472849c63cf2aedde))
* add TrajectoryRow — rich sidebar row with status, tags, and relative time ([19e23cf](https://github.com/AgentWorkforce/trajectories/commit/19e23cf47e246d107e98ad5bd582c4955d1f0ca6))
* add TrajectoryService — server-side read-only trajectory data access ([041dda5](https://github.com/AgentWorkforce/trajectories/commit/041dda5e257e3160cf92f716bbfde2a27b378e96))
* add TrajectoryStore.swift — @Observable store with filtering and selection ([f2aabbb](https://github.com/AgentWorkforce/trajectories/commit/f2aabbb6e23ee1c3850a9bdb98d4a4fc9e6d38ca))
* add Typography.swift — serif headings and body font ViewModifiers ([f208595](https://github.com/AgentWorkforce/trajectories/commit/f20859557a08af21f3b28ce53c75b806308a9f5f))
* add WelcomeView — first-launch screen with book icon and open repository ([ece2785](https://github.com/AgentWorkforce/trajectories/commit/ece2785e1d92ac046b47387b1e819955f3d305ba))
* app bundle launch, AgentRelaySDK chat, remove 50 limit, CLI compaction ([77877ce](https://github.com/AgentWorkforce/trajectories/commit/77877ce5f76ba4cedb9d86a84ab2d1cce2cb98a2))
* wire all views — hub-spoke integration with lead review ([45808ef](https://github.com/AgentWorkforce/trajectories/commit/45808ef578b8dbdd2dcb08c55393c4ea341bb3b1))
* wire all views — hub-spoke integration with lead review ([08fbfba](https://github.com/AgentWorkforce/trajectories/commit/08fbfba1bb611b74535de5aa7ed34c1e3ab397cc))
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
