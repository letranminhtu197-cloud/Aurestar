# Aurestar

Aurestar is an offline-first personal productivity desktop app built with Electron, React, TypeScript and SQLite.

## Phase 1 — new foundation

This branch introduces a new React/TypeScript workspace for Dashboard, Goals, Milestones, Projects and Tasks. The existing Electron main process and floating Pomodoro / Itsuki widget windows are retained while the primary application renderer is replaced.

### Requirements
- Node.js 24
- npm
- Windows for the installer build (the app can be developed on other desktop platforms)

### Run locally
```bash
npm install
npm run dev
```

npm run dev type-checks and builds the local renderer before launching Electron.

### Verify and package
```bash
npm test
npm run typecheck
npm run build
npm run dist:win
```

The Windows build produces an NSIS installer and a portable executable in dist/.

### Local data
The Phase 1 workspace database is stored at aurestar.sqlite under Electron's user-data directory. SQLite uses foreign keys, WAL mode, indexes and prepared statements. Existing legacy JSON state is retained separately for the two floating widgets; this phase does not delete or overwrite that data.

### Phase 1 scope
- Dashboard overview and live counts
- Goals and goal milestones
- Projects with optional many-to-many goal links
- Tasks with optional project and goal links, priorities, dates, completion and parent-task relationship in the database layer
- Local SQLite persistence
- Dark and light Itsuki-inspired themes

Settings, Habits, Focus page, Journal, Insights, full data management, and the remaining product scope are Phase 2 or later. The retained floating widgets continue to use the legacy Focus engine and legacy JSON state until the later migration phase.

## Security
The renderer uses a dedicated context-isolated preload bridge. It does not receive Node.js or filesystem APIs. All SQLite operations run in the Electron main process and IPC channels are allowlisted by the preload.
