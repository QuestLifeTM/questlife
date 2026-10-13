# Supabase migration promotion

`supabase/migrations/` is the only schema source of truth. Database-console
changes are emergency-only: pull them into a reviewed migration before the next
release.

## Normal release flow

1. Create a new migration with `supabase migration new <short_name>`.
2. Write and review the SQL. Apply it to your local database and test the app.
3. Commit the migration. Never rename, edit, delete, or reuse a migration that
   has already reached a shared environment.
4. Merge it into `develop`. The `Supabase migrations` GitHub Action deploys it
   to Development.
5. Verify Development, then merge the same commit into `main`. The same action
   first previews and then deploys the migration to Production.

The workflow uses GitHub Environments, so it needs the following values in both
the `development` and `production` environments:

| Setting | GitHub location |
| --- | --- |
| Project reference | Variable: `SUPABASE_PROJECT_ID` |
| Supabase personal access token | Secret: `SUPABASE_ACCESS_TOKEN` |
| Database password for that project | Secret: `SUPABASE_DB_PASSWORD` |

Set the Development project reference to `kcipfxvkjqrcqcuxneei` and the
Production project reference to `igcadyukzwezrvgtbqxb`. Configure Production
with required reviewers so a merge to `main` cannot silently apply a schema
change.

## One-time reconciliation (current state)

Do **not** repair migration history or run `supabase db push` between the two
existing projects. They are independent projects and their histories diverged.

Production is the baseline. Build a single, new, forward-only promotion
migration from the *intentional* Development features, validate it against a
production-derived test database, and only then merge it to `main`.

At the time this document was created, Development differs from Production in:

- quest state columns and session recovery/inactivity behavior;
- journal-memory edit RPCs and private-media permissions;
- quest post composer/comment controls and rating RPC;
- public profile-bio enforcement; and
- several changed shared RPC definitions.

Production also contains username-security work that is absent from
Development. Do not overwrite Production's username functions or generated
username column while promoting Development features.

For a safe test target, create a Supabase database branch from Production (this
requires a Pro-or-higher plan), or restore a Production backup into a separate
non-production project. Apply the proposed migration there, run application
tests and Supabase security advisors, then use the Production environment
approval to deploy.

## Recovery rules

- Never use `supabase migration repair` to make a database *look* aligned. It
  changes only the history table, not the schema.
- Never copy Development's migration-history rows into Production.
- If a migration fails in Production, stop and create a new corrective
  migration; do not edit the applied file.
