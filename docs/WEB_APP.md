# QuestLife web application

The web app extends the Expo app in `App/`. It uses the same authentication,
services, validation, providers and Supabase policies as iOS and Android.
The marketing website remains in `Website/`.

## Run and build

From the repository root:

```sh
npm run app:web
npm run app:typecheck
npm run app:build:web
```

For a custom development port: `npm --workspace @questlife/mobile run web -- --port 8091`.
Configure `App/.env` with the Development Supabase project's public URL and
publishable key. Build output is `App/dist/`. Never include a service-role key.
Static hosting must serve `index.html` for application routes such as `/home`,
`/quest/:id`, `/journal` and `/auth/callback`; EAS Hosting supports this SPA mode.

Production exports use the existing EAS production environment:

```sh
cd App
eas env:exec production 'npm run build:web:production'
```

This command requires the production project, disables local dotenv loading,
clears Metro's transform cache and checks the exported bundle's Supabase target.
It does not deploy. Keep the exact callback and reset URLs in the Supabase Auth
allow-list, as described in `SUPABASE_AUTH_URLS.md`.

## Layout and interaction conventions

See `App/AGENTS.md` and `App/lib/responsive.ts` for the shared layout contract.
Phone navigation uses tabs; tablets use a compact rail and desktops a labeled
sidebar. `/home` is the browser Lobby URL. Catalogs reflow into columns,
Journal separates calendar from timeline, and detail/profile/settings surfaces
use bounded panels. Text-heavy pages stay narrower than catalogs.

Web focus, hover and alert behavior lives in `lib/web-bootstrap.web.ts`.
Shared Sheet becomes a centered, bounded dialog at wider sizes with an explicit
close button. Native targets continue to use native maps, files and keychain.

## Browser capabilities

- Quest files and durable image data URLs use IndexedDB. Auth and preferences
  use origin-scoped browser storage. Storage can fail or be cleared by the user;
  it is not a native keychain. Account ownership and cleanup remain enforced by
  the shared lifecycle services.
- GPS recording works while the tab is active. Background location cannot be
  guaranteed by browsers. The web map displays the recorded route and offers a
  link to open its location in OpenStreetMap; it does not embed a tile provider.
- Photo selection uses the browser picker. Camera behavior depends on browser
  and device capabilities. Contacts discovery explains the limitation and keeps
  username search available. QR sharing downloads the profile QR image.
- Sharing uses Web Share when available, then clipboard or an accessible dialog.
  Weekly frequency uses an HTML range input with standard keyboard controls.

## Local visual QA

In a development server only, `/web-preview?surface=explore` renders fixtures with
the real screen components. Other `surface` values include `home`, `journal`,
`quest`, `active-quest`, `saved`, `quest-collections`, `profile`, `social`,
`settings`, `friends`, `notifications`, `streak`, `memory`, `add-friends`,
`share-adventure`, `manage-saved`, `in-progress-quest` and `collection`.
`surface=storage` provides a synthetic IndexedDB draft round-trip/refresh check.
The preview never creates an authenticated backend session; private screens
therefore show signed-out/loading/error states unless they accept fixtures.
Production redirects the QA route to the application entry.

Check at 375, 768, 1024 and 1440px, intermediate widths, short landscape windows
and browser zoom. Inspect rendered bounds, keyboard focus and dialog dismissal.
Authenticated save/upload, social writes, email/OAuth redirects and device
permissions need a dedicated test account and supported real browsers/devices.

### Conversion verification (2026-10-24)

TypeScript and the Expo web export passed. Browser inspection covered 375,
640, 768, 900, 1024 and 1440px widths, plus a 1024×390 landscape window.
Explore reflowed from one to two to three columns without document-level
horizontal overflow; Journal changed from stacked to calendar/timeline panels.
Main screen fixtures and signed-out empty/error states were inspected on phone
and desktop. Search no-results, reachable filter actions in a short dialog,
Escape/focus return, keyboard range controls, browser back/forward, and a
nonempty Unicode IndexedDB draft surviving refresh were exercised.

These are local fixture/signed-out checks, not proof of authenticated backend
journeys. OAuth/email delivery, account-specific writes and uploads, browser
permission grants, browser zoom, and native device builds were not verified.
No production data, DNS, hosting or deployment was changed.
