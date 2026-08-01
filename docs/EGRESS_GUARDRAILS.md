# Supabase Free-plan egress guardrails

QuestLife runs on Supabase's Free plan with a 5 GB monthly egress allowance.
Egress is mostly data downloaded by users: image files, database/API responses,
and signed/public Storage URLs. Database migrations and schema checks do not
meaningfully consume that allowance.

## Controls in the app

- All user-uploaded quest, party, journal, collection-cover, and profile images
  are converted to a display-sized JPEG before upload.
- Immutable storage paths use a one-year cache header, so repeat views are served
  from the device/CDN cache where available.
- Journal and party media stay private and are exposed by short-lived signed URLs.
- The app never copies old project data or storage into Dev/Production.

## Owner routine

Check **Supabase Dashboard → Organization → Usage** once each week during testing.

| Usage this billing month | Action |
| --- | --- |
| Under 3 GB | Normal testing. |
| 3–4 GB | Avoid repeatedly browsing feeds with large image collections; inspect the Storage usage view. |
| Over 4 GB | Pause broad external testing, identify high-download screens/buckets, and reduce image sizes or tester activity before the reset date. |

Do not use the database password, service-role key, or a storage service key in
the mobile app. The mobile app uses only the Supabase URL and publishable key.
