# Database migration policy

## Source of truth

`supabase/migrations/` is the only location for new QuestLife database migrations.
Each migration is immutable once it has been applied to a shared environment.

`Database/migrations/` is a legacy snapshot of earlier setup work. Do not add files
there and do not delete it until the production Supabase migration history has been
reviewed and the archive is no longer needed.

## Creating a migration

1. Start from an up-to-date local branch.
2. Create one timestamped migration in `supabase/migrations/` with the Supabase CLI.
3. Put both schema changes and their required RLS policies in that migration.
4. Test the migration against the development database.
5. Review it in a pull request before applying it to staging or production.

Never edit or reorder an applied migration. Add a corrective migration instead.

## Environments

Maintain separate Supabase projects for development, staging, and production. Apply
migrations in that order: development, staging, then production. Production changes
must be reviewed and backed up according to the release runbook.

## Access and secrets

Client apps may use only the Supabase URL and publishable/anon key. Service-role keys
belong only in Supabase Edge Function secrets or another server-side secret store;
they must never be committed, exposed through `EXPO_PUBLIC_*`, or placed in Vercel
browser environment variables.
