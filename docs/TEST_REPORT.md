# Aurestar Test Report

Date: 2026-11-02  
Target: ASAR-extracted working copy

> This is a source-level regression check, not a full Electron launch or Windows installer test.

| Check | Result | Evidence / limitation |
|---|---|---|
| ASAR extraction | PASS | 59 packed files extracted; original archive preserved separately |
| Main Process syntax | PASS | `node --check main.cjs` |
| Preload syntax | PASS | `node --check preload.cjs` |
| Renderer syntax | PASS | `node --check renderer.js` |
| Itsuki / Pomodoro syntax | PASS | `node --check itsuki.js` and `node --check pomodoro-widget.js` |
| Empty-selector startup regression | PASS | Test invokes extracted `bindGlobal()` with absent optional controls |
| Electron app launch | BLOCKED | Complete project dependencies and external `aurestar-chrome/background.js` are unavailable |
| Data migration / recovery | NOT RUN | Requires complete background implementation and representative backup fixtures |
| Focus / reminder real-time behavior | NOT RUN | Background engine is external; Main Process timer handles are not started in inspected `main.cjs` |
| Windows packaging | BLOCKED | No root package/lockfile, builder config, unpacked native module payload or background resource |
| Installer install/uninstall | BLOCKED | No Setup EXE generated |
| Auto-update | NOT VERIFIED | No updater configuration or release workflow found |

## Regression test command

```bash
node --test tests/*.test.cjs
```

## Release decision

**Do not label this build production-ready.** The renderer startup defect is fixed in the extracted working copy and its static regression test passes. Runtime, persistence, scheduler, packaging, installer and updater acceptance criteria remain unverified or blocked.