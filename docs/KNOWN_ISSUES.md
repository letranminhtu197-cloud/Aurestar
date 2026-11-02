# Aurestar — Known Issues and Release Blockers

| Priority | Issue | Status |
|---|---|---|
| P0 | `bindGlobal()` used `querySelector()` results as arrays; empty matches caused the null `.forEach()` startup crash | Fixed in extracted working copy; regression test added |
| P1 | Broad storage catches can replace damaged/unreadable JSON with defaults | Open; data-safe migration not certified |
| P1 | `checkSchedule()` and `tickFocus()` are declared but their Main Process interval handles are not initialized in inspected `main.cjs` | Open; external background engine unavailable |
| P1 | Main Process loads `aurestar-chrome/background.js` from an external resource path; file is absent from inspected ASAR | Blocked pending complete source bundle |
| P1 | Repository has only an ASAR and a ZIP; no editable root source tree, root manifest, lockfile, test suite, build configuration or CI workflow | Blocked pending source package recovery |
| P1 | Native `uiohook-napi` files are marked unpacked in ASAR; corresponding unpacked payload is unavailable in repository tree | Blocked for reproducible package |
| P2 | IPC sender and argument validation are not consistently visible in inspected Main Process | Open |
| P2 | No CSP meta tag is present in inspected `index.html` | Open |
| P2 | Inner app manifest reports version `1.0.0`, while ZIP filename refers to `16.16.59`; version mapping needs confirmation | Open |
| P2 | Auto-update, installer signing, portable packaging and Windows install/uninstall behavior cannot be verified | Blocked / not evidenced |

Do not close an item based only on source edits. Require a test result and a reproducible artifact.