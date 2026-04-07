# Trail Viewer — Complete Workflow Plan

**Total: 67 workflows across 16 waves**
**Agent pattern: Claude leads plan → Codex workers implement (1-2 files each)**

---

## Wave 1 — Project Scaffold (3 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 01 | package-swift | SPM project config | `Package.swift` | 1 |
| 02 | app-entry | @main entry point, window chrome | `TrailViewerApp.swift` | 1 |
| 03 | app-config | Server URLs, defaults, constants | `AppConfiguration.swift` | 1 |

## Wave 2 — Design Tokens (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 04 | theme-colors | Full color palette (paper, blue, yellow, status, agents) | `Design/Theme.swift` | 1 |
| 05 | typography | Serif headings, body fonts, ViewModifiers | `Design/Typography.swift` | 1 |
| 06 | animations | Shared animation constants, easing curves, durations | `Design/Animations.swift` | 1 |
| 07 | spacing-layout | Spacing scale, corner radii, layout constants | (merged into Theme.swift — extend) | 1 |

## Wave 3 — Design Components (6 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 08 | book-card | Paper-like card with selected/highlighted states | `Design/BookCard.swift` | 1 |
| 09 | badges-pills | StatusBadge, TagPill, SignificanceDot, AgentAvatar | `Design/Badges.swift` | 1 |
| 10 | section-headers | SectionHeader, RuleLine, OrnamentDivider | `Design/SectionElements.swift` | 1 |
| 11 | empty-states | EmptyState component with icon, title, subtitle | `Design/EmptyState.swift` | 1 |
| 12 | skeleton-loader | SkeletonLine, SkeletonCard with shimmer animation | `Design/SkeletonView.swift` | 1 |
| 13 | toast-system | ToastView, ToastContainer, toast styles (info/success/error) | `Design/ToastView.swift` | 1 |

## Wave 4 — Data Models (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 14 | trajectory-models | Trajectory, Chapter, Event, Decision, Retrospective | `Data/TrajectoryModels.swift` | 1 |
| 15 | chat-models | ChatMessage, ChatPersona, ChatSession types | `Data/ChatModels.swift` | 1 |
| 16 | settings-models | CLIInfo, CLIAvailability, AppPreferences | `Data/SettingsModels.swift` | 1 |
| 17 | api-response-models | API response wrappers, error types, stats | `Data/APIModels.swift` | 1 |

## Wave 5 — Services (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 18 | api-client | Async HTTP client with all endpoints | `Data/APIClient.swift` | 1 |
| 19 | relay-connection | WebSocket client for agent chat events | `Data/RelayConnection.swift` | 1 |
| 20 | cli-detector | PATH scanning, version detection for AI CLIs | `Services/CLIDetector.swift` | 1 |
| 21 | local-server-manager | Spawn/manage TypeScript server subprocess | `Services/LocalServerManager.swift` | 1 |

## Wave 6 — State Stores (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 22 | trajectory-store | @Observable store for trajectories, filtering, selection | `Data/TrajectoryStore.swift` | 1 |
| 23 | chat-store | @Observable store for chat sessions, messages, personas | `Data/ChatStore.swift` | 1 |
| 24 | cli-settings-store | CLI preferences, UserDefaults persistence | `Data/CLISettingsStore.swift` | 1 |
| 25 | app-state-store | Window state, recent paths, UI preferences | `Data/AppStateStore.swift` | 1 |

## Wave 7 — Sidebar Views (5 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 26 | sidebar-header | "Trail Viewer" title + rule line + stats | `Views/Sidebar/SidebarHeader.swift` | 1 |
| 27 | filter-bar | Search field + status pills + tag filter | `Views/Sidebar/FilterBar.swift` | 1 |
| 28 | trajectory-row | Single row with title, status, agents, tags, time | `Views/Sidebar/TrajectoryRow.swift` | 1 |
| 29 | trajectory-list | Scrollable list container, selection, loading/empty states | `Views/Sidebar/TrajectoryListView.swift` | 1 |
| 30 | sidebar-skeleton | Skeleton loading state for sidebar (shimmer rows) | `Views/Sidebar/SidebarSkeleton.swift` | 1 |

