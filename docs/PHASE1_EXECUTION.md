# Phase 1 — Execution and acceptance

Status: implementation in progress; acceptance is blocked on green CI and Windows runtime verification.  
Working branch: `feature/phase1-unified-core`  
Baseline: `feature/phase2-productivity-data`

## Phase 1 scope

Phase 1 is the React + TypeScript workspace backed by SQLite: Dashboard, Goals, Milestones, Projects, Tasks, search, settings, persistence, archive/restore and task relationships. The daily MIT planner is an additive productivity improvement on this branch.

The working branch also contains Phase 2 modules inherited from its baseline. Their presence is not a substitute for the Phase 1 acceptance checks.

## Implemented changes on this branch

- Added shared local-calendar date helpers for the Electron main process and renderer.
- Replaced UTC-derived business-date defaults in Habit, Journal, Insights, Dashboard and Weekly Review calculations.
- Converted analytics date grouping for UTC timestamps to operating-system local time.
- Added regression tests for leap days, month/year boundaries, configured week starts and timezone behavior.
- Added SQLite schema migration 8 for daily plans and ordered MIT task selections.
- Enforced a maximum of three distinct, active Tasks per daily plan.
- Exposed daily-plan retrieval and save through sender-validated IPC and the narrow preload bridge.
- Added a Dashboard panel for a daily intention and up to three MITs.
- Included daily plan tables in JSON export/import and SQLite ZIP backup snapshots.
- Added Journal restart-persistence and daily-plan export/restore regression tests.
- Expanded packaged smoke-test diagnostics and corrected its calendar-date fixtures.

## Persistence boundary

- The React workspace uses SQLite under Electron's user-data directory.
- Legacy Itsuki/Pomodoro widget windows continue to use their existing JSON-backed runtime.
- The two persistence paths are not bidirectionally synchronized in this branch. Legacy JSON files are retained; do not delete or overwrite them during Phase 1.
- Daily MIT data belongs to the SQLite workspace and references active Task records using foreign keys.

## Date/time contract

- Absolute event timestamps remain ISO-8601 UTC values.
- Business dates use local `YYYY-MM-DD` calendar strings.
- Calendar arithmetic is performed on date-only values.
- SQL analytics convert UTC event timestamps using SQLite's `localtime` modifier.

## Acceptance checklist

- [ ] Full Node test suite passes on the latest commit.
- [ ] TypeScript typecheck and Vite production build pass.
- [ ] Static source/security checks pass.
- [ ] Windows NSIS installer and portable x64 build complete.
- [ ] Packaged smoke test passes through renderer, IPC and SQLite writes.
- [ ] Close/relaunch smoke test confirms Goals, Projects, Tasks, Habit, Focus, Journal and Weekly Review persistence.
- [ ] Migration 8 is verified against a representative existing database; prior Phase 1 rows remain intact.
- [ ] Manual Windows acceptance covers navigation, task CRUD/status/relationships, board/list views, settings persistence, archive/restore, daily MIT and legacy widget startup.
- [ ] Legacy JSON data and widgets remain intact after an upgrade test.

## Known verification history

An earlier Windows CI run on commit `e54264c7` failed three tests: two Phase 1 tests still expected schema version 7 after migration 8, and a local-time analytics test assumed the CI host used the Vietnam timezone. The schema assertions and timezone-dependent test were corrected in subsequent commits. The latest commit is awaiting a fresh CI result; no passing result is claimed yet.

## Release constraints

- Do not merge this branch into `main` until all automated checks pass.
- Do not delete legacy JSON data or historical branches during this phase.
- Do not claim packaged Windows runtime verification solely from unit tests or a successful build.
- Phase 1 is not complete until both CI and the manual Windows acceptance checklist pass.
