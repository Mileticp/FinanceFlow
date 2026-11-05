# Verification

Install pinned development tools with `npm ci`. No frontend build step is required.

- `npm test`: calculation/import tests and disposable PostgreSQL (PGlite), without a production connection.
- `npm run test:browser`: Chromium/Playwright and the real application, with mocked authentication/transport backed by disposable PostgreSQL and RLS. Set CHROMIUM_PATH if Chromium is not at /usr/bin/chromium. Permit the localhost server/browser in restricted environments.

Only fictional synthetic records are committed. The supplied private dataset was verified separately without publishing its contents; its detailed audit is delivered to the owner.

Automated coverage includes Ljubljana day/DST boundaries, missing macros, quantity scaling, uncertainty ranges, missing-day averages, measured-only weight smoothing, verified cost metrics, CSV escaping, private-input field validation, deterministic imports, conflict preservation, interrupted/concurrent imports, anonymous and cross-user RLS denial, ownership FKs and atomic recipe rollback. Seeded legacy records survive migration.

Browser checks cover local-file preview without writes, repeated import, nullable meal creation/edit/delete/undo, legacy food editing without changing original unknown macros/notes, catalog search/favorites, atomic recipe creation without consumption, dated weights, existing finance/shift saves, preserved unknown finance settings, custom statistics ranges, complete backup, offline errors, account isolation, responsive layouts and PWA caching.

## Manual checks before production merge

1. Apply the additive migration to a separate test project with the inspected legacy schema. Verify real Supabase Auth and SELECT/INSERT/UPDATE/DELETE with two test accounts; recipe/catalog references cannot cross accounts.
2. Sign in, choose the privately delivered historical JSON file in Settings and preview it. Check the visible account and every create/skip/flag decision before confirming. Repeat import; identical records must be skipped. Edited imports and deleted tombstones must not be overwritten or silently reappear.
3. Compare the private audit with the runtime report: catalog variants stay distinct, recipes do not become consumed entries, uncertain totals are flagged, hypothetical meals excluded and undated references never become time-series points.
4. Create a nullable-macro meal, edit its date/time and supplied ranges, cancel/delete/undo, scale a catalog quantity, repeat a previous meal and build a recipe. Recipe unknown ingredients must stay visible.
5. Record a dated weigh-in. An existing same-day measurement must not be overwritten. Set optional goals/profile references and actual activity separately; no measured deficit or activity should be fabricated.
6. Verify known compatible prices permit cost metrics, while considered/unverified products remain unavailable for factual cost comparisons. Purchases must not be inferred from recommendations.
7. Check 7/30/90-day/custom statistics, gaps for missing intake, partial-day averages, actual-only weight points and no curve from undated values.
8. Exercise existing transactions, budgets, savings goal, pay settings, shift duplicate-date warning, deletion and explicit finance backup/import. Export all JSON and CSV; verify legacy rows and provenance. Allow multiple downloads for per-table CSV if prompted.
9. On Android, open online twice/reload for the new service worker, then verify install/navigation and cache financeflow-shell-v2.0.0. The cache must contain no chosen historical file, private cloud records or auth traffic. Cached shell access does not imply offline cloud write support. Reconnect and refresh before retrying ambiguous saves.
10. Check keyboard/dialog/Escape behavior, focus, reduced motion, mobile date fields, text zoom and screen-reader labels.
11. Export production data, apply reviewed migration, deploy, sign in as the intended owner, preview/import the private input and download the runtime report. This PR does not merge or execute a production historical import automatically.
