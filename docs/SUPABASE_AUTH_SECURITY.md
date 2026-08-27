# Supabase Auth production security checklist

The app now uses PKCE, native secure storage, exact deep links, generic
sign-up/reset responses, and a dedicated recovery-session check before a
password can be changed. Apply the following in the **QuestLife production
project** before release; these settings are intentionally not stored in the
client repository.

## Required dashboard configuration

1. In **Authentication > URL Configuration**, use the exact Site URL and
   redirect allow-list in [`SUPABASE_AUTH_URLS.md`](SUPABASE_AUTH_URLS.md).
   Do not use wildcard production redirects.
2. In **Authentication > Providers**, enable only the providers in use:
   Email, Google, and Apple. Register Supabase's provider callback URL with
   Google and Apple, and keep the Apple signing key in the provider dashboard,
   never in this repository. Use native Sign in with Apple for the iOS build
   when it is enabled.
3. In **Authentication > Password Security**, require a 12-character password
   with uppercase, lowercase, number, and symbol, and enable leaked-password
   protection. The client mirrors these rules, but the dashboard is the server
   enforcement point.
4. In **Authentication > Bot and Abuse Protection**, enable Cloudflare
   Turnstile or hCaptcha. Adding it requires the provider site key in the app
   and passing its token on sign-up, sign-in, and password-reset requests.
5. In **Authentication > Rate Limits**, set production limits appropriate for
   expected traffic and monitor 429 responses. Configure custom SMTP before
   increasing email volume; the built-in email sender is intentionally limited.
6. In **Authentication > Sessions**, retain a one-hour JWT lifetime and set a
   maximum session lifetime plus inactivity timeout appropriate to the product.
   Enable refresh-token reuse detection. Do not force a single session unless
   that product trade-off is intentional.
7. Restrict dashboard/team access with MFA and least-privilege roles; rotate
   the Apple key every six months if the web OAuth Apple flow remains enabled.

## Database and Edge Functions

- Apply migration `20260825010517_auth_security_hardening.sql`. It revokes the
  unauthenticated RPCs that could reveal account or username existence.
- Run the Supabase Database Linter and Security Advisors after the migration,
  then resolve every RLS/function warning before production release.
- Keep the service-role key only in Supabase Edge Function secrets. It must
  never appear in the Expo app, website, or a public environment variable.
- Review Edge Function logs for authentication failures and rate-limit events;
  the account-deletion function now returns a generic server error rather than
  leaking internal details.

## Verification checklist

- Test new email sign-up, existing-email sign-up, unverified email sign-in,
  Google, Apple, password reset, expired reset link, and cancelled OAuth.
- Verify that an unauthenticated user cannot call
  `get_public_account_registration_state` or `is_username_available` after
  the migration.
- Confirm that the redirect pages work only over HTTPS and that the one-time
  code disappears from browser history after the page loads.
