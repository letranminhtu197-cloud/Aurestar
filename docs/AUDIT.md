# Aurestar app audit and Professional Edition work

Date: 2026-11-02
Scope: installed Windows application, its unpacked Electron source and ASAR, available GitHub release files, and the working desktop source reconstruction. This is a static review plus source-level verification; it does not modify the installed app or live user data.

## Findings from the installed build

The installed product is an Electron app (metadata version 1.0.0.0) with Electron 37.10.3 and Chromium 138.0.7204.251. Readable files were present under `resources/app-unpacked`; the same principal files were in `resources/app.asar`. The application directory also had a setup copy, a portable build and an unpacked build. The executables inspected were not Authenticode-signed.

The user-visible product combines a task and habit manager, calendar and progress history, Pomodoro focus, guided training timers, notifications, a floating focus widget, the Itsuki companion, local video records, data import/export, tray controls and keyboard shortcuts. The Electron main process owns windows and system integration; the renderer owns the UI; a large Chrome-extension-shaped background script implements most business rules through a compatibility bridge.

### Material defects and limits

- **Startup / interaction crash:** `renderer.js` called `.forEach()` on single-element `querySelector()` results for task edit/menu and gym controls. Those expressions fail because a single element is not a collection. The repaired code uses collection queries.
- **Split data stores:** the running UI used `aurestar-chrome-storage.json`, while older main-process code used `aurestar-data.json`. At the inspected snapshot, the UI store had 55 tasks and one list; the Electron store had 31 tasks and six lists. Thirty task IDs overlapped; 25 tasks were UI-store-only and one was Electron-store-only. Other counts included five habits in each, 37 focus sessions in each, 31 workout sessions in each and 176 vs 177 completions. The two settings sets also differed.
- **Desktop APIs that silently did nothing:** tab queries always returned an empty array, injected scripts and styles were no-ops, website-blocking rule updates returned success without applying rules, and idle state always returned `active`. This made browser enforcement and idle-based behavior unreliable in the desktop build.
- **Timer split:** main-process legacy focus fields were separate from the active `focusEngine`. The desktop widget read the active background engine; old main-process timer code was dormant and could show stale state through its fallback events.
- **Security and packaging:** Electron 37 is end-of-life, some local pages lacked CSP, IPC handlers did not validate the sender page, the downloaded repository held only `app.asar` and a legacy extension source archive, and the installed executables had no publisher signature.
- **Native hook library:** the installed build contained `uiohook-napi`, which can implement a system keyboard/mouse hook, but the audited app source did not import or initialize it. The package presence alone is not evidence of keylogging.
- **Network behavior:** static source review found no telemetry or routine upload of profile/task data. User-requested HTTP(S) video links can leave the app through the system browser. This is not a runtime traffic capture or a claim about every packaged dependency.

The installed profile contained local preferences such as a 25-minute focus period, 5/15-minute breaks, a 120-minute daily focus goal, daily reminder at 06:00, automatic backup at 20:30, dark theme, minimize-to-tray enabled, and local website entries TikTok/Facebook. User JSON is plaintext under `%APPDATA%\aurestar-desktop`.

## Changes in this branch

- Reconstructed a maintainable project root from the readable installed source and the separately installed background engine. The upstream repository did not include that source tree; its original `app.asar` and legacy ZIP were backed up before removing binary-only root artifacts from the working branch.
- Fixed the single-element collection queries that caused renderer exceptions.
- Replaced two active JSON stores with one canonical file, added a one-time backup and union migration for old records, atomic writes, and a fail-safe path for unreadable data. The prior data files are copied into the backup directory before the migration writes; when the same ID differs, the version used by the existing UI wins, and Electron-only records are appended.
- Moved alarm scheduling out of hidden renderer timers and into the Electron main process. Alarm deadlines use absolute timestamps and are reconciled on resume. Idle state now comes from Electron's OS idle monitor.
- Added a native, non-focus-stealing, short-lived reminder window. Routine reminders and motivation links route to native desktop handlers; video links use the default browser.
- Added an accessible compact focus widget which displays focus/short-break/long-break state, round count and progress from the active focus engine.
- Added CSP metadata to local app pages, sender validation around IPC handlers, disabled webviews and denied pop-up windows. External URLs are parsed and limited to HTTP(S).
- Added a native application menu, source checks, Node built-in tests, and a Windows CI workflow that produces NSIS and portable build artifacts.
- Configured Electron 45.2.1 and electron-builder 26.18.0. The installed Electron 37 line is outside active support; Electron's supported release policy keeps only the latest three stable branches supported.

## Verification performed in this branch

The automated suite covers JSON migration and backups, preservation of corrupt input, record merging and alarm timing/resume behavior. The source check parses JavaScript files, guards against the known collection-query bug and checks CSP presence on app pages. The build pipeline is configured for Windows x64 NSIS and portable output.

The source tests pass, static checks pass, `npm audit` reports zero vulnerabilities, and both Windows packages build. A UI launch of Electron 45.2.1 was blocked in this host environment before Aurestar's main process opened: Chromium reported `install_dir_access.cc:52` and `0x80000003`, saying the Electron install directory had a sandbox package ACE without the `ALL APPLICATION PACKAGES` read ACE. This matches a reported Windows sandbox/ACL failure affecting Chromium/Electron apps on this Codex host ([OpenAI Codex issue #15777](https://github.com/openai/codex/issues/15777)). No ACL was changed and the installed Aurestar app/data were not used for this attempt. Validate the packaged app on a clean Windows profile before release.

A Windows signature and unattended auto-update are not enabled because no publisher certificate or trusted release credentials were supplied. Browser-level website blocking remains unavailable by design: this desktop build does not attach to an external browser or alter operating-system network settings.
