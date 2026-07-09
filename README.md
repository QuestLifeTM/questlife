# QuestLife Project Structure

```text
QuestLifeProject/
|-- App/       # Expo mobile app submitted to the App Store
|-- Admin/     # Private web admin dashboard
|-- Website/   # Public homepage, privacy policy, terms, and support
|-- Database/  # Supabase migrations and backend schema
|-- Shared/    # Shared types/helpers for App and Admin
|-- docs/      # Product and setup notes
```

Run the mobile app:

```bash
npm run app
```

Run the admin dashboard:

```bash
npm run admin
```

For App Store submission, build from `App/`. Do not submit `Admin/` or `Website/` to Apple.
