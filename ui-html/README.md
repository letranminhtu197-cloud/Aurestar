# Aurestar 2.0.0 — HTML interface pack

This pack contains seven top-level interface pages and two separate widget previews, based on the source tree at commit:
`531130fdaa4eb3f5851482698edc09de7cd0f2cf` (Professional Edition 2.0.0).

## Pages
1. `overview.html` — Overview dashboard
2. `tasks-habits.html` — Tasks and Habits in one workspace, with tabs
3. `focus.html` — Focus / Pomodoro workspace
4. `calendar.html` — Calendar and agenda
5. `training.html` — Training timer and session
6. `insights.html` — Progress and Motivation tabs
7. `settings.html` — Settings

## Separate widgets
- `pomodoro-widget.html`
- `itsuki-widget.html`

## Open
Extract the ZIP while preserving its folder structure. Open `ui-html/overview.html` in a browser. The pages link to each other and use the shared `aurestar-ui.css` and `aurestar-ui.js` files. The Itsuki widget uses `resources/itsuki/itsuki-pet.png`.

## Important
These are standalone HTML/CSS/JS interface previews. Buttons and timers that are not purely visual run locally as demonstrations; they do not connect to Aurestar's Electron main process, background engine, user data, notifications, or real focus/training state. They are not a replacement for the installed application.
