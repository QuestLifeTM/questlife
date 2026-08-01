# Supabase Auth URL configuration

Apply these values in **QuestLife Dev** only, after the Website Vercel production
deployment is live on `myquestlife.app`:

- **Site URL:** `https://myquestlife.app`
- **Redirect URLs:**
  - `https://myquestlife.app/auth/callback`
  - `https://myquestlife.app/auth/reset-password`
  - `questlife://auth/callback`
  - `questlife://reset-password`

Keep email confirmation enabled and leaked-password protection enabled.

The HTTPS routes display a branded confirmation/reset page. They remove the
one-time code from browser history and only forward it to the installed
QuestLife app through its `questlife://` deep link.
