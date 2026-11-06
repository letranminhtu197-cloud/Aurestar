# Phase 3 — Study Space HTML reference layout

## Design references translated into Aurestar patterns
- Linear: persistent navigation hierarchy, compact metadata, clear action menus, restrained density.
- Todoist: fast task capture, scannable task rows, visible completion state and low-friction filters.
- TickTick: first-class calendar, habit tracking and focus workflow without mixing unrelated controls.
- Sunsama: daily planning context and a clear separation between today's work and longer-term tracking.

These are interaction/layout references only; Aurestar retains its own Itsuki-inspired plum, rose, ivory and gold identity.

## Implemented in this batch
- Combine Tasks and Habits in one Daily Routine destination with balanced side-by-side columns.
- Keep Habits out of the main navigation; manage them in the Habits column of Daily Routine.
- Keep habit creation, completion, editing and deletion in Daily Routine; preserve existing action handlers and persistence APIs.
- Add a seven-day completion history strip per habit, with historical cells informational only. The existing completion action continues to toggle today's date only.
- Do not expose a separate Habits page; Daily Routine is the unified Tasks + Habits workspace.
- Link Overview's habit progress and shortcut to Daily Routine.

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


## Page-specific workspace layout
- Overview: streak aligned to the upper-right, compact Tasks/Habits/Focus metrics, three-column Activity + Today's Focus + Goals composition, and a month grid alongside activity.
- Daily Routine: Tasks and Habits share one workspace in balanced columns; task quick capture stays with the task column, while habit creation, completion and seven-day check-ins remain in the habit column. Date filters and task completion groups remain available.
- Focus: use a centered timer station, header presets, task/round selection and a four-cell live summary row; retain engine/session data without a visible history panel.
- Calendar: month grid and selected-day schedule use a 70/30 split; a full-width yearly heatmap follows, with goal badges in its header.
- Training: use a three-column exercise-card grid with summary counts and primary actions in the header; retain workout history data without a separate history panel.
- Progress: show four live metrics (Execution, Focus Time, Consistency, Active Days) in one row, retaining the date-range selector.
- Responsive behavior stacks these columns when the viewport cannot preserve readable controls and labels.

## Verification boundary for this layout batch
- Source and regression checks are being rerun on the pull request branch.
- Visual verification in the installed Windows application is still required; this commit does not claim that all layouts have passed runtime QA.


## Supplied Study Space HTML reference
- The app shell uses a persistent left navigation, top breadcrumb/search/actions and a content workspace. Import/export remain available as native actions.
- Overview follows the three-column Activity / Today's Focus / Goals hierarchy, with Tasks and Habits stacked in the middle panel and live progress metrics above.
- Daily Routine uses balanced 50/50 Tasks and Habits columns.
- Focus uses one centered timer station, header presets, task selection, round selection and four live summary metrics. The engine and session history remain intact; the history panel is omitted from this page layout.
- Calendar uses a 70/30 month and selected-day split, followed by a full-width yearly activity graph. Existing date navigation, goal actions and heatmap range controls remain active.
- Training uses a three-column exercise-card grid. History data is retained but the separate history panel is omitted; workout engine, exercise editing and customization remain intact.
- Progress presents the four live metrics from the existing progress calculations. The date-range selector remains available; lower-level charts are hidden to match the supplied reference composition.
- The HTML file is treated as a layout reference only. Tailwind CDN, FontAwesome CDN, static sample data and its standalone demo timer are not copied into the Electron application.
- Verification boundary: CI and Windows runtime screenshot/interaction QA are required before claiming pixel-level parity.