## Wave 8 — Detail Header & Navigation (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 31 | trajectory-header | Title page: task title, description, metadata, tags, source | `Views/Detail/TrajectoryHeaderView.swift` | 1 |
| 32 | chapter-navigation | Jump-to-chapter sidebar/dropdown + chapter count | `Views/Detail/ChapterNavigation.swift` | 1 |
| 33 | timeline-rail | Vertical timeline line + significance dots + timestamps | `Views/Detail/TimelineRail.swift` | 1 |
| 34 | detail-skeleton | Skeleton loading state for detail view | `Views/Detail/DetailSkeleton.swift` | 1 |

## Wave 9 — Event Type Views (8 workflows, parallel)

Each event type gets its own visual treatment.

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 35 | event-card-base | Base EventCard wrapper with significance dot, timestamp, agent | `Views/Detail/Events/EventCardBase.swift` | 1 |
| 36 | note-event | Note event: book icon + body text | `Views/Detail/Events/NoteEventView.swift` | 1 |
| 37 | finding-event | Finding: left blue border, indented block | `Views/Detail/Events/FindingEventView.swift` | 1 |
| 38 | thinking-event | Thinking: collapsed/expandable, italic, tertiary | `Views/Detail/Events/ThinkingEventView.swift` | 1 |
| 39 | tool-call-event | Tool call/result: monospace gray box, collapsible | `Views/Detail/Events/ToolCallEventView.swift` | 1 |
| 40 | reflection-event | Reflection: yellowMuted background, annotation style | `Views/Detail/Events/ReflectionEventView.swift` | 1 |
| 41 | error-event | Error: red-tinted box with error icon | `Views/Detail/Events/ErrorEventView.swift` | 1 |
| 42 | message-event | Message sent/received: chat bubble with AgentAvatar | `Views/Detail/Events/MessageEventView.swift` | 1 |

## Wave 10 — Decision & Retrospective (3 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 43 | decision-card | Pull-quote style: question, chosen, alternatives, confidence bar | `Views/Detail/DecisionCard.swift` | 1 |
| 44 | retrospective-view | Epilogue: ornament divider, summary, approach, learnings | `Views/Detail/RetrospectiveView.swift` | 1 |
| 45 | confidence-meter | Reusable confidence bar (gradient, percentage label) | `Views/Detail/ConfidenceMeter.swift` | 1 |

## Wave 11 — Chapter & Detail Container (3 workflows, sequential)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 46 | chapter-view | Chapter: number, title, agent, events timeline, collapse | `Views/Detail/ChapterView.swift` | 1 |
| 47 | file-changes-view | Footer: files changed + commits lists, collapsible | `Views/Detail/FileChangesView.swift` | 1 |
| 48 | trajectory-detail | Main ScrollView container wiring all detail subviews | `Views/Detail/TrajectoryDetailView.swift` | 1 |

## Wave 12 — Chat Components (6 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 49 | markdown-renderer | Basic markdown: bold, italic, code, code blocks, links | `Views/Chat/MarkdownRenderer.swift` | 1 |
| 50 | code-block-view | Syntax-highlighted code block with copy button | `Views/Chat/CodeBlockView.swift` | 1 |
| 51 | typing-indicator | Animated dots (●●●) with persona color pulse | `Views/Chat/TypingIndicator.swift` | 1 |
| 52 | persona-card | Single persona pill: emoji, name, active/inactive state | `Views/Chat/PersonaCard.swift` | 1 |
| 53 | chat-bubble | Message bubble: user (right) vs agent (left) + markdown | `Views/Chat/ChatBubble.swift` | 1 |
| 54 | chat-input-bar | Multi-line TextEditor + send button + Cmd+Enter | `Views/Chat/ChatInputBar.swift` | 1 |

