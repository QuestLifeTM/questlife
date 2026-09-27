# Supabase Auth URL configuration

## Production

QuestLife's canonical public host is `https://www.myquestlife.app`. Configure
`https://myquestlife.app` to redirect to it at Vercel/domain level.

In **QuestLife Production** → Authentication → URL Configuration, set:

- **Site URL:** `https://www.myquestlife.app`
- **Redirect URLs:**
  - `https://www.myquestlife.app/auth/callback`
  - `https://www.myquestlife.app/auth/reset-password`
  - `https://admin.myquestlife.app/auth/callback`
  - `https://admin.myquestlife.app/reset-password`
  - `questlife://auth/callback`
  - `questlife://reset-password`

Do not add broad wildcards to the production allow-list. A redirect URL is a
security boundary for password-reset and account-confirmation links.

Keep email confirmation and leaked-password protection enabled. See
[`SUPABASE_AUTH_SECURITY.md`](SUPABASE_AUTH_SECURITY.md) for the remaining
production dashboard settings.

The public HTTPS routes display a branded handoff page and forward the one-time
code to the installed mobile app through its `questlife://` deep link.

## Development

Use the same paths on the development website host and the development admin
host. Add local development URLs only when they are in active use, for example:

- `http://localhost:8081/auth/callback`
- `http://localhost:8081/auth/reset-password`

Keep development and production Supabase projects separate. Never use the
production URL or publishable key in local `.env` files.
