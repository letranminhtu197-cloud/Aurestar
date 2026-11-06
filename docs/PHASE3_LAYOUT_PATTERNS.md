# Phase 3 — Layout patterns and separate Habits workspace

## Design references translated into Aurestar patterns
- Linear: persistent navigation hierarchy, compact metadata, clear action menus, restrained density.
- Todoist: fast task capture, scannable task rows, visible completion state and low-friction filters.
- TickTick: first-class calendar, habit tracking and focus workflow without mixing unrelated controls.
- Sunsama: daily planning context and a clear separation between today's work and longer-term tracking.

These are interaction/layout references only; Aurestar retains its own Itsuki-inspired plum, rose, ivory and gold identity.

## Implemented in this batch
- Split Tasks and Habits into separate first-class navigation destinations.
- Replace the former Habits navigation alias with a dedicated Habits workspace.
- Move habit creation, completion, editing and deletion to that workspace; preserve existing action handlers and persistence APIs.
- Add a seven-day completion history strip per habit, with historical cells informational only. The existing completion action continues to toggle today's date only.
- Remove the duplicated habit panel from the Tasks page.
- Link Overview's habit progress and habit shortcut directly to Habits.

## Verification boundary
- This is a renderer/layout change; it does not change habit storage or completion semantics.
- Automated checks and Windows runtime visual QA remain necessary. In particular verify first-run empty state, daily and weekly habits, completion toggles, edit/delete confirmation, narrow-window layout and data persistence after restart.
