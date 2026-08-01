# Sentry setup

QuestLife sends diagnostics only. It does not send account emails, passwords,
authentication tokens, user-entered text, photos, precise locations, request
payloads, breadcrumbs, screenshots, session replay, or performance traces.

## Create the projects

In the existing QuestLife Sentry organization, create two **React Native**
projects:

- `questlife-mobile`
- `questlife-admin`

Copy each project DSN to its corresponding application configuration. DSNs are
public ingest identifiers, not secrets. Do not copy any Sentry auth token into
an application or Git.

## Development configuration

Set the appropriate project DSN in the local, ignored environment file:

```dotenv
EXPO_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
EXPO_PUBLIC_APP_ENV=development
```

Leave the DSN blank to disable Sentry for a local run.

## Build and deployment configuration

For future iOS builds, add these to the relevant EAS environment:

- `EXPO_PUBLIC_SENTRY_DSN` — mobile project DSN; visible to the client by design.
- `EXPO_PUBLIC_APP_ENV` — `development`, `preview`, or `production`.
- `SENTRY_ORG` — QuestLife Sentry organization slug.
- `SENTRY_PROJECT` — `questlife-mobile`.
- `SENTRY_AUTH_TOKEN` — protected build secret with release/source-map upload permission.

For the Admin Vercel project, add the Admin DSN and `EXPO_PUBLIC_APP_ENV=development`
to its Development, Preview, and Production environments while it remains on
the Dev database. Add `SENTRY_ORG`, `SENTRY_PROJECT=questlife-admin`, and the
protected `SENTRY_AUTH_TOKEN` only when source-map upload is enabled.

Never set `SENTRY_AUTH_TOKEN` or any Supabase service-role/database credential
as an `EXPO_PUBLIC_*` variable.

## Release check

After a DSN is set, trigger one non-sensitive test error in each application.
Confirm the resulting Sentry event is tagged with the correct `environment` and
`app_surface`, then inspect it for prohibited data before enabling TestFlight.
