# QuestLife

QuestLife is a single repository containing the mobile app, private admin dashboard,
public website, and Supabase backend. This is an intentional monorepo: each product
can deploy independently while shared product and backend changes stay coordinated.

```text
QuestLifeProject/
|-- App/        # Expo mobile app for iOS and Android
|-- Admin/      # Private web admin dashboard (Vercel)
|-- Website/    # Public marketing, legal, and support site (Vercel)
|-- Shared/     # Future shared types, schemas, and helpers
|-- supabase/   # Authoritative database migrations and Edge Functions
|-- docs/       # Architecture and operating documentation
|-- .github/    # Automated repository checks
```

`Database/migrations/` is legacy reference material. New database migrations belong
only in `supabase/migrations/`; see [the migration policy](docs/MIGRATION_POLICY.md)
before changing the database.

Run the mobile app:

```bash
npm run app
```

Run the admin dashboard:

```bash
npm run admin
```

Run the responsive browser app with `npm run app:web` and build it locally with
`npm run app:build:web`. See [the web app guide](docs/WEB_APP.md) for layout
conventions, browser capabilities, local visual QA and environment validation.

For App Store submission, build from `App/`. Do not submit `Admin/` or `Website/` to Apple.

## Deployments

- **Mobile and web app:** build and submit the native app with EAS from `App/`.
  Export and deploy the phone-width browser app with `eas deploy --prod` from
  `App/`; its production host is `app.myquestlife.app`. The `development`,
  `preview`, and `production` profiles are defined in `App/eas.json`.
- **Admin:** deploy `Admin/` as its own Vercel project.
- **Website:** deploy `Website/` as its own Vercel project after the public site is
  implemented.

See [the release runbook](docs/RELEASES.md) for the expected release process and
environment setup.
