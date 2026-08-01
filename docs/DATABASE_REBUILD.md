# QuestLife database rebuild plan

## Purpose

QuestLife will start with a new Supabase organization and fresh Dev/Production
projects. No user or production data will be copied. The goal is a reproducible,
secure database foundation that the repository can build consistently.

## Current audit

- The current schema contains roughly 52 application tables, 170 `SECURITY DEFINER`
  function definitions, and 62 explicitly-created indexes.
- The repository has two migration histories: `Database/migrations/` contains the
  original base schema, while `supabase/migrations/` contains later feature work.
- The linked database migration history has timestamp drift from the repository.
  The remote-only entries have matching feature names to repository files, but
  different versions. Do not repair or replay that old history.
- Supabase advisors found 58 foreign keys without covering indexes, three RLS
  policies that repeatedly evaluate `auth.uid()`, one duplicate party-feed index,
  and anonymous access to 66 `SECURITY DEFINER` functions.

## New source of truth

Before a new project receives a schema:

1. Consolidate the original base migrations and later feature migrations into one
   ordered, timestamped `supabase/migrations/` sequence.
2. Keep `Database/migrations/` as a read-only legacy record during the Dev
   validation. Its original base migrations are mirrored in the canonical sequence;
   the later legacy files are already represented there and are not replayed.
3. Apply the consolidated sequence to a new **Dev** project first and validate it.
4. Apply the identical, validated sequence to the new **Production** project.
5. After that, every schema change is one new immutable migration in
   `supabase/migrations/` and is applied Dev first, then Production.

## Required environment layout

Create the new projects in the same Supabase organization and region:

| Environment | Purpose | Connected clients |
| --- | --- | --- |
| Dev | Daily local App/Admin development and migration validation | local `.env` files only |
| Production | TestFlight release candidates and real users | EAS production build and Vercel Admin production environment |

Use Dev for all ordinary development. Do not point local `.env` files at
Production. A TestFlight build should use Dev until the app is ready to test its
production release configuration.

## Security and performance work for the clean schema

### Must fix before external testing

- Revoke `anon` execution from every `SECURITY DEFINER` function, then grant only
  the small, explicitly-reviewed public registration/read functions that need it.
- Review every authenticated `SECURITY DEFINER` RPC for an internal `auth.uid()` or
  admin authorization check before granting execution.
- Enable leaked-password protection in the new project's Supabase Auth settings.
- Keep RLS enabled on all public tables. The three tables with RLS and no direct
  policies (`app_announcement_dismissals`, `quest_engine_settings`, and
  `streak_recoveries`) must remain inaccessible except through reviewed RPCs.

### Performance improvements

- Replace direct `auth.uid()` calls in the active-quest media, route-point, and
  snapshot RLS policies with `(select auth.uid())` so the value is evaluated once
  per query.
- Remove the duplicate `party_feed_posts` index, keeping only the index that covers
  `(party_id, created_at desc)`.
- The baseline adds the required reverse-direction profile-follow index. Add other
  foreign-key indexes only after measuring the actual Dev query with
  `EXPLAIN (ANALYZE, BUFFERS)`; automatic "index every foreign key" advice can make
  a write-heavy mobile product slower and more expensive.
- Verify each index with `EXPLAIN (ANALYZE, BUFFERS)` in Dev before treating it as
  part of the production baseline. Do not blindly add all 58 advisor suggestions:
  indexes improve reads but add storage and write overhead.

### Storage and egress

The current app already compresses feed images, but every upload path must be
checked for a fixed maximum dimension and JPEG/WebP compression. Use long cache
headers only for immutable, versioned object paths; use signed URLs for private
media. Do not send full-resolution images through feed/list screens.

## Deletion and recreation order

1. Commit the consolidated migration baseline and database hardening changes.
2. Delete the old Supabase organization and projects.
3. Create only the new **QuestLife Dev** project first.
4. Link the repository to Dev, apply the baseline, run advisors, and test App/Admin.
5. Create **QuestLife Production**, apply the same verified baseline, and configure
   its secrets and Auth/Storage settings.
6. Point local App/Admin to Dev. Point Vercel and production EAS builds to
   Production only when ready.

Never reuse old project URLs, publishable keys, service-role keys, storage URLs, or
OAuth redirect settings after creating the new projects.
