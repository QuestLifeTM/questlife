# QuestLife responsive app conventions

- App/ is one Expo application for iOS, Android, and web. Reuse its services,
  providers, validation and Supabase RLS; do not create a second web backend.
- Every UI change includes phone, tablet and desktop behavior. Use
  `useResponsiveScreenLayout` and `useAppViewport` from `lib/responsive.ts`.
  The viewport excludes web navigation; do not size content from global screen
  width or add a fixed phone frame. Keep native behavior behind Platform checks.
- At 720px web navigation becomes an 80px rail; at 1120px it becomes a 232px
  sidebar. Content uses 760px reading, 960px detail or 1200px catalog limits.
  Catalog columns change when the available content reaches 680px / 1060px.
  Preserve readable prose and minimum 44px touch targets at all widths.
- Use file routes and Link for navigation. Detail back buttons must fall back
  to a valid route after a direct link. Keep browser tab titles meaningful.
- Native file/keychain operations go through `lib/device-files` and
  `lib/device-storage`; web implementations use IndexedDB and origin storage.
  Never persist blob URLs. Handle storage errors visibly when saving user work.
- Use shared Screen, Sheet and auth scaffolds. Sheets become bounded dialogs on
  wide browsers. Inputs need labels; icon actions need accessible names; all
  actions must work with keyboard, mouse and touch. Web alerts use HTML dialog.
- Verify 375, 768, 1024 and 1440px, intermediate widths, short landscape windows,
  keyboard focus, empty/error/loading states, refresh and back/forward. Run
  `npm run app:typecheck` and `npm run app:build:web` from the repository root.
- Never deploy as part of a UI change unless asked. Local/preview use Development
  Supabase. Production builds must use the production environment and a clean
  Metro cache; verify the embedded project URL before publishing.
