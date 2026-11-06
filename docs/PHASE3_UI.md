# Phase 3 — Complete UI redesign

Date: 2026-11-06
Branch: `feature/phase3-complete-ui-redesign`
Base: `feature/phase2-functional-audit`

## Design direction

Aurestar uses a Dark Plum Professional visual system: deep plum surfaces, restrained rose accents, muted violet depth and warm gold highlights. The design keeps Aurestar's identity rather than copying another product.

## Scope of this implementation batch

- Establish shared color, typography, surface, border, radius, shadow and focus-ring tokens.
- Restyle the application shell, sidebar, topbar, navigation, buttons, inputs, cards, badges, progress indicators, task rows, modal surfaces, notifications and floating add action.
- Apply a consistent visual layer to Overview, Tasks/Habits, Focus, Calendar, Training, Progress and Settings using existing renderer class hooks.
- Improve responsive behavior: compact icon rail at tablet widths, horizontal navigation on narrow windows, responsive topbar and single-column content layouts.
- Preserve existing page templates, renderer actions, storage model, Electron main/preload architecture and business logic.
- Add visible keyboard focus treatment and reduced-motion support.
- Keep inner list/history regions bounded while preserving the main page's natural vertical scroll.

## Verification

This is a source-level CSS implementation and does not claim a completed visual QA pass. The Windows CI workflow must run `npm test`, `npm run check` and `npm run dist:win`. Visual verification is still required on Windows at common window sizes (1920x1080, 1366x768, 1024x768 and a narrow window), including scroll reachability, modal fit, keyboard focus and all page states.

## Known boundaries

- This batch does not claim a complete redesign of every individual renderer template or a runtime screenshot review.
- Existing Chrome-compatibility bridge and native widget behavior are intentionally not rewritten as part of a CSS design layer.
- The Pomodoro and Itsuki windows have separate stylesheets and need their own dedicated visual QA pass.
- Do not merge until CI and Windows visual QA have been reviewed.
