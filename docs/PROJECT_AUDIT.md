# Aurestar Desktop — Project Audit

Audit date: 2026-11-02  
Repository: `letranminhtu197-cloud/Aurestar`  
Default branch: `main`  
Main HEAD observed: `987b7b437653ade935e19c8e728e1fdd27288f75`

## Executive result

The repository is not currently a complete, reproducible Electron source checkout. Its `main` tree contains only:

- `Aurestar-16.16.59-Background-Reminder-Reliability.zip` (3,393,896 bytes)
- `app.asar` (3,743,968 bytes)

The separately supplied ASAR archive was unpacked for source inspection. It contains editable JavaScript, HTML, CSS and assets, but it is still a packaged application archive rather than a complete source/build checkout.

A confirmed renderer startup defect was found and patched in the extracted working copy: `bindGlobal()` called `.forEach()` on the result of `document.querySelector()` for optional elements. When no matching element existed, the result was `null`, producing the reported `Cannot read properties of null (reading 'forEach')`. The two calls now use the existing `$$` helper backed by `document.querySelectorAll()`.

**No Windows installer was built and no full Electron runtime test was possible.** Missing build inputs and external background resources are blockers.

## Extracted archive inventory

The ASAR contains `main.cjs`, `preload.cjs`, `renderer.js`, `styles.css`, `index.html`, `background-host.html`, `itsuki.html`, `itsuki.js`, `pomodoro-widget.html`, `pomodoro-widget.js`, icon assets and Itsuki images. Its inner `package.json` reports `name=aurestar-desktop`, `version=1.0.0`, `main=main.cjs`, and dependency `uiohook-napi@1.5.4`.

The ASAR marks `uiohook-napi` files as unpacked. A corresponding `app.asar.unpacked/node_modules/uiohook-napi` payload is therefore required beside the ASAR, but is not present in the repository tree.

## Confirmed findings

### P0 — renderer startup crash

In the extracted `renderer.js`, `bindGlobal()` used the singular `$` helper (based on `document.querySelector()`) for two selectors and called `.forEach()` on the result. This crashes when the current view has no matching edit-task or task-menu element. Both uses are patched to `$$` (based on `document.querySelectorAll()`). A regression test covers the empty-selector case.

### P1 — data recovery risk

`main.cjs::readState()` catches every read/JSON parse error and returns `defaultState()`. Startup then calls `saveState()`. A corrupt or temporarily unreadable existing state file can therefore be overwritten with defaults. `readChromeStorage()` has a similar broad catch and can replace its storage file with an empty/migrated object. This must be corrected with backup-first recovery and tested using real-format data fixtures.

### P1 — background scheduler cannot yet be verified

`main.cjs` declares `reminderTimer` and `focusTickTimer`, and defines `checkSchedule()` and `tickFocus()`, but the inspected file contains no assignment that starts either timer. `showReminderLine()` is a no-op and `reminderWindow` is declared but unused. Actual scheduling may be implemented in the external background script, but that script is not in the supplied ASAR and could not be inspected.

### P1 — incomplete source/build checkout

The repository has no root package manifest, lockfile, Electron version declaration, installer configuration, tests or GitHub Actions workflow. The main process also resolves `aurestar-chrome/background.js` from `process.resourcesPath` when packaged and from `../legacy-extension/Aurestar/background.js` in development. That required resource is not in the inspected ASAR.

### P2 — security hardening

The inspected BrowserWindow constructors use `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`. However, consistent IPC sender/argument validation, restrictive CSP and navigation/popup policy were not found in the inspected files and need a full-source security pass.

### Desktop compatibility bridge

`preload.cjs` exposes a limited `aurestarChrome` API through `contextBridge`; `bridge-alias.js` assigns that bridge to `chrome`. Renderer code still uses extension-shaped APIs. This is an Electron compatibility shim, not evidence that Google Chrome must be installed. Some shim APIs are stubbed, so their use must be mapped against actual application requirements.

## UI observations

The extracted `index.html` already contains a Dark Plum-style shell and navigation for Overview, Tasks & Habits, Focus, Calendar, Training and Settings. Lists are not a primary sidebar destination in the extracted HTML, although list-management UI and list data remain in the renderer. Removing Lists from navigation must not destroy task-list data.

## Patch scope

- Fix the two null `.forEach()` calls in `bindGlobal()`.
- Replace stale Chrome Extension recovery instructions with desktop-app instructions.
- Add a regression test for absent optional controls.
- Preserve the original ASAR in the local audit bundle.

No live user data was opened or modified. GitHub `main` was not changed.