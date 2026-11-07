# Tuta · Moon Mood

Shared React Native / Expo application for iOS and Android, implementing the approved Moon Mood design. The Next.js website remains separate.

## Run

```sh
cd /Users/keta/Desktop/TuTa/mobile
npm ci
npm start
```

Scan the QR code using a compatible Expo Go client, or use `npm run ios` / `npm run android` with the platform simulator installed. SDK 57 requires a compatible client. `npm run web` opens the same React Native UI in the browser for review.

## Included

- Georgian and English interface, bundled fonts, shared moon/floral artwork.
- First-run setup with actual user inputs, no fabricated personal cycle data.
- Community-first home. Posts and comments are visible only to signed-in, non-anonymous members; members can write up to 200 words and attach one photo.
- Signed Cloudinary uploads keep the API secret on the website server. The mobile app only receives a short-lived signature.
- A dedicated My Cycle view retains cycle day, estimated phase, week strip, next period and direct daily check-in.
- The top-right sign-in/account button and full-screen menu open About, Health Library, Premium, Privacy and tracker sections.
- Month calendar with recorded versus predicted days, check-in editing, and period add/edit/remove with confirmation.
- Daily journal with mood, energy, pain, flow, searchable symptoms, custom symptoms and notes.
- Previous-day journal editing from calendar and saved state across restarts.
- Period start history, average after 3 completed cycles, six estimates and irregularity flags.
- Same-phase symptom patterns are shown only after they recur in at least three completed cycles.
- Local storage, unsaved journal warning, explicit health-data export warning, and confirmed local-data deletion.
- Supabase email/password registration, sign-in, sign-out, email confirmation and in-app password recovery (once the Auth redirect URL is allowlisted).
- Registration asks for email (the sign-in username), first name, last name, date of birth, password, and matching password confirmation. Profile details are saved in Supabase Auth user metadata.
- Community posts require one topic, have a 200-word limit, and may include one photo. Readers can filter by topic and comment. Comments show a member's nickname or first name, never their email. A doctor label and verification mark appear only for accounts present in the admin-managed `verified_doctors` table. Post authors can edit their text/topic or delete their post; deleting also removes its comments. The community migration in `../supabase/migrations/` must be applied to the Tuta Supabase project before these features work online. A post's existing photo cannot yet be replaced while editing.
- Premium doctor messaging is visibly unavailable until authenticated subscriptions and a real service exist. No local switch pretends to authorize paid access.

## Verify

```sh
npm run typecheck
npm test
npx expo export --platform all
```

## Native projects

The shared app source is here in `mobile/`. Native Xcode and Gradle projects are generated in `mobile/ios/` and `mobile/android/`. Regenerate them with `npx expo prebuild` **from this directory**; they are ignored by Git because they are reproducible from app configuration. To open the iOS app in Xcode, open `mobile/ios/Tuta.xcodeproj`. Do not manually duplicate the shared app source.

Native archive/signing and store release need Xcode / Android tooling and developer accounts. Browser exports verify shared UI, not simulator or device execution.

## Data and scope

Cycle and journal records are stored in the Supabase `health_state` table, scoped to the signed-in user by RLS. Mobile and website read the same account record, subscribe to changes, and refresh on foreground/focus. New health records are never saved in AsyncStorage/localStorage. The old `tuta.mobile.v1` device data and old website localStorage records are offered for one-time import and removed only after a successful database save. AsyncStorage still stores the Supabase authentication session, not health records. An account and network connection are required to read or write health records. JSON export contains sensitive health information and is not a doctor's PDF report. Push notifications, payments, real doctor chat and report PDF are not connected in this mobile version. No website `.env.local` or server secrets are bundled.

### Community setup

The community needs an active Tuta Supabase project. Apply [`supabase/migrations/20261025162311_community_feed.sql`](../supabase/migrations/20261025162311_community_feed.sql) and the later member-only access migration to **that** project, not another application's database. The migrations add member-only posts and comments, topic filters, author-only post editing/deletion, a 200-word database check, private report submissions and an admin-managed verified-doctor directory. Reports are reviewed in the website admin panel. They do not expose period or symptom records. Doctor verification records must be added only through a trusted administrative process, never from the mobile app or user-editable profile metadata.

Set `CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (the same cloud name), `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in the **website server** environment and deploy its `/api/community/cloudinary-signature` route. Set `EXPO_PUBLIC_TUTA_API_URL` to that website's HTTPS origin and `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` to the same cloud name in `mobile/.env.local`. The API secret must never be put in `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`. Publishable Supabase URL/key remain required for the feed. Rebuild the native app after adding the image-picker module.

Posts and their Cloudinary photos are public. The app enforces one photo and a 4 MB converted-JPEG limit, but production also needs Cloudinary-side upload limits, abuse rate-limiting and a process to review reports. Until the database and Cloudinary settings are applied, the app shows a clear unavailable state; it does not invent posts or claim photo uploads succeeded.

Dates are calendar-day estimates, not confirmed ovulation. Overdue cycles remain open; no new actual period is silently invented. `period.duration` counts recorded bleeding days inclusively. Calendar predictions are labeled separately from recorded days.

## Dependency check

The installation audit currently reports 12 transitive findings (8 moderate, 4 high) through Expo's build tooling (`node-forge`, `xcode` / `uuid`). npm's suggested automatic resolution downgrades Expo to an incompatible major version, so it was not applied. Recheck patched upstream packages and complete real-user/device QA before distributing a release.
