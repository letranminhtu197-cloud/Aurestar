# Aurestar Desktop Rebuild

This branch is the isolated workstream for converting Aurestar from a Chrome extension into a Windows desktop application. The `main` branch is intentionally left unchanged.

## Current source baseline

The repository currently contains `Aurestar-16.16.59-Background-Reminder-Reliability.zip` on `main`. The newer `Aurestar-16.16.60-Faster-Background-Checks.zip` was referenced in a prior ChatGPT conversation, but it is not currently present in this repository or the active workspace. Do not label 16.16.59 as 16.16.60.

Use **Actions → Prepare Aurestar source for desktop rebuild → Run workflow** to extract the newest archive available in this branch into `legacy-extension/`. The workflow prefers 16.16.60 if it is added before the run; otherwise it records that it had to use the archive actually present. The ZIP is retained unchanged. The workflow commits only to `desktop-rebuild`.

## Non-negotiable migration rules

1. Preserve existing features, settings, user data schemas, images, icons, fonts, audio/video assets, and page-specific UI unless the source audit proves an item is unused or broken.
2. Never modify `main` during this work. Work only on `desktop-rebuild` and review changes before any merge.
3. Do not claim a feature is complete based on a mock UI or static inspection alone. Record whether it is implemented, automated-tested, and manually tested.
4. Do not discard user data. Add versioned migrations, backup/restore tests, and an explicit recovery path before changing storage.
5. Keep the core experience local-first. External media may need network access; make that behavior explicit instead of silently removing or downloading remote assets.
6. Website blocking must be described honestly. A desktop app cannot automatically inherit Chrome extension blocking APIs; evaluate a supported Windows-specific implementation and its permissions, scope, and limitations.

## Required audit before porting

- Inventory all HTML, CSS, JavaScript, JSON data, manifest permissions, local images/icons, fonts, audio/video, and third-party libraries.
- Map every UI action to its background handler and data/storage key.
- Document all alarms, recurring reminders, state transitions, focus and break timers, startup behavior, tray behavior, and notification paths.
- Capture current layouts and responsive states so the desktop UI retains Aurestar's visual identity.
- Identify Chrome-only APIs and provide desktop equivalents with explicit fallbacks.
- Establish baseline automated tests for tasks, habits, focus/pause/resume/stop, break transitions, reminders, blocking, backup/restore, and asset references.

## Target desktop architecture (provisional until source audit)

Prefer **Tauri 2 + React + TypeScript + Rust + SQLite** if the source audit confirms it can preserve the existing UI and workflows with acceptable effort. Keep reusable UI components and bundled assets local. Put reliable timers, scheduling, tray integration, and Windows notifications in a long-lived native layer rather than depending on a webview staying open. Use a versioned SQLite schema and migration tests for structured data; retain an import path for existing extension data.

If an existing browser-only feature cannot be faithfully ported to Tauri, document the trade-off and choose the least disruptive implementation before changing user-facing behavior.

## Feature acceptance matrix

| Area | Required result |
|---|---|
| Tasks, schedule, habits, statistics | Existing operations and historical records preserved |
| Focus/Pomodoro | Start, pause, resume, stop, break, skip-break, auto-cycle, restart recovery |
| Reminders | Existing fixed-time and recurring schedules, no duplicate notifications, reliable background execution |
| Tray and startup | Minimize/close behavior and startup options work as configured |
| Website blocking | Scope and permissions are explicit; block state follows focus state and recovers after restart |
| Motivation/media | Preserve image/video assets, local media, links, and cleanup behavior |
| Settings and security | Settings persist; secrets/password verifiers are not exported in backups |
| Backup/restore | Invalid backups rejected safely; valid backups preserve unrelated records |
| Visual fidelity | Preserve brand, icons, illustrations, typography, spacing, colors, empty/loading/error states |
| Packaging | Reproducible Windows build, installer, versioning, icons, and clean uninstall behavior |

## Definition of done

- Every discovered feature is mapped to a desktop implementation or a documented, approved limitation.
- Existing data is migrated and round-trip backup/restore is tested.
- Automated tests pass; critical workflows are manually tested on Windows.
- All bundled images and other assets load without missing references.
- The app continues essential reminders and timer behavior when its main window is hidden or closed to tray.
- Build and installation instructions are reproducible from a clean checkout.
