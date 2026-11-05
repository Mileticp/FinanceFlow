# Import status and audit

No production historical data has been inserted or overwritten by this PR. The private historical file and detailed audit are delivered separately to its owner, rather than publishing personal nutrition, weight, profile and health-goal information in this public repository.

After applying the reviewed migration, the intended user signs in and chooses that private JSON file in Settings. Preview lists create, identical skip and flagged conflicts. The create-only action produces a downloadable report of every successfully created, skipped, flagged or failed record. That runtime report is the definitive production import result.

Local verification imported the supplied private dataset in a disposable database, confirmed source entry totals, kept uncertain/undated references separate, preserved unknown macros, excluded hypothetical meals and created no dated weigh-ins or activity from undated references/goals. An identical rerun created no duplicates. The detailed historical success/discrepancy list is in the privately delivered audit.

Public regression tests use only the synthetic fixture in tests/fixtures/synthetic-history.json. It includes catalog foods, a recipe, three fictional diary entries, partial-day statuses, empty profile/goals and fictional undated/disputed notes. It contains no personal historical payload.

Actual reviewed conflicts are never silently resolved: edited import identifiers, possible duplicate meals, pre-existing profiles/goals/day status and conflicting references stay unchanged. Missing quantities, dates and nutrition remain unknown. Deployment and authenticated import are intentionally pending review.
