# QuestLife Admin Dashboard PRD

## 1. Overview

QuestLife needs a private web-based admin dashboard where trusted operators can manage the content and operational data that power the mobile app. The dashboard will live as a separate frontend from the App Store app, but it will use the same backend and database.

The first version should focus on making quests manageable outside the codebase. Today, quest data exists locally in `data/questlife.ts`; the admin dashboard should move quest creation, editing, publishing, and basic analytics into a secure backend-driven workflow.

## 2. Goals

- Allow admins to log in securely from a web dashboard.
- Allow admins to create, edit, publish, archive, and review quests.
- Store quest records in the shared backend so the mobile app can fetch live quest data.
- Provide basic analytics for quest performance and user engagement.
- Establish role-based permissions so only admins can perform admin actions.
- Keep the admin dashboard separate from the mobile app deployment and App Store review process.

## 3. Non-Goals

- The admin dashboard is not part of the mobile app.
- The admin dashboard is not a public marketing website.
- The first version does not need complex revenue analytics, ad tracking, or deep behavioral funnels.
- The first version does not need a fully custom CMS if the internal dashboard can cover the required quest workflow.
- The first version does not need multi-tenant organization support.

## 4. Product Architecture

Recommended structure:

```text
QuestLifeProject/
  App/       # Expo mobile app submitted to the App Store
  Admin/     # Private admin dashboard web app
  Website/   # Public homepage, privacy policy, terms, and support
  Database/  # Supabase schema and policy migrations
  Shared/    # Shared types, schemas, validation, constants
  docs/      # Product and setup notes
```

The important principle is that the mobile app and admin dashboard are separate clients of the same backend.

```text
Admin Dashboard
  creates and publishes quests
        |
        v
Shared Supabase Backend
  quests, profiles, roles, progress, analytics
        ^
        |
Mobile App
  displays quests and records user activity
```

## 5. Users and Roles

### Admin

Admins manage QuestLife content and operations.

Required permissions:

- Log in to the admin dashboard.
- Create draft quests.
- Edit draft and published quests.
- Publish quests.
- Archive quests.
- View basic analytics.
- View basic user/profile records.

### Super Admin

Super admins manage other admins and higher-risk settings.

Required permissions:

- Everything Admins can do.
- Invite or remove admins.
- Change admin roles.
- Access audit logs.
- Manage dangerous actions like permanent deletion, if deletion is ever allowed.

### Mobile User

Mobile users use the QuestLife app.

Required permissions:

- View published quests.
- Save quests.
- Complete quests.
- Track personal progress.
- Manage their own profile.

Mobile users must not be able to create, edit, publish, or archive quests.

## 6. MVP Scope

### 6.1 Admin Authentication

Admins should sign in through Supabase Auth.

MVP requirements:

- Email/password login.
- Password reset.
- Admin-only access gate.
- Redirect non-admin users away from the dashboard.
- Clear error states for invalid login, missing admin role, and expired session.

Backend requirements:

- Add a role field or admin membership table.
- Enforce admin access with database row-level security policies and/or server-side checks.
- Do not rely only on frontend route protection.

Recommended model:

```sql
admin_memberships
- user_id uuid references auth.users(id)
- role text check role in ('admin', 'super_admin')
- created_at timestamptz
- created_by uuid
```

### 6.2 Dashboard Home

The dashboard home should give admins a quick operational snapshot.

MVP cards:

- Total published quests.
- Draft quests.
- Archived quests.
- Active users.
- Quest completions in the last 7 days.
- Top performing quests.

MVP actions:

- Create quest.
- View all quests.
- Review recent activity.

### 6.3 Quest Management

This is the core MVP feature.

Admins need to create and manage quests with fields matching or extending the current mobile quest model.

Current quest fields from the app:

- `id`
- `title`
- `shortDesc`
- `fullDesc`
- `xp`
- `timeMin`
- `timeLabel`
- `difficulty`
- `category`
- `saved`
- `featured`
- `color`

