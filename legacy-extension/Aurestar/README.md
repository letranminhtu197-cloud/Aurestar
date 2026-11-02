# Aurestar 16.16.38

Chrome Manifest V3 study planner with Tasks, Habits, Calendar, Focus Timer, and Itsuki companion.

## Background study reminders
- Schedules a one-shot Chrome alarm for the next local half-hour slot from 06:00 through 21:30.
- Reschedules after each reminder and during service-worker initialization; the Aurestar dashboard, popup, and side panel do not need to be open.
- Uses Chrome alarms rather than a polling loop and does not intentionally keep the service worker alive.
- Chrome must remain running; browser/OS notification permission must be allowed. Notifications cannot be guaranteed while Chrome is fully exited, the computer is asleep, or OS Focus Assist/Do Not Disturb suppresses them.
- Privacy Mode intentionally disables notifications.

## Startup recovery
- Existing installs load persisted state without waiting for optional background alarm/widget synchronization.
- Fresh installs still seed a default state before first use.
- Startup errors get up to three state-request attempts; the error screen exposes stack details and a Retry button.

## Validation
See `QA-REPORT-16.16.38.txt` for syntax, manifest, resource, scheduler-boundary, and package-integrity checks. Live notification delivery must still be verified in the target Chrome/OS environment.
