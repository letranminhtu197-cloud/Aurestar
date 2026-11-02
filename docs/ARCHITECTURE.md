# Desktop architecture

```text
Renderer windows (index / widget / companion / reminder)
                    │ narrow contextBridge APIs
                    ▼
Electron main process ── JSON store / reminders / OS idle / alarms / tray / shortcuts
                    │ local runtime-message bridge
                    ▼
Bundled Aurestar background engine ── task, focus and training rules
```

## Processes and storage

- `src/main.cjs` owns all native windows, the tray, global shortcuts, native alarms, Windows idle state, notifications and the canonical file.
- `src/preload.cjs` exposes a limited set of methods to pages. It does not expose Node, filesystem or general IPC access to the renderer.
- `src/renderer.js` renders the task and settings interface and sends actions to the background engine.
- `resources/aurestar-chrome/background.js` remains the business-logic engine. Its Chrome-shaped storage calls now reach the single Electron JSON store. Its alarm API is backed by Electron main-process timers and reconciles due alarms after resume.
- `src/core/persistence.cjs` backs up old files, merges records, writes atomically and refuses to overwrite unreadable user data.

## Desktop boundary

App pages are loaded from local files with context isolation, disabled Node integration, sandboxing, a Content Security Policy, a denied webview path and IPC sender checks. External HTTP(S) links are opened through the operating system after URL parsing. Browser extension APIs that need live browser tabs are not represented as working desktop features.

## Timer behavior

Focus and workout state use absolute end timestamps in the existing business-logic engine. The Electron main process owns alarm deadlines; timer callbacks reconcile against wall-clock time, and resume events fire deadlines that elapsed during sleep. The renderer only displays snapshots and does not own timer truth.
