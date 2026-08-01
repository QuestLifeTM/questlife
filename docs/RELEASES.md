# QuestLife release runbook

## Ownership

Use one private GitHub repository as the source of truth. Keep `main` deployable;
make product changes on a short-lived `feature/*` or `fix/*` branch and merge through
a pull request.

Protect `main` in GitHub by requiring a pull request and the **Typecheck** check.

## Environments

Maintain independent development, staging, and production environment values in the
relevant provider. Never copy production database data or secrets into development.

### Local development rule

Local `App/.env` and `Admin/.env` must point to the **development** Supabase project,
never production. Before local development starts, copy the relevant `.env.example`
file to `.env` and set it with the development project's public URL and publishable
key. Keep production values only in the release provider's protected environment
settings and on the release machine when a production build is intentionally made.

Before building a TestFlight candidate, verify which Supabase project the build will
use. TestFlight builds should use staging until the app is ready for production.

| Product | Development | Staging/preview | Production |
| --- | --- | --- | --- |
| Mobile (`App/`) | local `.env`, EAS development build | EAS preview build | EAS production build |
| Admin (`Admin/`) | local `.env` | Vercel preview deployment | Vercel production deployment |
| Website (`Website/`) | local `.env` when needed | Vercel preview deployment | Vercel production deployment |
| Backend (`supabase/`) | development project | staging project | production project |

Use the committed `.env.example` files as the list of required local variables. Real
`.env` files stay local and are not committed.

## Vercel

Create two Vercel projects connected to this GitHub repository:

- **QuestLife Admin:** root directory `Admin`; its build configuration is in
  `Admin/vercel.json`.
- **QuestLife Website:** root directory `Website`, once the public website exists.

Set browser-safe environment values in each Vercel project. A value exposed as
`EXPO_PUBLIC_*` is visible to browser users, so never store service-role keys,
database passwords, Apple credentials, or API secrets there.

## Mobile release

Run mobile release commands from `App/`:

```bash
npx eas-cli@latest build --profile preview
npx eas-cli@latest build --profile production
```

`preview` is for internal distribution and tester validation. Build production only
after the merged `main` commit, database changes, and release testing are approved.
Submit the resulting production build through EAS/App Store Connect and Google Play.

## Database release

1. Review the new migration in the pull request.
2. Apply and verify it in development.
3. Apply and verify it in staging.
4. Back up and apply it in production during the release.
5. Verify the mobile and admin workflows that depend on the change.

See [MIGRATION_POLICY.md](MIGRATION_POLICY.md) for the source-of-truth rule.
