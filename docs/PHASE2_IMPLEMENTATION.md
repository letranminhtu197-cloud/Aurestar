# Phase 2 implementation tracker

Base: `feature/phase1-new-foundation`
Working branch: `feature/phase2-product-completion`

Phase 2 is implemented incrementally on the existing Electron + React + TypeScript + SQLite application. Phase 1 modules and data are retained. No destructive schema changes are permitted.

## Existing architecture audit

- SQLite is opened in Electron Main by `src/core/sqlite.cjs`; schema version is currently 3.
- React uses `src/app/api.ts` and Zustand `src/app/store.ts`.
- The renderer talks to Electron through the narrow `src/preload-v2.cjs` bridge.
- `src/main.cjs` owns database lifecycle and validates the sender for v2 workspace IPC.
- Current SQLite tables cover Goals, Milestones, Projects, Tasks, tags, links and settings.
- Current v2 UI routes only cover Overview, Goals, Projects and Tasks.
- Existing global search only indexes Goals, Projects and Tasks.
- Existing Settings persistence only accepts theme, density, sidebarCollapsed and defaultLandingPage.
- Existing schema migration handling must be made genuinely versioned before Phase 2 data tables are introduced; the current bootstrap creates the initial tables and records versions 1–3.

## Phase 2 acceptance checklist

### Habit tracking
- [ ] Habit CRUD and active/archive lifecycle
- [ ] Daily, selected weekdays, weekly and custom schedules
- [ ] Dated completion/value/note logs
- [ ] Today, weekly and monthly calendar views
- [ ] Complete history, current and longest streaks
- [ ] Daily/weekly/monthly consistency calculations
- [ ] Streak interruption never deletes historical logs

### Focus
- [ ] In-app Focus page only; no floating Focus widget
- [ ] Presets: 25/5, 50/10 and 90/15 minutes; custom durations
- [ ] Start, pause, resume, reset, skip and end session
- [ ] Optional task link and session note
- [ ] Timestamp-based timer; no interval as time source
- [ ] Persisted running/paused state and restart/sleep recovery
- [ ] Complete history and session statistics
- [ ] Optional native notification

### Journal and Weekly Review
- [ ] Daily Reflection with optional mood, energy, wins, challenges, lessons, tomorrow focus and notes
- [ ] Free Writing with Markdown-compatible formatting
- [ ] Autosave, manual save and Saving/Saved/Error states
- [ ] Calendar, search, edit, delete and links to Goals/Projects/Tasks
- [ ] Weekly task/focus/goal/habit summary and reflection
- [ ] Save Weekly Review as a Journal entry

### Insights
- [ ] Task, Focus, Goal and Habit analytics
- [ ] Productivity patterns by weekday/hour and task trends
- [ ] 7/30/90 days, this month, this year, custom range and all time
- [ ] Line/bar/progress/heatmap charts where meaningful
- [ ] Empty states and calculation explanations
- [ ] No AI and no mandatory productivity score

### Search and Settings
- [ ] Global search across Goals, Projects, Tasks, Habits and Journal
- [ ] Ctrl/Cmd+K, Ctrl/Cmd+N, Ctrl/Cmd+, and Escape
- [ ] Appearance: theme, accent, font size, density, sidebar
- [ ] General: language, date/time formats, week start, landing page
- [ ] Tasks: default priority/view/sort
- [ ] Focus: durations, long-break interval, sound and auto-start
- [ ] Journal: default entry type, autosave, Markdown preview
- [ ] Privacy, Data Management and About sections

### Data management
- [ ] JSON export includes all entities, settings, metadata and schema version
- [ ] CSV export for Tasks, Goals, Projects, Habits, Habit Logs and Focus History
- [ ] ZIP backup with database, assets, manifest, metadata and version
- [ ] Import file selection, format/schema validation and preview
- [ ] Duplicate detection and Merge/Update/Replace strategies
- [ ] Automatic pre-import backup
- [ ] Transactional import and post-import integrity verification
- [ ] Restore and detailed import report
- [ ] Failed/invalid import must not corrupt current data

### Verification
- [ ] SQLite integration tests for all CRUD, schedules, calculations and relationships
- [ ] Focus timer transition, restart and sleep/resume tests
- [ ] Journal autosave and Weekly Review tests
- [ ] Insights calculations tested against deterministic fixtures
- [ ] JSON/CSV roundtrip and ZIP backup/restore tests
- [ ] Merge/Update/Replace conflict tests and rollback tests
- [ ] Search coverage across all modules
- [ ] Migration tests prove existing Phase 1 data survives
- [ ] Windows packaged smoke test covers new modules and persistence

## Engineering constraints

- Keep database and business logic out of React components.
- Keep Electron IPC narrow, allowlisted and payload-validated.
- Use prepared statements, transactions, foreign keys, indexes and versioned migrations.
- Use absolute timestamps for Focus timer truth.
- Do not execute code from imported files or load remote scripts/CDNs.
- Do not replace existing Phase 1 records during migrations.
- Do not mark Phase 2 accepted until every checklist item and packaged integration test passes.
