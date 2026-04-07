# Trail Viewer — Workflow Build Plan

A beautiful macOS app for reading and navigating agent trajectories,
with multi-agent chat powered by agent-relay.

**95 workflows · 23 waves · Claude leads + Codex workers**

## Quick Start

```bash
# See the full plan
npx tsx workflows/run-all.ts --list

# Dry run (show execution order)
npx tsx workflows/run-all.ts --dry-run

# Build everything
npx tsx workflows/run-all.ts

# Resume from a specific wave
npx tsx workflows/run-all.ts --from=7

# Run a single wave
npx tsx workflows/run-all.ts --wave=9

# Only app or server workflows
npx tsx workflows/run-all.ts --app-only
npx tsx workflows/run-all.ts --server-only
```

## Agent Pattern

Every workflow follows the same structure:

```
Claude lead (planner) ──→ outputs complete code spec
    ↓
Codex worker (impl) ──→ writes file to disk
    ↓
Deterministic step ──→ verify file exists + git commit
```

| Role | CLI | Preset | Job |
|------|-----|--------|-----|
| Planner | `claude` | `lead` | Designs and outputs complete code |
| Implementer | `codex` | `worker` | Extracts code from spec, writes to disk |

## Wave Map

### Foundation (Waves 1-3) — 13 workflows, all parallel

| Wave | Workflows | What gets built |
|------|-----------|----------------|
| 1: Project Scaffold | 01-03 | Package.swift, TrailViewerApp, AppConfiguration |
| 2: Design Tokens | 04-07 | Theme, Typography, Animations, Layout constants |
| 3: Design Components | 08-13 | BookCard, Badges, SectionElements, EmptyState, Skeleton, Toast |

### Data Layer (Waves 4-6) — 12 workflows, all parallel

| Wave | Workflows | What gets built |
|------|-----------|----------------|
| 4: Data Models | 14-17 | TrajectoryModels, ChatModels, SettingsModels, APIModels |
| 5: Services | 18-21 | APIClient, RelayConnection, CLIDetector, ServerManager |
| 6: State Stores | 22-25 | TrajectoryStore, ChatStore, CLISettingsStore, AppStateStore |

### Views (Waves 7-16) — 44 workflows

| Wave | Workflows | Parallel? | What gets built |
|------|-----------|-----------|----------------|
| 7: Sidebar | 26-30 | yes | Header, FilterBar, Row, List, Skeleton |
| 8: Detail Header | 31-34 | yes | Header, ChapterNav, TimelineRail, Skeleton |
| 9: Event Types | 35-42 | yes | Base, Note, Finding, Thinking, ToolCall, Reflection, Error, Message |
| 10: Decision & Retro | 43-45 | yes | DecisionCard, RetrospectiveView, ConfidenceMeter |
| 11: Chapter & Detail | 46-48 | seq | ChapterView, FileChanges, TrajectoryDetailView |
| 12: Chat Components | 49-54 | yes | Markdown, CodeBlock, Typing, PersonaCard, Bubble, Input |
| 13: Chat Container | 55-57 | seq | PersonaSelector, EmptyStates, ChatPanelView |
| 14: Overlays | 58-62 | yes | CommandPalette, Welcome, CLI/Path Settings |
| 15: App Integration | 63-66 | seq | StatusBar, ContentView, TrailViewerApp, KeyboardShortcuts |
| 16: Export & Detail | 67-69 | yes | ExportSheet, FileDetailModal, SearchHighlight |

### Server (Waves 17-21) — 19 workflows

| Wave | Workflows | Parallel? | What gets built |
|------|-----------|-----------|----------------|
| 17: Server Scaffold | 70-72 | yes | package.json, health, server skeleton |
| 18: Trajectory API | 73-76 | yes | Service, formatter, REST routes, export routes |
| 19: Chat Infra | 77-81 | seq | CLI resolver, personas, ChatSession, ChatService, chat routes |
| 20: WebSocket Bridge | 82-84 | seq | WS types, RelayBridge, final server wiring |
| 21: Testing & Launch | 85-88 | yes | Mock data, chat test, launch.sh, API test |

### Polish (Waves 22-23) — 7 workflows

| Wave | Workflows | What gets built |
|------|-----------|----------------|
| 22: Accessibility | 89-92 | Tooltips, focus management, time formatter, clipboard |
| 23: Verification | 93-95 | Swift build check, TS typecheck, smoke test |

## Architecture

