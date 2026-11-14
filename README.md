# Aurestar

Aurestar is an offline-first personal productivity desktop application built with Electron, React, TypeScript and SQLite.

## Phase 1 — React + SQLite foundation

The primary workspace renderer is React/TypeScript. The Electron main process owns the native windows, secure IPC boundary and local database. The legacy Itsuki companion and floating Pomodoro widgets remain available on their existing renderer/preload and legacy JSON data path.

### Requirements

- Node.js 24
- npm
- Windows for the NSIS installer and portable build

### Run locally

```bash
npm ci
npm run dev
```

### Verify and package

```bash
npm test
npm run typecheck
npm run build
npm run check
npm run dist:win
```

The Windows build produces an NSIS installer and a portable x64 executable under `dist/`.

## Phase 1 acceptance scope

- Dashboard overview and live counts.
- Goals, milestones and progress.
- Projects with optional many-to-many Goal links.
- Tasks with project/goal links, priorities, start/due dates and times, tags, status transitions and parent-task relationships.
- Task list/board views, search, filters, sorting and Quick Add.
- Archive/restore, duplicate and confirmed permanent deletion for Goals, Projects and Tasks.
- SQLite persistence with versioned migrations, foreign keys, indexes, WAL and transactional relationship writes.
- Persisted theme, density, sidebar and default landing-page preferences.
- Dark, light and system-aware themes plus comfortable/compact density.
- Daily planning: an optional intention and up to three ordered Most Important Tasks (MITs), stored in SQLite and included in JSON/ZIP backup and restore.

## Additional modules present in this working branch

The branch is based on `feature/phase2-productivity-data`, so it also contains Habit tracking, Focus sessions, Journal, Weekly Review, Insights and data-management views. Their presence does not change the Phase 1 acceptance criteria. They remain subject to their own functional and runtime verification.

## Data ownership and compatibility

- The React workspace uses `aurestar.sqlite` under Electron's user-data directory.
- The retained legacy widget/background runtime continues to use its legacy JSON-backed store.
- These are separate persistence paths; this branch does not claim transparent two-way synchronization between the React SQLite workspace and legacy widgets.
- Existing legacy JSON data is retained. Do not delete it as part of Phase 1 acceptance.

## Security

The React renderer uses a narrow context-isolated, sandboxed preload bridge. Node.js and filesystem APIs are not exposed to the renderer. SQLite operations run in the Electron main process, and workspace IPC handlers validate their sender.
