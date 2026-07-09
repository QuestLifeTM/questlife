# QuestLife Admin Dashboard Setup

## Run Locally

From the project root:

```bash
cd /Users/jabiullah/Documents/QuestLifeProject
```

Run the mobile app:

```bash
npm run app
```

Run the web admin dashboard:

```bash
npm run admin
```

Open the admin pages:

```text
http://localhost:8081/admin/quests
http://localhost:8081/admin/adventure-packs
```

If both projects are running at the same time, Expo may choose a different port for the second project. Use the URL printed in that terminal.

## Supabase Environment

The app needs these values in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

## Supabase Migrations

Run these files in Supabase SQL editor in order:

```text
Database/migrations/001_create_profiles.sql
Database/migrations/002_create_profile_after_email_confirmation.sql
Database/migrations/003_create_quest_content.sql
Database/migrations/004_add_quest_review_workflow.sql
Database/migrations/005_admin_permissions_invites_inbox.sql
```

The third migration creates:

- `admin_memberships`
- `quests`
- `adventure_packs`
- `adventure_pack_quests`
- `saved_quests`
- `quest_completions`
- `admin_audit_log`

It also enables row level security so normal app users can read only published quests and Adventure Packs, while admins can create and manage content.

The fourth migration adds the admin review workflow for quests:

- `in_review` quest status
- quest `steps`
- review notes and reviewer metadata
- admin read access for profile labels used in the dashboard

The fifth migration adds the super-admin/admin permission model:

- `admin_memberships.permissions`
- `admin_invites`
- `admin_notifications`
- email-first admin login RPCs
- draft deletion policy for admins
- server-side guards so only the super admin can publish or archive quests

## Create First Admin

First register and confirm an account in the app. Then find the user id:

```sql
select id, email
from auth.users
order by created_at desc;
```

Grant first super admin access:

```sql
insert into public.admin_memberships (user_id, role, permissions)
values (
  'YOUR_USER_ID_HERE',
  'super_admin',
  array[
    'quests.view_published',
    'quests.view_all',
    'quests.create_draft',
    'quests.submit_review',
    'quests.review_publish',
    'admins.manage',
    'profile.manage',
    'inbox.view'
  ]
)
on conflict (user_id) do update
set role = excluded.role,
    permissions = excluded.permissions;
```

After this, log in with the same account and open:

```text
http://localhost:8081/admin/quests
```

From there, use `/admin/admins` to invite other admins by email and choose their permissions. Invited users become regular admins only. The super admin account is seeded manually in Supabase and is not granted from the dashboard. Invited admins enter their email first on the admin login page; if their invite is pending, the dashboard asks them to create a password.

## Publishing Rules

- `draft` quests and Adventure Packs are visible only to admins.
- `draft` quests can move to review or be deleted.
- Only `published` quests can be archived.
- Publishing happens from the super-admin Review screen, not from draft/detail editing.
- `published` quests and Adventure Packs appear in the mobile app.
- `archived` quests and Adventure Packs are hidden from normal app users.
- Adventure Packs can contain draft quests in admin, but only published content should be used for production packs.

## Verification

These checks should pass after local changes:

```bash
npm run app:typecheck
npm run admin:typecheck
```
