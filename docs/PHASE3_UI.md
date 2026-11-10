# Phase 3 — Itsuki visual system and layout redesign

Date: 2026-11-07
Branch: `feature/phase3-itsuki-design-system`
Base: `feature/phase2-functional-audit`

## Design direction

Restore the original Itsuki companion palette as Aurestar's primary visual identity:
- Deep plum / near-black wine backgrounds.
- Warm rose as the primary interactive accent.
- Soft ivory text and muted mauve secondary text.
- Restrained gold for rewards and important progress.
- The main app and both floating widgets share the same palette language.

The design changes page hierarchy and layout proportions while retaining existing renderer templates, event handlers, state, storage, and Electron window behavior.

## Layout work

- App shell: stable sidebar, compact topbar, one natural main-page scroll region.
- Overview: streak and three progress indicators first; activity, today's tasks/habits, goals and calendar arranged in a balanced three-column desktop grid.
- Tasks & Habits: daily habits grouped above the task board; task list remains the primary column with summary metrics secondary.
- Focus: timer is the primary surface; mode/round selection and controls remain grouped; daily stats, goal and complete history form a secondary rail.
- Calendar: month grid and selected-day detail share a two-column layout; activity history and goals sit below.
- Training: active workout and exercise progression are primary, with the session sequence in a secondary rail.
- Progress: summary metrics, trend, breakdown and next actions have a clear hierarchy.
- Settings: consistent two-column groups on desktop and one column on narrow windows.
- Responsive breakpoints collapse grids and navigation without imposing a fixed minimum window width.
- Modal, input, button, progress, focus-visible and reduced-motion states use the shared design tokens.

## Feature preservation

This batch is presentation-only. It does not intentionally change task, habit, focus, training, calendar, progress, backup, reminder, widget, or persistence logic. Existing buttons and renderer actions are retained.

## Verification boundary

The source changes are not proof that every feature works at runtime. CI results must be checked for the new head commit. Windows visual QA is still required at 1920x1080, 1366x768, 1024x768 and a narrow window, including scroll reachability, modal fit, keyboard focus, floating widget appearance, and interaction smoke tests for every page.

Do not merge until CI and Windows runtime QA are reviewed.
