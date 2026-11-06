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


## Global usability and balanced sizing rules
- Keep primary navigation labels and the most-used actions visible; put secondary/rare actions in clearly discoverable menus.
- Use a consistent control target: approximately 38–42 px for common buttons and inputs, with compact icon-only controls allowed when their hit area remains usable.
- Use 14 px as the normal interface text baseline; secondary metadata may be smaller but must remain comfortably readable.
- Cards should size to their content. Avoid fixed tall cards, oversized headings, oversized empty-state panels and decorative whitespace.
- Use responsive grid columns with sensible minimum widths. When space becomes constrained, stack panels instead of shrinking text and controls until they become difficult to use.
- Preserve hierarchy: page title and primary action first, key status/metrics second, detailed lists and history after that.
- Do not expose every low-frequency action as a full-size button. Keep the common workflow obvious and secondary actions accessible through labeled menus or contextual controls.
- Acceptance checks for each page: at a normal desktop window, key content and primary actions are visible without hunting; no clipping/overlap; no tiny text; no oversized empty cards; narrow windows reflow rather than compress; keyboard focus remains visible.
