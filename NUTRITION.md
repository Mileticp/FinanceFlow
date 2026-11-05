# Food & Weight

Adds a third section to the existing vanilla JavaScript PWA. No build step or database migration is required.

- Daily calories and protein, meals by selected day, and daily nutrition history.
- Meal name, meal type, quantity, total calories/protein for that quantity, estimated flag and notes.
- Reusable presets saved in localStorage under a key scoped to the signed-in user ID. Presets do not sync between devices. Clearing browser storage removes them; export them first.
- Weight logging in kg, latest measurement, full weight history, and confirmed deletion of individual records. Multiple measurements on a day are preserved.
- Nutrition export contains food_logs, weight_logs and device presets. The existing finance backup/import remains separate and does not restore nutrition. Nutrition restore is not included in this change.

Cloud reads/writes require an authenticated connection. The new script is cached with the PWA shell, but offline nutrition writes are not queued. On an ambiguous network failure, refresh before retrying a save to avoid duplicate entries.

## Data contract verified before implementation

Existing Supabase project: `udpfhznurxgbiqlhnulf`.

`food_logs`: id, user_id, logged_on, meal, food_name, quantity, calories, protein_g, estimated, notes, created_at.

`weight_logs`: id, user_id, logged_on, weight_kg, created_at.

Reads explicitly filter user_id and page in batches of 500. Inserts use the authenticated user's ID and let the database generate record IDs/timestamps. Deletes filter both id and user_id and check that a row was returned. Existing RLS SELECT/INSERT/UPDATE/DELETE policies restrict both tables to their owner. No service key is added; the existing public browser key and Supabase client are reused. No live records, schemas, grants or policies were modified during development.

The tracker never writes financeflow_data or work_shifts. The existing finance save, normalization, cloud authentication and shift logic are retained. Sign-in initializes nutrition separately; a nutrition request failure does not prevent finance use. Sign-out clears displayed nutrition data. Unknown/corrupt stored presets are preserved instead of overwritten.

## Test locally

Serve the repository with any static server, for example `python3 -m http.server 8000`, then open http://localhost:8000. Authentication uses the existing project; use a test account for manual writes.

1. Sign in and open Food & Weight. Existing finances and shifts should still display in their original tabs.
2. Log a meal with 420 kcal / 25 g protein. Check selected-day totals and history. Save it as a preset and reuse it after reloading.
3. Change the day: totals should show only that day; history should retain the earlier record.
4. Log a weight, reload, and check weight history. Saving another weight does not replace the first.
5. Export nutrition and verify the downloaded JSON includes meals, weights and presets. Export finance separately.
6. Disconnect the network: failed requests must display an error and retain the loaded history. Reconnect and refresh before retrying.
7. Sign out and use another test account: neither meals nor device presets should carry over.
8. Cancel and confirm an individual delete; verify only that record changes.
9. Check the three tabs on mobile and desktop. In browser Application tools, confirm `financeflow-shell-v2` includes nutrition.js. Online authentication is still required; the Supabase CDN library is not newly cached by this change.
10. On a test account, save a finance transaction and shift, set a budget and goal, and export/import a finance backup. Nutrition records should stay unchanged.

Automated checks:

```sh
node tests/nutrition.test.cjs
node tests/browser.cjs
```

The browser script requires Playwright and Chromium (defaults to `/usr/bin/chromium`) and uses an in-memory mock Supabase client. It tests the actual application in Chromium without sending credentials or mutations to production: validation, numeric totals, safe text rendering, meals, presets, weights, history, owner-filtered deletion, pagination, export, failures, finance transaction saves, account isolation, mobile layout and PWA caching. Live authenticated mutation testing remains a manual pre-merge check.
