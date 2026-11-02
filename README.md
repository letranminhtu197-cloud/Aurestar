# Aurestar Desktop

Aurestar is a local-first desktop workspace for tasks, habits, focus sessions, training timers, calendar history and reminders.

## Development

Use Node.js 24 and npm:

```powershell
npm ci
npm test
npm run check
npm run dist:win
```

`dist:win` creates an x64 NSIS setup program and a portable executable in `dist/`. The source archive and original downloaded release files are preserved separately in the task backup folder.

## Data

The desktop app stores its canonical JSON state at `%APPDATA%\aurestar-desktop\aurestar-data.json`. On the first upgraded launch it merges the previous Electron JSON store with the previous Chrome-shaped JSON store. It first copies existing files to the `backups` folder; records with IDs from both stores are retained, with the store used by the existing UI winning when the same ID differs. Invalid files are preserved and cause a visible startup error instead of being replaced with empty state.

The app does not encrypt this local JSON file. Use the in-app backup/export controls and protect the Windows account that owns the file.

## Desktop integration limits

Core tasks, focus, training, reminders, local notifications and backups run without Chrome. This build does not control browser tabs or inject code into other apps. Website blocking is therefore shown as unavailable; it does not change Windows networking, firewall, registry or hosts settings. Video links open in the system's default browser.

Windows auto-update is not enabled in this release. The app and generated installer are unsigned because no publisher certificate was supplied. See [the audit](docs/AUDIT.md) for scope, design and release limitations.
