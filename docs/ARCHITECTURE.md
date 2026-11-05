# FinanceFlow v2 architecture and rollout

This extends the existing vanilla HTML/CSS/JS GitHub Pages PWA. Finance handlers and IDs, Supabase client/authentication, finance JSON payload, shift integration, manifest identity and icon assets are retained. The dashboard adds seven views, mobile bottom navigation, desktop sidebar, edit dialogs, SVG charts and reduced-motion support. No framework or frontend build is required.

## Existing records

The inspected main branch contains index.html, food.html, README, two icons, manifest and sw.js. This branch is based on current main, not the earlier unmerged nutrition PR. food.html redirects to the integrated nutrition view so bookmarked links remain useful.

Existing tables are transactions, work_shifts, budgets, settings, financeflow_data, food_logs and weight_logs. Finance data stays in its original paths. Unknown root properties in the finance JSON payload are retained during normalization; queued saves capture their owner before enqueueing.

Existing food_logs are read alongside new nutrition_entries without copying or rewriting them. Existing weight_logs remain the dated measurement source. Duplicate-day weigh-in inserts fail instead of upserting over old records. Legacy protein zero is preserved in storage and displayed as recorded, with an explicit ambiguity note because the earlier food page also used zero for unknown protein. Missing protein remains null; no zero is automatically reclassified as missing. Legacy values remain unverified. A blank legacy macro edit retains its original stored value; new entries support true null macros.

## Additive normalized schema

| Table | Purpose |
| --- | --- |
| nutrition_foods | Catalog; brand/variant, nutrition basis/unit, nullable macros, ranges, EUR price and compatible quantity/unit, availability, favorites, provenance |
| nutrition_recipes | Reusable recipe templates and yield; never consumed meals |
| nutrition_ingredients | Recipe-food relationships; known quantities and explicitly unknown ingredients |
| nutrition_entries | Dated consumed entries; optional local time, macro/range snapshots, catalog/recipe links, soft-delete tombstones |
| nutrition_days | Per-day completeness and notes |
| nutrition_profiles | Undated profile and weight references, excluded from charts |
| nutrition_goals | Optional nutrition/weight/walking goals, unmeasured maintenance and optional user-chosen net-pay factor |
| nutrition_history | Undated mentions, hypothetical plans, discrepancies and reported totals |
| nutrition_activity | Actual user-entered observations only |
| weight_logs (existing) | Actual dated measurements; reused without table changes |

New tables have owner SELECT/INSERT/UPDATE/DELETE RLS, authenticated grants and no anonymous grants. Composite ownership foreign keys prevent references to another user's catalog/recipes. Indexes support owner/date reads and relationships. The recipe RPC is SECURITY INVOKER, checks authentication and creates parent/ingredients atomically under RLS. It never writes diary entries.

## Private import design

Personal historical input is deliberately absent from this public repository, public test fixtures and service-worker cache. Settings reads a JSON file chosen locally by the signed-in user. The file remains in memory until the user confirms authenticated cloud insertion. Signing out clears it. No raw history is placed in localStorage, public assets or logs. Only synthetic, non-personal test data is committed under tests/fixtures.

js/importer.js validates the input structure and rejects privileged fields such as user_id. It derives deterministic UUIDs from authenticated user ID + table + versioned source key. Unique (user_id, import_key) constraints prevent duplicates, including concurrent imports. Preview separates create, identical skip and flagged conflicts. Imports use INSERT only: existing records, edited imports, tombstones, existing profile/goals/day statuses and possible duplicate legacy/new meals are never overwritten. Conflicting parents block dependent rows. Interrupted imports preserve progress in a report and can be previewed again safely.

The private input and full historical audit are delivered separately to the owner. See IMPORT-REPORT.md for production status. No production schema or historical user records are changed by this PR. The tools do not have an authenticated end-user session; no account ID is guessed.

## Calculations

Dates use Europe/Ljubljana regardless of device timezone; day arithmetic handles DST boundaries. Optional time is explicitly local. Unknown macros stay null; known subtotals show unknown-value counts. No carbohydrates/fat/fiber are inferred. Original historical estimates remain separate from recipe calculations and reported summaries.

Supplied ranges scale with quantities. A full-day uncertainty range is shown only when every estimated component has one; unknown uncertainties do not get fabricated bounds. Nutrition averages exclude days without entries and label partial days. The seven-day weight mean uses actual observations only, with no interpolated weigh-ins, no curve from undated references and no connection across gaps longer than seven days.

Walking goals do not create activity. Maintenance is unmeasured; the app does not invent expenditure or present a measured deficit. Optional calorie goals are user-selected, not recommendations based on low historical intake. Cost comparisons require known compatible price/nutrition quantities; unverified offers do not become actual prices or purchased products. Work gross estimates remain separate from recorded transactions. Optional estimated net uses an explicitly user-selected factor.

## PWA and backup

financeflow-shell-v2.0.1 caches only same-origin app shell assets. No private import file, cloud records, auth or Supabase API requests are cached. Older FinanceFlow shell caches are removed on activation. Installed Android clients receive updated local assets on the next online load/reload. The existing Supabase CDN library and cloud sign-in require connectivity; offline writes are not queued. Failed refreshes retain loaded records.

Settings exports all existing/new cloud tables as JSON or individual CSV files, including notes/evidence and legacy finance payload. CSV guards formula-like strings. General nutrition backup restore is not automatic: use the reviewed historical importer or a reviewed restoration procedure. Existing explicit finance import stays separate from nutrition and weight.

## Rollout order

1. Review the PR and export existing data.
2. Apply supabase/migrations/*_nutrition_v2_additive.sql to the intended project using SQL editor or your migration workflow. It is additive and transactional. A conflicting pre-existing v2 schema fails instead of being overwritten.
3. Verify owner policies, authenticated grants and invoker RPC permissions.
4. Deploy to a test environment, sign in as the intended user and choose the privately delivered JSON file in Settings. Preview and review flags before confirming.
5. Download the runtime report and backup. Preview a second time; identical records must not be created again. Review conflicts manually.
6. Complete real Supabase Auth, cross-account and Android checks in TESTING.md before merging. This task does not merge or publish main automatically.