## Wave 13 — Chat Container (3 workflows, sequential)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 55 | persona-selector | Horizontal scroll of PersonaCards + "Ask all" + description | `Views/Chat/PersonaSelector.swift` | 1 |
| 56 | chat-empty-states | No trajectory, no session, session CTA card | `Views/Chat/ChatEmptyStates.swift` | 1 |
| 57 | chat-panel | Full panel: header, personas, messages, input, lifecycle | `Views/Chat/ChatPanelView.swift` | 1 |

## Wave 14 — Overlays & Settings (5 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 58 | command-palette | Cmd+K overlay: search, results, keyboard nav | `Views/CommandPalette.swift` | 1 |
| 59 | welcome-view | First-launch: open folder, recent paths, getting started | `Views/WelcomeView.swift` | 1 |
| 60 | cli-settings-view | CLI picker, detection status grid, refresh button | `Views/Settings/CLISettingsView.swift` | 1 |
| 61 | path-settings-view | Trajectory path picker, recent paths, change button | `Views/Settings/PathSettingsView.swift` | 1 |
| 62 | settings-container | Settings sheet container with sections | `Views/Settings/SettingsView.swift` | 1 |

## Wave 15 — App Integration (4 workflows, sequential)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 63 | status-bar | Bottom bar: connection status, trajectory count, shortcuts hint | `Views/StatusBar.swift` | 1 |
| 64 | content-view | Three-column layout wiring all views, toolbar, keyboard shortcuts | `ContentView.swift` | 1 |
| 65 | app-entry-final | Final TrailViewerApp with all environment injection + menus | `TrailViewerApp.swift` (rewrite) | 1 |
| 66 | keyboard-shortcuts | Keyboard shortcut system: Cmd+K, Cmd+0, Cmd+Shift+C, etc. | `Services/KeyboardShortcuts.swift` | 1 |

## Wave 16 — Export & File Detail (3 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 67 | export-sheet | Export trajectory as markdown/JSON/timeline | `Views/ExportSheet.swift` | 1 |
| 68 | file-detail-modal | Fullscreen file viewer for trajectory file changes | `Views/FileDetailModal.swift` | 1 |
| 69 | search-highlight | Text highlighting for search matches in command palette | `Design/SearchHighlight.swift` | 1 |

---

## Server Workflows

## Wave 17 — Server Scaffold (3 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 70 | server-package | package.json + tsconfig.json | `server/package.json`, `server/tsconfig.json` | 2 |
| 71 | server-health | Health endpoint + env var handling + startup | `server/src/health.ts` | 1 |
| 72 | server-main | Hono HTTP server skeleton with CORS + error handling | `server/src/server.ts` | 1 |

## Wave 18 — Trajectory API (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 73 | trajectory-service | TrajectoryClient wrapper: list, get, search, stats | `server/src/trajectory-service.ts` | 1 |
| 74 | trajectory-formatter | Format trajectory → rich markdown for agent context | `server/src/trajectory-formatter.ts` | 1 |
| 75 | trajectory-routes | REST endpoints: /api/trajectories, /api/stats | `server/src/routes/trajectories.ts` | 1 |
| 76 | export-routes | REST endpoints: /api/trajectories/:id/markdown, /timeline | `server/src/routes/exports.ts` | 1 |

## Wave 19 — Chat Infrastructure (5 workflows, sequential)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 77 | cli-resolver-server | CLI preference handling + spawn configs | `server/src/cli-resolver.ts` | 1 |
| 78 | persona-config | 6 persona definitions + prompt templates | `server/src/personas.ts` | 1 |
| 79 | chat-session | ChatSession class: spawn, message, fanout, cleanup | `server/src/chat-session.ts` | 1 |
| 80 | chat-service | ChatService facade: session lifecycle, callbacks | `server/src/chat-service.ts` | 1 |
| 81 | chat-routes | REST endpoints: /api/chat/start, message, stop, persona | `server/src/routes/chat.ts` | 1 |

