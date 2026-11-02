# Changelog

## 2.0.0 — Desktop Professional Edition

- Fixed renderer startup/interaction crashes from treating single elements as collections.
- Consolidated local app data with backups, record merging and atomic writes.
- Moved alarms to the Electron main process and use Windows idle state.
- Added native reminder window, application menu and compact focus widget.
- Added Content Security Policy and IPC sender checks for local windows.
- Added source checks, persistence/alarm tests, Windows CI, NSIS and portable build targets.
- Made website-blocking limitations visible. This build does not alter Windows networking or browser settings.
- Rebased the app on Electron 45.2.1 and electron-builder 26.18.0.
- Windows signing and auto-update remain disabled until a publisher certificate and release credentials are configured.
