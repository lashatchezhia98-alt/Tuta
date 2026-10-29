# TUTA Health

TUTA is a bilingual Georgian and English cycle-awareness product prototype. It includes a responsive marketing site, private local tracking mode, period and ovulation calculators, doctor consultation UI, insights, reports, and a protected administration area.

## Current status

This repository is an early product prototype intended for design review and usability feedback. Supabase email/password registration, sign-in and password recovery are implemented, but the product does not yet provide medical diagnosis, payments, or cloud storage for health records. Cycle entries still stay in browser/device storage.

## Stack

- React 19 and TypeScript
- vinext and Vite
- Tailwind CSS and shadcn/ui
- Drizzle ORM prepared for a future database

## Repository layout

- `app/`, `components/`, `lib/`, `db/`, `public/`, and `tests/` — the website.
- `mobile/` — the shared iOS and Android app (Expo / React Native). Open `mobile/ios/Tuta.xcodeproj` in Xcode.
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
Registration requires email (also the sign-in username), first name, last name, nickname, age (1–120), and password. Profile details are stored in Supabase Auth user metadata; the email and password remain the sign-in credentials. Nicknames are not unique.

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

Cycle and symptom data is sensitive health information. Signed-in cycle and journal records now use a shared Supabase account record with row-level access controls; predictions remain client-side. This is still a prototype: review encryption, retention and deletion rules, consent, backups, operational access, and all providers' data-processing terms before accepting real patient data. Existing device/browser health records are retained only until a successful user-initiated import into the account.

## Feedback

Useful review areas include mobile usability, Georgian copy clarity, accessibility, onboarding, trust and privacy messaging, and whether daily logging can be completed quickly.
