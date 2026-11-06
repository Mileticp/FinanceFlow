# Shift times and timesheet copying

New shifts use native 24-hour From/To inputs and immediately show elapsed HH:MM. Durations are calculated as integer minutes, including midnight crossings. Equal times, incomplete pairs and invalid clocks are rejected. No breaks are subtracted; wage estimates continue to use stored decimal hours and the shift's saved rates, assuming the entered duration is paid. Workplace Excel deductions remain separate.

Existing `work_shifts` already has nullable `start_time`, `end_time` and `break_minutes`. **No migration is required and no production schema/data was modified.** Old decimal hours remain unchanged until an explicit edit. Missing times display Unavailable; Excel leaves those cells blank. Legacy edits may retain both times blank and preserve their duration; entering actual times explicitly recalculates elapsed hours. Editing retains the original hourly/mileage rates and break metadata. Writes and deletes filter by authenticated owner; account changes clear the editor.

Work totals, history and graph hour labels use the shared `FFShift` formatter, including monthly durations over 24 hours. Each row exposes copy start/end/duration and an Excel row; Copy month produces chronological newline-separated rows. The format is `DD.MM.YYYY<TAB>HH:MM<TAB>HH:MM<TAB>HH:MM` with actual tabs, no headings or guessed times. Clipboard API is preferred; a legacy selection copy is attempted if unavailable/denied, followed by a manual selectable dialog if the browser refuses both. Physical Android Chrome/Brave clipboard permissions should still be smoke-tested.

Full Settings JSON/CSV exports retain raw start/end/decimal hours through their existing table exports. Finance-only restore continues to exclude database work shifts by design, preserving existing records rather than overwriting them. No nutrition import or finance calculation logic changes.

## Screenshots

All data shown is fictional. The before image is the prior design-review Work fixture; the after image is the extended browser test with timed/overnight shifts and an explicitly edited legacy row.

[Before](shifts/before-390.png) · [After](shifts/after-390.png)

## Verification

Run `npm run build:shell`, `npm run check:shell`, `npm test`, `npm run test:browser`, `npm run test:visual`, and `npm run test:pwa`. The new utility is included in the generated immutable asset manifest and in the future-deployment upgrade fixture. Existing cached assets remain retained; new files use new hashes.

Tests cover same-day/overnight minute calculations, invalid/equal clocks, decimal conversion, totals beyond 24 hours, legacy missing times, wage compatibility and exact TSV/JSON preservation. Browser checks save timed/overnight records against disposable PostgreSQL, edit a legacy row without changing its rate, intercept clipboard text and inspect 320/360/390/430px layouts. Existing finance/nutrition/export/auth tests remain enabled. No production import, merge or deployment is performed.
