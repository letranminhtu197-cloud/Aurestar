# Phase 1 — Unified Core Execution

Status: in progress  
Working branch: `feature/phase1-unified-core`  
Baseline: `feature/phase2-productivity-data`

## Scope

Phase 1 stabilizes the existing Electron + React + TypeScript + SQLite workspace and completes the daily planning foundation. Work is additive and isolated to this branch. The default branch and historical feature branches are not modified.

## Implemented in this branch

- Added shared calendar-date utilities for the Electron main process and renderer.
- Replaced UTC-derived default business dates with operating-system local dates in Habit logging, Journal entry creation, Insights defaults, task overdue counts, Dashboard filters and Weekly Review date calculations.
- Added regression tests for timezone-sensitive local dates, leap days, month/year boundaries and week-start configuration.
- Added SQLite schema migration 8 for daily plans and ordered MIT task selections.
- Added database validation limiting each daily plan to at most three distinct, active tasks.
- Added daily plan retrieval to the workspace load result and a narrow sender-validated IPC/preload bridge for saving plans.
- Added the Dashboard MIT panel with an optional daily intention and three task selectors.
- Included daily plan tables in JSON export/import and SQLite ZIP backup snapshots.
- Added a Journal restart-persistence regression test and expanded the packaged smoke-test diagnostics.

## Data model

- `daily_plans.plan_date` is the local calendar date and primary key.
- `daily_mit_items` stores ordered task references, with positions 1–3.
- Foreign keys cascade when a referenced task or daily plan is deleted.
- A unique constraint prevents selecting the same task twice for one date.
- Daily planning data is stored in SQLite; no cloud service is required.

## Date/time contract

- Absolute event timestamps remain ISO-8601 UTC values.
- Business dates use local `YYYY-MM-DD` calendar strings.
- Calendar arithmetic is performed on date-only values, not by dividing elapsed seconds into 24-hour days.
- Timezone changes must not silently rewrite historical business dates.

## Verification still required

- Run the complete Node test suite and TypeScript production build on GitHub Actions.
- Run the Windows packaged smoke test, including a close/relaunch persistence check.
- Investigate the existing Journal persistence failure. The previous CI run reported one Journal row after restart but did not match the expected title; the new regression test and expanded smoke diagnostics are intended to isolate this.
- Verify migration 8 against a representative pre-existing database and confirm all earlier records remain intact.
- Complete remaining Phase 1 UI and data-integrity acceptance checks before marking this phase complete.

## Safety constraints

- Do not merge this branch into `main` until CI and Windows runtime checks pass.
- Do not delete legacy JSON data or historical branches during this phase.
- Do not claim Windows packaged runtime verification based solely on unit tests or a successful build.
