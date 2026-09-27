# QuestLife environments

This repository supports three deliberately separate environments. No source
change, migration, or preview deployment may update Production automatically.

| Environment | Purpose | Public hosts | Supabase project |
| --- | --- | --- | --- |
| Local | Daily development using fake data | localhost / Expo development build | Local Supabase, when running it |
| Development | Shared integration testing | Vercel preview or designated dev hosts | QuestLife Dev |
| Production | Real users | `www.myquestlife.app`, `admin.myquestlife.app` | QuestLife Production |

## Domain ownership

- `www.myquestlife.app` is the canonical public Website host.
- `myquestlife.app` redirects permanently to `www.myquestlife.app`.
- `admin.myquestlife.app` is the private Admin host.

The public Website and Admin dashboard remain separate Vercel projects with root
directories `Website` and `Admin`, respectively.

## Local environment files

Copy `App/.env.example` and `Admin/.env.example` to their corresponding `.env`
files. For normal development, configure them with only the **QuestLife Dev**
project URL and publishable key. Those files are ignored by Git.

`EXPO_PUBLIC_*` values are visible in the mobile app or browser. Never put a
Supabase service-role key, database password, Vercel token, or signing secret in
an `.env` file consumed by App, Admin, or Website.

## Vercel environment values

For both Vercel projects, set browser-safe values separately for Preview and
Production:

| Variable | Preview value | Production value |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | QuestLife Dev URL | QuestLife Production URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | QuestLife Dev key | QuestLife Production key |
| `EXPO_PUBLIC_APP_ENV` | `preview` | `production` |
| `EXPO_PUBLIC_SENTRY_DSN` | Development DSN, if enabled | Production DSN, if enabled |

The Website currently has no browser-side Supabase client, so do not add these
values to the Website project until a page actually needs them.

## Database and function workflow

`supabase/migrations/` is the sole migration history. `Database/migrations/` is
legacy reference material and must never receive new files.

1. Create a migration with the Supabase CLI in `supabase/migrations/`.
2. Test it against local Supabase and commit the migration with the matching app
   and admin code.
3. Apply the committed migration to QuestLife Dev; test the full feature there.
4. Review and approve the release.
5. Back up QuestLife Production, then apply the exact committed migration to it.
6. Deploy changed Edge Functions separately and verify production.

Applying a migration to QuestLife Dev never changes QuestLife Production.

## Pre-production compatibility rule

Deploy database changes before app code that depends on them. Make migrations
backward-compatible whenever an existing App Store build could still be running.
Do not remove a database field, RPC, or policy until all supported mobile builds
no longer require it.