```
trail-viewer/
├── Package.swift
├── launch.sh
├── Sources/
│   ├── TrailViewerApp.swift
│   ├── ContentView.swift
│   ├── AppConfiguration.swift
│   ├── Design/
│   │   ├── Theme.swift              # 04
│   │   ├── Typography.swift         # 05
│   │   ├── Animations.swift         # 06
│   │   ├── LayoutConstants.swift    # 07
│   │   ├── BookCard.swift           # 08
│   │   ├── Badges.swift             # 09
│   │   ├── SectionElements.swift    # 10
│   │   ├── EmptyState.swift         # 11
│   │   ├── SkeletonView.swift       # 12
│   │   ├── ToastView.swift          # 13
│   │   ├── SearchHighlight.swift    # 69
│   │   └── HelpTooltips.swift       # 89
│   ├── Data/
│   │   ├── TrajectoryModels.swift   # 14
│   │   ├── ChatModels.swift         # 15
│   │   ├── SettingsModels.swift     # 16
│   │   ├── APIModels.swift          # 17
│   │   ├── APIClient.swift          # 18
│   │   ├── RelayConnection.swift    # 19
│   │   ├── TrajectoryStore.swift    # 22
│   │   ├── ChatStore.swift          # 23
│   │   ├── CLISettingsStore.swift   # 24
│   │   └── AppStateStore.swift      # 25
│   ├── Services/
│   │   ├── CLIDetector.swift        # 20
│   │   ├── LocalServerManager.swift # 21
│   │   ├── KeyboardShortcuts.swift  # 66
│   │   ├── FocusManagement.swift    # 90
│   │   ├── RelativeTimeFormatter.swift # 91
│   │   └── ClipboardService.swift   # 92
│   └── Views/
│       ├── Sidebar/
│       │   ├── SidebarHeader.swift      # 26
│       │   ├── FilterBar.swift          # 27
│       │   ├── TrajectoryRow.swift      # 28
│       │   ├── TrajectoryListView.swift # 29
│       │   └── SidebarSkeleton.swift    # 30
│       ├── Detail/
│       │   ├── TrajectoryHeaderView.swift  # 31
│       │   ├── ChapterNavigation.swift     # 32
│       │   ├── TimelineRail.swift          # 33
│       │   ├── DetailSkeleton.swift        # 34
│       │   ├── Events/
│       │   │   ├── EventCardBase.swift     # 35
│       │   │   ├── NoteEventView.swift     # 36
│       │   │   ├── FindingEventView.swift  # 37
│       │   │   ├── ThinkingEventView.swift # 38
│       │   │   ├── ToolCallEventView.swift # 39
│       │   │   ├── ReflectionEventView.swift # 40
│       │   │   ├── ErrorEventView.swift    # 41
│       │   │   └── MessageEventView.swift  # 42
│       │   ├── DecisionCard.swift          # 43
│       │   ├── RetrospectiveView.swift     # 44
│       │   ├── ConfidenceMeter.swift       # 45
│       │   ├── ChapterView.swift           # 46
│       │   ├── FileChangesView.swift       # 47
│       │   └── TrajectoryDetailView.swift  # 48
│       ├── Chat/
│       │   ├── MarkdownRenderer.swift   # 49
│       │   ├── CodeBlockView.swift      # 50
│       │   ├── TypingIndicator.swift    # 51
│       │   ├── PersonaCard.swift        # 52
│       │   ├── ChatBubble.swift         # 53
│       │   ├── ChatInputBar.swift       # 54
│       │   ├── PersonaSelector.swift    # 55
│       │   ├── ChatEmptyStates.swift    # 56
│       │   └── ChatPanelView.swift      # 57
│       ├── Settings/
│       │   ├── CLISettingsView.swift    # 60
│       │   ├── PathSettingsView.swift   # 61
│       │   └── SettingsView.swift       # 62
│       ├── CommandPalette.swift         # 58
│       ├── WelcomeView.swift            # 59
│       ├── StatusBar.swift              # 63
│       ├── ExportSheet.swift            # 67
│       └── FileDetailModal.swift        # 68
├── server/
│   ├── package.json                 # 70
│   ├── tsconfig.json                # 70
│   └── src/
│       ├── server.ts                # 72 → 84
│       ├── health.ts                # 71
│       ├── trajectory-service.ts    # 73
│       ├── trajectory-formatter.ts  # 74
│       ├── cli-resolver.ts          # 77
│       ├── personas.ts              # 78
│       ├── chat-session.ts          # 79
│       ├── chat-service.ts          # 80
│       ├── relay-bridge.ts          # 83
│       ├── ws-types.ts              # 82
│       ├── mock-trajectories.ts     # 85
│       ├── test-chat.ts             # 86
│       ├── test-api.ts              # 88
│       └── routes/
│           ├── trajectories.ts      # 75
│           ├── exports.ts           # 76
│           └── chat.ts              # 81
```

## Design Direction

"The Beautiful Notebook" — light mode, book-like reading experience:
- Warm paper backgrounds (#faf8f5 page, #f0ece4 sidebar)
- Serif headings for chapter titles (.serif design)
- Pastel blue (#7eb8da) for interactive/structural
- Golden yellow (#f2d479) for highlights and warmth
- Generous margins (720pt max content width)
- Thin rule lines as dividers
- Follows @anthropic/frontend-design: distinctive, not generic

## Chat Personas

| Persona | Emoji | Color | Perspective |
|---------|-------|-------|-------------|
| Architect | 🏗️ | #7eb8da | Design decisions and architecture |
| Detective | 🔍 | #b5a2d4 | What happened, cause and effect |
| Mentor | 🧑‍🏫 | #7ec89b | Explains simply, highlights learnings |
| Critic | 🤔 | #f2d479 | Questions assumptions, finds gaps |
| Historian | 📜 | #e8a87c | Connects to past decisions and patterns |
| Optimizer | ⚡ | #89c4c4 | Faster/better approaches for next time |
