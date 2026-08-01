# Database migration policy

## Source of truth

`supabase/migrations/` is the only location for new QuestLife database migrations.
Each migration is immutable once it has been applied to a shared environment.

`Database/migrations/` is a legacy snapshot of earlier setup work. Its original
base migrations (`001` through `017`, including both historical `013` files) are
mirrored in `supabase/migrations/` with ordered `20260601...` timestamps so a new
project has one complete baseline. The later `018` through `027` files are already
represented by the timestamped files in `supabase/migrations/` and must not be
replayed a second time. Do not add files to the legacy folder; retain it read-only
until the new Dev project has validated the baseline.

## Creating a migration

1. Start from an up-to-date local branch.
2. Create one timestamped migration in `supabase/migrations/` with the Supabase CLI.
3. Put both schema changes and their required RLS policies in that migration.
4. Test the migration against the development database.
5. Review it in a pull request before applying it to staging or production.

Never edit or reorder an applied migration. Add a corrective migration instead.

## Environments

On the current Free plan, maintain separate **Dev** and **Production** projects.
Apply migrations to Dev first, validate them, then apply the identical committed
migration to Production manually. Add a third staging project only after moving to
a plan that supports it comfortably; it belongs between Dev and Production.
Production changes must be reviewed and backed up according to the release runbook.

## Access and secrets

Client apps may use only the Supabase URL and publishable/anon key. Service-role keys
belong only in Supabase Edge Function secrets or another server-side secret store;
they must never be committed, exposed through `EXPO_PUBLIC_*`, or placed in Vercel
browser environment variables.