## Wave 20 — WebSocket Bridge (3 workflows, sequential)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 82 | ws-types | WebSocket message type definitions (agent_message, typing, etc.) | `server/src/ws-types.ts` | 1 |
| 83 | relay-bridge | RelayBridge: WebSocket proxy for relay events → Mac app | `server/src/relay-bridge.ts` | 1 |
| 84 | server-wiring | Final server.ts rewrite using all modules + relay bridge | `server/src/server.ts` (rewrite) | 1 |

## Wave 21 — Testing & Launch (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 85 | mock-trajectories | 3 realistic sample trajectories + MockTrajectoryService | `server/src/mock-trajectories.ts` | 1 |
| 86 | test-chat-e2e | Integration test: WebSocket connect, start session, message flow | `server/src/test-chat.ts` | 1 |
| 87 | launch-script | One-command launcher with --mock, --path flags | `launch.sh` | 1 |
| 88 | test-server-e2e | REST API integration test: list, get, search, export | `server/src/test-api.ts` | 1 |

---

## Polish Workflows

## Wave 22 — Accessibility & Polish (4 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 89 | help-tooltips | Accessibility labels + help tooltips for all interactive elements | `Design/HelpTooltips.swift` | 1 |
| 90 | focus-management | Tab navigation, focus rings, keyboard accessibility | `Services/FocusManagement.swift` | 1 |
| 91 | relative-time | RelativeTimeFormatter: "2 days ago", "just now", etc. | `Services/RelativeTimeFormatter.swift` | 1 |
| 92 | clipboard-service | Copy to clipboard: trajectory, decision, code block, finding | `Services/ClipboardService.swift` | 1 |

## Wave 23 — Final Integration Tests (3 workflows, parallel)

| # | Name | Claude plans | Codex builds | Files |
|---|------|-------------|-------------|-------|
| 93 | build-verify-swift | Verify Swift project compiles with all files | (deterministic only) | 0 |
| 94 | build-verify-server | Verify TypeScript server compiles | (deterministic only) | 0 |
| 95 | full-smoke-test | Launch server + verify all endpoints + WebSocket flow | (deterministic only) | 0 |

---

## Summary

| Wave | Name | Workflows | Parallel? |
|------|------|-----------|-----------|
| 1 | Project Scaffold | 01-03 | yes |
| 2 | Design Tokens | 04-07 | yes |
| 3 | Design Components | 08-13 | yes |
| 4 | Data Models | 14-17 | yes |
| 5 | Services | 18-21 | yes |
| 6 | State Stores | 22-25 | yes |
| 7 | Sidebar Views | 26-30 | yes |
| 8 | Detail Header & Nav | 31-34 | yes |
| 9 | Event Type Views | 35-42 | yes |
| 10 | Decision & Retrospective | 43-45 | yes |
| 11 | Chapter & Detail Container | 46-48 | sequential |
| 12 | Chat Components | 49-54 | yes |
| 13 | Chat Container | 55-57 | sequential |
| 14 | Overlays & Settings | 58-62 | yes |
| 15 | App Integration | 63-66 | sequential |
| 16 | Export & File Detail | 67-69 | yes |
| 17 | Server Scaffold | 70-72 | yes |
| 18 | Trajectory API | 73-76 | yes |
| 19 | Chat Infrastructure | 77-81 | sequential |
| 20 | WebSocket Bridge | 82-84 | sequential |
| 21 | Testing & Launch | 85-88 | yes |
| 22 | Accessibility & Polish | 89-92 | yes |
| 23 | Final Verification | 93-95 | yes |

**Total: 95 workflows, 23 waves**
**Estimated time: ~8-12 hours with 4-8 way parallelism per wave**

### Parallelism Heuristics

Waves 1-6, 7-10, 12, 14, 16-18, 21-23 are fully parallel (no file conflicts).
Waves 11, 13, 15, 19-20 are sequential (container views depend on components).

Server workflows (17-21) can run in parallel with Mac app workflows (7-16)
after Wave 6 completes (shared models are in place).
