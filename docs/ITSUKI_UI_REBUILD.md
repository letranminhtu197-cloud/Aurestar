# Aurestar — Itsuki-inspired full interface rebuild

## Design direction
Restore the original Aurestar identity. Use the existing source palette as the baseline: deep wine/plum backgrounds, warm burgundy surfaces, soft rose/crimson interaction accents, muted rose-gray text, and restrained warm gold for achievement/XP only. Confirm exact color values against the original Itsuki widget assets/styles before changing tokens. Do not introduce a generic purple/blue SaaS palette.

## Non-negotiable implementation rules
- Rebuild page composition and component hierarchy, not only append CSS overrides.
- Preserve the Electron main/preload/IPC boundary and all existing business actions.
- Keep user data and persistence formats backward compatible.
- No feature removal or placeholder controls.
- One predictable vertical scroll region for page content; no nested vertical scroll traps.
- At common desktop widths, prevent clipped columns, overlapping cards, hidden actions, and horizontal page overflow.
- Keep keyboard focus visible, dialogs bounded to viewport, and reduced-motion support.
- Keep Itsuki as a separate floating window; do not expose Itsuki controls in the main dashboard.
- Pomodoro remains a separate floating window and must reflect the same Focus Engine state (no second timer engine).

## Information architecture
Sidebar: Overview, Tasks, Habits, Calendar, Training, Focus, Progress, Settings. Keep Lists as task organization/filtering, not a standalone primary destination.

## Page composition
- Overview: compact daily summary; streak and completion KPIs; today's tasks and habits; weekly momentum; focus-time progress; activity/goals/calendar preview. Prioritize actionable information over decorative cards.
- Tasks: clear toolbar and filters; quick-add; grouped task list; priority as secondary metadata; visible completed state; task overflow menu with edit/delete; validated edit modal.
- Habits: today's checklist, frequency and streak context, completion history, add/edit/delete.
- Calendar: month navigation and date selection; selected-day agenda; activity heatmap with local horizontal overflow only.
- Training: weekly schedule and exercise plan; one training task for a workout session; exercise editor and timer states; full history.
- Focus: round selector before start; focus/short break/long break phases; running/paused/completed states; pause/resume/reset; elapsed/remaining time; session history.
- Progress: goals, task/habit/focus metrics, activity history and useful date ranges.
- Settings: grouped preferences, reminders, data backup/import/export, site limits, and clear save feedback.

## Shared component system
One token source and shared components for navigation, page headers, cards, metric tiles, buttons, form fields, menus, dialogs, toasts, empty states, progress bars, and responsive grids. Main UI, Pomodoro, and Itsuki should feel like one product while retaining distinct window layouts.

## Functional acceptance checks
Test every create/read/update/delete path for tasks, habits, goals, training, and settings; task recurrence and completion idempotency; habit frequency/streak calculation; calendar timezone boundaries; Focus round transitions and pause/resume; Focus/Pomodoro synchronization; persistence after app restart; import validation and export round-trip; keyboard shortcuts; modal close/submit/cancel; and widget show/hide/position behavior.

## Verification boundary
Source edits and CI are not equivalent to a Windows runtime test. Do not mark a feature complete until relevant automated tests pass and manual Electron/Windows interaction has been verified. Report unverified items explicitly.
