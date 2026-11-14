# Desktop architecture

```text
React workspace renderer
        │ narrow, sender-validated contextBridge API
        ▼
Electron main process ── SQLite database (React workspace)
        │
        ├── native windows / tray / alarms / notifications
        │
Legacy widget windows
        │ compatibility preload / runtime-message bridge
        ▼
Legacy background engine ── legacy JSON-backed state
```

## Processes and storage

- `src/main.cjs` owns native windows, tray integration, shortcuts, notifications, the React workspace database and legacy widget lifecycle.
- `src/preload-v2.cjs` exposes the narrow React workspace API. It does not expose Node, filesystem or unrestricted IPC access.
- `src/app/` contains the React + TypeScript renderer, feature views, Zustand store and Vite entry point.
- `src/core/sqlite.cjs` owns the versioned SQLite schema, migrations, prepared queries, transactional relationship writes, daily planning, and backup data.
- `src/preload.cjs`, `src/renderer.js` and `resources/aurestar-chrome/background.js` remain the compatibility path for legacy widget/background behavior.
- The React workspace and legacy widget runtime currently have separate persistence paths. SQLite is authoritative for the React workspace; the legacy runtime continues to use its JSON-backed state. Automatic bidirectional synchronization is not implemented and must not be assumed.

## Date and time contract

- Event instants are stored as ISO-8601 UTC timestamps.
- Business dates such as Habit log dates, Journal dates and daily plan dates are local-calendar `YYYY-MM-DD` values.
- Calendar arithmetic uses date-only helpers, not elapsed-millisecond division.
- Analytics that group UTC timestamps by calendar date explicitly convert them to the operating-system local time.
- A timezone change must not silently rewrite stored business dates.

## Electron security boundary

The primary React window uses context isolation, disabled Node integration and sandboxing. Workspace IPC handlers verify the trusted renderer sender. Local app pages use a Content Security Policy; pop-ups and webviews are restricted. External links are parsed and limited to HTTP(S).

## Verification boundary

Automated tests cover persistence, migrations, relationships, task state transitions, local-date arithmetic, daily MIT validation, restart persistence and backup/restore. CI also type-checks, builds and packages Windows artifacts, then runs a packaged smoke test. A green CI result is required but does not replace a clean Windows desktop install/upgrade and interactive acceptance test.
