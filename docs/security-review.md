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

## Audit observations (2026-11-06)
- Examined the 19 commits returned by repository commit search, checking their available diff text for common Supabase secret-key, GitHub token and private-key patterns. No matches were found. **Not exhaustive:** this does not include every branch, unreachable Git object, encoded credential, or credentials omitted from diffs.
- Reviewed the eight `innerHTML` assignment locations in `js/app.js` (lines 89, 99, 114, 138, 148, 166, 185, 222 at the audited revision). The file defines an HTML-escaping helper `E`, but a full taint/attribute-context analysis and runtime XSS testing remain outstanding. These locations are not proof of a vulnerability.
- Confirmed `index.html` loads the floating jsDelivr `@supabase/supabase-js@2` bundle without SRI, and contains a large inline script. Do not deploy a strict CSP or modify the bundle until compatibility and atomic shell-update tests pass.
- The production sign-out path clears visible state before calling Supabase signOut, but token revocation and cross-account isolation were not tested end-to-end.
