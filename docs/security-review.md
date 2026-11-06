# FinanceFlow security review and recovery checklist

This is a **review checklist**, not proof of penetration-test coverage.

## Confirmed database hardening (2026-11-06)
- RLS was enabled on the 16 reviewed public tables and ownership policies were inspected.
- Anonymous TRUNCATE, TRIGGER and REFERENCES privileges were revoked on budgets, food_logs, settings, transactions, weight_logs and work_shifts. All 18 effective privilege checks returned false.
- The public rls_auto_enable() function was not executable by anon or authenticated.

## Outstanding security work
- Review every innerHTML and dynamic attribute sink in js/app.js and the inline script in index.html. Do not remove existing HTML escaping without replacing it with safe DOM APIs.
- Replace the floating jsDelivr @supabase/supabase-js@2 dependency with a fixed version and integrity hash, or a locally vendored immutable asset. Validate both online and offline PWA updates.
- Add a CSP only after moving the large inline script and inline styles to managed assets or establishing an appropriate hash-based policy. GitHub Pages does not offer custom response headers; meta CSP has limitations.
- Inspect *all* historical Git objects and branches for credentials. The PR's scanner only checks the current checkout and is heuristic.
- Test isolation using two distinct nonproduction Supabase Auth accounts. Test SELECT, INSERT, UPDATE and DELETE on each table, including cross-account access. Do not use real financial records.
- Check the Supabase auth settings for registration policy, session duration and MFA; verify sign-out removes visible user data.
- Add dependency review and track advisories without blindly applying breaking updates.

## Backup and restore exercise (manual, nonproduction)
1. Sign in and export an encrypted-at-rest copy of personal data to a private location. Never commit backups to Git.
2. Check that the exported file contains the expected finance, work, weight and nutrition data, including relationships and identifiers.
3. Restore only into a **separate test account/project** after confirming the import format and delete/merge behavior.
4. Compare counts and representative records before/after; verify duplicate imports are handled.
5. Delete the temporary test data securely and retain the original backup.

Do not perform a destructive restore in production. Backups are sensitive personal information.