Recommended backend quest fields:

```text
id
title
short_description
full_description
xp
estimated_minutes
difficulty
category
featured
status
accent_color
created_at
updated_at
published_at
archived_at
created_by
updated_by
```

Quest statuses:

- `draft`
- `published`
- `archived`

MVP quest list requirements:

- Search by title.
- Filter by status.
- Filter by category.
- Filter by difficulty.
- Sort by recently updated, highest XP, lowest XP, shortest, longest.
- Show title, status, category, difficulty, XP, estimated time, featured state, and last updated.

MVP quest editor requirements:

- Create new quest.
- Edit existing quest.
- Save as draft.
- Publish.
- Archive.
- Mark as featured.
- Validate required fields before publishing.
- Preview how the quest will appear in the mobile app.

Publishing requirements:

- Published quests become visible in the mobile app.
- Draft and archived quests are hidden from normal mobile users.
- Admins can still view all statuses in the dashboard.

### 6.4 Collections

Collections can be included after basic quest CRUD is stable.

Current collection fields from the app:

- `id`
- `title`
- `subtitle`
- `timeRange`
- `questCount`
- `color`
- `bgColor`
- `emoji`
- `questIds`

MVP collection requirements:

- Create collection.
- Add and remove quests from collection.
- Reorder quests inside collection.
- Publish or archive collection.
- Show collection in the mobile app only when published.

This can be Phase 2 if quest management needs to ship first.

### 6.5 Analytics

The first analytics view should be simple and operational.

MVP metrics:

- Total users.
- New users over time.
- Quest views.
- Quest saves.
- Quest starts.
- Quest completions.
- Completion rate per quest.
- Most saved quests.
- Most completed quests.

Useful filters:

- Date range.
- Quest category.
- Difficulty.
- Featured vs non-featured.

Implementation note:

Analytics requires the mobile app to write events to the backend. If this does not exist yet, the first version of analytics can start with database-derived metrics such as completed quests and saved quests once those tables exist.

### 6.6 User Management

MVP user management should be read-heavy.

MVP requirements:

- View user list.
- Search by email or display name.
- View profile details.
- View user XP, streak, saved quest count, and completed quest count once those fields exist.
- No account deletion in MVP unless required.

Admin actions that affect users should be treated carefully and added later.

### 6.7 Audit Log

Admin actions should be auditable.

MVP audit events:

- Admin logged in.
- Quest created.
- Quest edited.
- Quest published.
- Quest archived.
- Admin role granted.
- Admin role removed.

Audit log fields:

```text
id
actor_user_id
action
target_type
target_id
metadata
created_at
```

## 7. Data Model Requirements

Minimum new tables:

```text
admin_memberships
quests
quest_collections
quest_collection_items
admin_audit_log
```

Likely future tables:

```text
saved_quests
quest_completions
quest_events
user_xp_events
user_streaks
```

The mobile app should eventually stop importing static quest arrays from `data/questlife.ts` and instead fetch published quests from Supabase.

## 8. Security Requirements

- All admin routes require authentication.
- All admin data writes require admin role checks.
- Supabase Row Level Security should be enabled for admin-managed tables.
- Mobile users can only read published quests.
- Mobile users cannot read draft or archived quests.
- Mobile users cannot write to quest definition tables.
- Admin role assignment should be restricted to super admins or manual database setup during MVP.
- Sensitive backend keys must never be exposed in the frontend.

Recommended policy principle:

```text
Public/mobile read access:
  published quests only

Authenticated user write access:
  own profile/progress only

Admin write access:
  quest and collection management

Super admin access:
  admin membership management
```

## 9. Deployment and Domains

Recommended domains:

```text
questlife.app or questlife.com       # marketing site, support, privacy policy
admin.questlife.app                  # private admin dashboard
api.questlife.app                    # optional API layer if added later
```

The mobile app is distributed through the App Store and uses the shared backend. The admin dashboard is deployed as a web app and is not included in the App Store build.

