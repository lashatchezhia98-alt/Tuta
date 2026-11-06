# TUTA Health

TUTA is a Georgian and English cycle-awareness and members-only community prototype. The repository contains a responsive website, a shared iOS/Android app, cycle tracking, member community, health articles, calculators, and a protected administration area. Some listed screens are previews and are not yet connected to live services.

## Current status

This is a beta prototype, not a production medical service. Supabase email/password registration, sign-in and password recovery are implemented. Signed-in health records are shared through the Supabase `health_state` record and scoped by RLS; cycle predictions are calculated on the client. The community requires a signed-in, non-anonymous account. The Flitt flow is configured for testing and does not constitute a live charge. Mail delivery, Cloudinary uploads, and service availability depend on correct environment configuration. There is no medical diagnosis, live doctor chat, or connected doctor booking service.

## Web workspace update (November 2026)

The website now provides editable period history, dated symptom journals, six-month insights, a premium printable report, and a generic calendar reminder export. Predictions remain estimates, not contraception or diagnosis. Calendar exports do not automatically resynchronize.

The library has a bilingual plain-text editor with draft, published and scheduled states. Doctor profiles, availability, bookings and participant-only messaging have server-side access checks and admin controls. These replace the former consultation preview; actual availability requires verified doctors and published appointment slots. Patient messaging and booking require an active premium membership. Administrators cannot read private chats through the care management interface.

Apply the versioned Supabase migrations before deploying these routes. Care and article tables intentionally deny direct client access; scoped server endpoints use the server-only Supabase key. `tests/platform-db.sql` exercises booking conflicts, message authorization, payment callback idempotency and grants inside a rolled-back transaction. Run only against the intended project.

The new workspace screens are web features; native mobile screens have not been rebuilt or installed as part of this update. Live payment activation, clinical review, qualified doctor onboarding, operational monitoring, and complete production acceptance testing remain launch requirements. Flitt remains in test mode.

## Stack

- React 19 and TypeScript
- Next.js 16
- Tailwind CSS and shadcn/ui
- Supabase Auth and Postgres with row-level access controls

## Repository layout

- `app/`, `components/`, `lib/`, `db/`, `public/`, and `tests/` — the website.
- `mobile/` — the shared iOS and Android app (Expo / React Native). Open `mobile/ios/Tuta.xcworkspace` in Xcode after installing CocoaPods dependencies.
- `android/releases/` — locally kept Android preview APKs. They are intentionally ignored by Git because each is about 72 MB.
- Root `ios/` and `android/` folders contain platform notes and release artifacts only. Generated native projects live under `mobile/ios/` and `mobile/android/` and are ignored by Git; regenerate them from `mobile/` with Expo prebuild.

Generated folders such as `.next/`, `.vinext/`, `.wrangler/`, `build/`, `dist/`, `node_modules/`, and `mobile/ios/` or `mobile/android/` are local build/dependency output, not source files to commit. `.env.local` files contain private configuration and must remain untracked.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by the development server.

## Account setup

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the website's ignored `.env.local`, and `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `mobile/.env.local`. Use the same Supabase project for both. The publishable key may be included in a client app; never include a secret or service-role key.

In Supabase **Authentication → URL Configuration**, set the Site URL to the deployed website and add these redirect URLs:

- `https://YOUR-WEB-DOMAIN/login`
- `https://YOUR-WEB-DOMAIN/reset-password`
- `http://localhost:3000/login` and `http://localhost:3000/reset-password` for local testing
- `com.tutahealth.app://auth-callback` for iOS and Android

The mobile scheme is declared in `mobile/app.json`, so rebuild/reinstall the native app after changing it. In Supabase **Authentication → Providers**, enable email/password authentication and choose whether signups require email confirmation. Configure Supabase Auth's SMTP in the Supabase dashboard for reliable delivery. Mailtrap values in this repository's `.env.local` do **not** automatically configure Supabase's confirmation or recovery emails.

Website routes: `/register`, `/login`, `/forgot-password`, and `/reset-password`. The reset URL requires a valid emailed recovery session. Password reset requests intentionally show the same response whether the account exists or not.
Registration requires email (also the sign-in username), first name, last name, nickname, date of birth, and password. Profile details are stored in Supabase Auth user metadata; the email and password remain the sign-in credentials. Nicknames are not unique. A minimum-age policy has not yet been established; decide and implement it before public launch.

## Admin access

Set these values in `.env.local` locally and in the hosting provider's encrypted environment-variable settings:

```env
ADMIN_EMAIL=your-private-email
ADMIN_PASSWORD=your-long-unique-password
ADMIN_SESSION_SECRET=at-least-32-random-characters
```

The `.env.local` file is ignored by Git and must never be committed. The admin session is stored in a signed, HTTP-only cookie with a 12-hour lifetime.

## Commands

```bash
npm run dev
npm run build
npm run lint
```

## Privacy note

Cycle and symptom data is sensitive health information. Signed-in cycle and journal records use a shared Supabase account record with row-level access controls; predictions remain client-side. This is still a prototype: review encryption, retention and deletion rules, consent, backups, operational access, account deletion (including uploaded photos), and all providers' data-processing terms before accepting real patient data. Existing device/browser health records are offered for one-time import and removed only after a successful database save.

## Feedback

Useful review areas include mobile usability, Georgian copy clarity, accessibility, onboarding, trust and privacy messaging, and whether daily logging can be completed quickly.
