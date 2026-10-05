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
- Home, month calendar, daily journal, insights, profile.
- Mood, energy, pain, flow, symptom selection, custom symptoms and daily notes.
- Previous-day journal editing from calendar and saved state across restarts.
- Period start history, average after 3 completed cycles, six estimates and irregularity flags.
- Local storage, unsaved journal warning, confirmed local-data deletion.
- Premium doctor messaging is visibly unavailable until authenticated subscriptions and a real service exist. No local switch pretends to authorize paid access.

## Verify

```sh
npm run typecheck
npm test
npx expo export --platform all
```

## Native projects

The repository-level `ios/` and `android/` directories describe each platform. The shared source is here in `mobile/`. Native Xcode and Gradle projects have been generated in `mobile/ios/` and `mobile/android/`. Regenerate them with `npx expo prebuild` **from this directory**. They are ignored by Git because they are reproducible from app configuration. Do not manually duplicate the shared app source.

Native archive/signing and store release need Xcode / Android tooling and developer accounts. Browser exports verify shared UI, not simulator or device execution.

## Data and scope

Storage key: `tuta.mobile.v1`. Mobile data is independent from the old website localStorage. Entries remain on the device; AsyncStorage is not encrypted storage. Supabase authentication, cloud sync, push notifications, payments, real doctor chat and report export are not connected in this mobile version. No website `.env.local` or server secrets are bundled.

Dates are calendar-day estimates, not confirmed ovulation. Overdue cycles remain open; no new actual period is silently invented. `period.duration` counts recorded bleeding days inclusively. Calendar predictions are labeled separately from recorded days.

## Dependency check

The installation audit currently reports 12 transitive findings (8 moderate, 4 high) through Expo's build tooling (`node-forge`, `xcode` / `uuid`). npm's suggested automatic resolution downgrades Expo to an incompatible major version, so it was not applied. Recheck patched upstream packages before distributing a release. Native signed builds and device QA remain outstanding.
