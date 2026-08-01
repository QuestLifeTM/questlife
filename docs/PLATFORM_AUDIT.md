# Platform audit

Audit date: 2026-08-01

This document records the deployment baseline before TestFlight preparation. It
contains no credentials or secret values.

## Repository

- Repository: `QuestLifeTM/questlife`
- Default branch: `main`
- Current local branch for the company-release foundation work:
  `codex/company-release-foundation`
- Automated check: the repository runs mobile and admin TypeScript checks on pull
  requests and pushes to `main`.

### Required owner action

The repository is public and `main` has no GitHub branch-protection rule. Before
inviting collaborators or beginning external testing, an organization owner must:

1. Decide whether the repository should be private. A private repository is the
   recommended setting for QuestLife application and backend source code.
2. Protect `main`: require a pull request and the **Typecheck** GitHub check; block
   force pushes and direct pushes.

## Vercel

Known deployments:

- `admin.myquestlife.app` serves the private Admin application.
- A separate `questlife` Vercel project exists for the future public site.

No Vercel deployment setting was modified during this audit. Keep Git integration
enabled for previews, but promote or deploy production manually until release
automation has been deliberately approved.

## Expo and iOS

- The mobile app has an existing EAS project reference in `App/app.json`.
- `App/eas.json` already separates development, preview, and production builds and
  uses EAS remote build-version management with production auto-increment.
- The current Expo accounts inspected do not show that EAS project, so its owner
  needs to be identified before changing Expo organization ownership or credentials.
- The iOS bundle identifier is `com.questlife.app`; keep it unchanged when creating
  the matching App Store Connect record.

Do not create a second Expo project merely to organize the company account. Keep or
transfer the existing EAS project so current build history and credentials remain
connected.

## Supabase

The Supabase organization already has these projects:

| Environment | Project | Status | Region |
| --- | --- | --- | --- |
| Production | QuestLife Production | Active | us-east-1 |
| Development | QuestLife Dev | Inactive | us-west-2 |

The repository is currently linked to Production, and both local App and Admin
environment files currently reference Production. Do not run experimental migration,
storage, or data changes until local development has moved to QuestLife Dev.

`supabase/migrations/` is the authoritative migration history. The generated
`supabase/.temp/` link-state directory is intentionally ignored and must not be
committed because it can silently point a teammate's CLI at the wrong project.

### Required owner action

Open Supabase and review why **QuestLife Dev** is inactive. Reactivate it or create a
replacement development project before changing the local `.env` files. Keep the
existing production project intact; it is the correct future target, not something
to reset.

## Observability

- Sentry is not yet installed in the mobile or admin codebase.
- PostHog is not yet installed in the mobile or admin codebase.

Install and configure Sentry before the first TestFlight build. Add PostHog after a
small event plan is agreed, beginning with sign-up completion, quest start, quest
completion, and key retention actions. Do not send email addresses, exact location
history, user-generated photos, or Supabase tokens to analytics.
