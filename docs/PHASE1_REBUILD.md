# Phase 1 rebuild — implementation notes

## Application structure
- src/main.cjs: retained Electron lifecycle, native windows, tray, reminders and legacy widget runtime.
- src/preload.cjs: retained compatibility bridge used by the existing background host and widgets.
- src/preload-v2.cjs: narrow-purpose bridge for the new React renderer.
- src/core/sqlite.cjs: SQLite schema, prepared queries and transactional relationship writes.
- src/app/: React + TypeScript application shell, feature views, Zustand store, design tokens and Vite build.
- test/phase1/: SQLite integration tests.

## Database
The database is created under Electron's user-data directory as aurestar.sqlite. It enables WAL, foreign keys and a busy timeout. Tables cover goals, milestones, projects, tasks and their many-to-many relationship tables. Deleting a goal cascades its milestones and relationship links; tasks and projects remain independent.

## Widget preservation
The legacy main process and existing Pomodoro/Itsuki widget assets are intentionally retained. The primary app window now loads the new React renderer. The existing widget windows still load their original HTML/JS and continue using the legacy preload and JSON state. No widget redesign is included in Phase 1.

## Verification boundary
The automated workflow installs dependencies, runs SQLite integration tests, type-checks and builds the renderer, then packages Windows NSIS and portable artifacts. Passing CI does not replace screenshot/interaction testing on a real Windows desktop. Do not mark Phase 1 accepted until the workflow is green and the packaged application has been launched and tested.
