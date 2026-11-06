# Verification

Install pinned development tools with `npm ci`. Committed shell assets are ready to serve; run `npm run build:shell` after changing shell sources.

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
9. On Android, open online twice/reload for the new service worker, then verify install/navigation and the cache named `financeflow-shell-` plus the version in `shell-release.json`. The cache must contain no chosen historical file, private cloud records or auth traffic. Cached shell access does not imply offline cloud write support. Reconnect and refresh before retrying ambiguous saves.
10. Check keyboard/dialog/Escape behavior, focus, reduced motion, mobile date fields, text zoom and screen-reader labels.
11. Export production data, apply reviewed migration, deploy, sign in as the intended owner, preview/import the private input and download the runtime report. This PR does not merge or execute a production historical import automatically.

## PR #2 reliability review

The continuation review passes `npm test` (22 calculation/import cases, five auth/queue race cases, one disposable PostgreSQL integration case) and `npm run test:browser`. JavaScript syntax checks also pass. Early dependency/test attempts were blocked by network permissions and npm cache access; these were resolved using the environment's network permission and a writable cache. Both complete suites were then run successfully. The real Supabase project was inspected using schema/policy/constraint metadata only; no production rows were read, inserted, changed or deleted.

New regressions cover preserved legacy zeros versus missing values, different same-day meals with equal macros, recipe bounds per serving, rejected/considered price exclusions, invalid clock times, invalid import references, preflight owner checks, lost insert responses, direct and transitive concurrent dependency conflicts, and repeat-safe omitted optional notes. Finance auth tests delay old-account finance/shift responses, switch accounts during a shift lookup, cancel stale queued saves, and confirm explicit signout drains queued owner saves before revoking auth.

The Chromium workflow additionally creates a custom food with zero protein and null carbs, checks two-serving recipe calculations and range scaling without consumption, replaces a previewed import with an invalid file, switches accounts through SIGNED_IN events, restores the original account's finance records, and checks that API/import fixtures never enter the shell cache. The existing preview/repeat import, meal edit/delete/undo, recipe creation, weight recording, finance/work saves, statistics, export, offline error, account isolation, responsive fit and service-worker tests remain enabled.

The existing additive migration was reviewed against the live legacy column types, owner policies and weight uniqueness constraint. It creates new v2 tables only, enables per-user RLS on each, uses composite owner foreign keys and an invoker recipe RPC, and does not alter legacy tables or records. No migration was applied to production. Disposable PostgreSQL tests verify preservation of seeded legacy records, cross-user and anonymous rejection, atomic recipe rollback and repeat imports.

Before deployment, still complete real Supabase Auth/API checks with two test accounts, test an installed Android upgrade/offline shell, and review/apply the additive migration after exporting production data. The private historical source is unavailable in this checkout and has not been re-audited or imported during this continuation. The owner must choose it in authenticated Settings, review the preview and confirm the actual import. Do not treat browser mock authentication as verification of production authentication or an Android installation.

## Visual redesign checks

Run `npm run test:visual` for the synthetic, disposable-database visual suite. It captures every section at 320, 360, 390, 430, 768 and 1440px into ignored `test-results/visual/after/`, checks control/document fit, 44px targets and readable chart labels, then exercises navigation, import filters, modal keyboard behavior, reduced motion, contrast, empty/loading/error states, long labels, large numbers and simulated keyboard geometry. It never connects to a production API. See [DESIGN-REVIEW.md](DESIGN-REVIEW.md) for the audit, design tokens, committed before/after screenshots and real-device limitations. The redesigned shell cache is `financeflow-shell-v2.1.0`.

## Installed-PWA upgrades

Run `npm run test:pwa` for the real service-worker upgrade regression at `/FinanceFlow/`, including actual legacy workers, stale/failed asset responses, fresh/upgrade layouts at 320–430px, offline shell, cache cleanup, retained browser storage, future deployments and safe explicit reloads. See [PWA-UPDATES.md](PWA-UPDATES.md). Current cache identifiers and hashed asset URLs come from `shell-release.json`; do not hard-code old cache names in new tests. Run `npm run build:shell` after shell edits; `npm test` rejects stale generated output.
