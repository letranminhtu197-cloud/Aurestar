# Aurestar Desktop

Windows desktop application workstream for Aurestar. The Chrome extension source and its bundled assets remain preserved in `legacy-extension/Aurestar/`; this desktop app is a separate build and does not modify `main`.

## Build on Windows
Install Node.js 20+ and Git, then run from this directory:
```powershell
npm install
npm start
npm run dist
```
The packaged installer and portable executable are written to `desktop/release/`.

## Included in this initial desktop port
- Windows desktop window and system tray; hide-to-tray behavior.
- Local JSON data persistence in Electron's application user-data directory.
- Task CRUD, due dates/times, priority, completion history, search and quick-add.
- Daily habits and completion tracking.
- Focus timer UI, pause/resume/reset and session recording.
- Calendar, progress summaries, training log and motivation quotes.
- Desktop notifications and schedule reminders; daily local JSON backups.
- JSON import/export, keyboard shortcuts, local settings and block-list editor.
- Existing source tree and visual assets retained unchanged.

## Important parity notes
This is a first runnable desktop foundation, not yet a verified 1:1 replacement for every extension feature. Browser-extension-only functionality (content-script overlay injected into arbitrary browser tabs, Chrome alarms, Chrome side panel, and reliable system-wide website blocking) needs native Windows/browser integration and cannot be honestly marked complete from an Electron UI alone. The block-list editor currently saves settings but does not block other browsers. Test timer pause/recovery and reminders on the target PC before relying on them.

## Data location
Data is stored under Electron's `app.getPath('userData')` as `aurestar-data.json`. Export a JSON backup before upgrading builds.
