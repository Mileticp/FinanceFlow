# FinanceFlow v2

A vanilla HTML/CSS/JavaScript personal dashboard for finance, work, nutrition and weight. Hosted as a GitHub Pages PWA with Supabase Auth and owner-scoped PostgreSQL records.

Serve this directory with `python3 -m http.server 8000`, then open http://localhost:8000. Committed shell assets are ready to serve. After editing shell sources, regenerate them with `npm run build:shell`. Existing account sign-in is reused; no service-role key belongs in this repository.

Before enabling v2 nutrition writes, review and apply `supabase/migrations/*_nutrition_v2_additive.sql`. Then sign in as the intended user and choose your private historical JSON file in Settings. Preview before confirmation. Personal historical data is deliberately absent from this public repository and app cache.

- [Architecture and deployment](docs/ARCHITECTURE.md)
- [Import status](docs/IMPORT-REPORT.md)
- [Testing](docs/TESTING.md)
- [Visual audit, design system and before/after screenshots](docs/DESIGN-REVIEW.md)
- [Synthetic input example — fictional data only](tests/fixtures/synthetic-history.json)

Development checks: `npm ci`, `npm test`, `npm run test:browser`. Tests use disposable PostgreSQL and mocked authentication without production writes.

PWA releases: after changing shell sources, run `npm run build:shell` and commit the generated assets/manifest. `npm test` checks that they match. See [PWA update hotfix and Android recovery](docs/PWA-UPDATES.md); verify upgrades with `npm run test:pwa`.