This means:

- App Store review focuses on the mobile app.
- Admin dashboard can be updated independently.
- Quest content can be changed without shipping a new mobile app version.
- Privacy policy, terms, and support pages should still be available publicly for App Store submission.

## 10. Recommended Tech Approach

Given the current app uses Expo, React, TypeScript, and Supabase, the admin dashboard should likely use:

- React or Next.js for the admin web app.
- Supabase Auth for login.
- Supabase database for quests, collections, admin roles, and analytics.
- Shared TypeScript schemas for quest validation.
- A charting library for basic analytics.

For the first implementation, a simple React/Vite or Next.js dashboard is enough. Next.js becomes more useful if server-side admin checks, API routes, or protected server actions become important.

## 11. MVP User Stories

- As an admin, I can log in to the dashboard so I can manage QuestLife content.
- As an admin, I can create a draft quest so I can prepare content before users see it.
- As an admin, I can preview a quest so I know how it will appear in the mobile app.
- As an admin, I can publish a quest so mobile users can access it.
- As an admin, I can archive a quest so it no longer appears in the mobile app.
- As an admin, I can view all quests so I can understand what content exists.
- As an admin, I can filter quests by category, status, and difficulty so I can manage content efficiently.
- As an admin, I can view basic quest analytics so I know which quests perform well.
- As a mobile user, I can only see published quests.
- As a mobile user, I cannot access admin routes or admin data.

## 12. MVP Acceptance Criteria

### Authentication

- Admin dashboard blocks unauthenticated users.
- Authenticated non-admin users cannot access dashboard data.
- Admin users can log in and log out.

### Quest Management

- Admin can create a quest draft.
- Admin can edit a quest.
- Admin can publish a quest.
- Admin can archive a quest.
- Published quests are readable by the mobile app.
- Draft and archived quests are not readable by normal mobile users.
- Required fields are validated before publishing.

### Analytics

- Admin can view at least one dashboard page with core metrics.
- Quest performance is visible at the individual quest level when event/completion data exists.

### Security

- Database policies prevent non-admin quest writes.
- Database policies prevent mobile users from reading unpublished quests.
- Admin actions are logged.

## 13. Phased Roadmap

### Phase 1: Foundation

- Create admin dashboard app folder.
- Add admin auth flow.
- Add admin membership table.
- Add quests table.
- Add RLS policies.
- Add quest CRUD screens.
- Update mobile app to fetch published quests from Supabase.

### Phase 2: Publishing Workflow

- Add quest preview.
- Add publish/archive workflow.
- Add validation schema.
- Add audit log.
- Add featured quest management.

### Phase 3: Analytics

- Add mobile event tracking.
- Add dashboard overview metrics.
- Add per-quest analytics.
- Add date filtering.

### Phase 4: Collections and User Management

- Add collection CRUD.
- Add user search and detail view.
- Add richer content organization tools.

### Phase 5: Admin Operations

- Add admin invites.
- Add super admin controls.
- Add export/reporting tools.
- Add moderation or review workflows if needed.

## 14. Open Questions

- Should admins be created manually in Supabase for MVP, or should super admins invite them from the dashboard?
- Should the admin dashboard use Next.js, Vite, or another web stack?
- Should quest images/media be required in the first version?
- Should quests support location, recurrence, expiration dates, or proof-of-completion?
- Should analytics be built from Supabase tables only, or should an external analytics tool be added later?
- Should admins be able to permanently delete quests, or should all removed content be archived?
- What domain will be used: `questlife.app`, `questlife.com`, or another domain?

## 15. Implementation Notes

- Keep the admin dashboard separate from the App Store app, but backed by the same Supabase project.
- Do not expose service-role keys to the admin frontend.
- Prefer shared schemas for quest validation so the admin dashboard and mobile app agree on quest shape.
- Treat `data/questlife.ts` as seed/reference data once the backend quest table exists.
- Build the dashboard around operational workflows, not marketing pages.
