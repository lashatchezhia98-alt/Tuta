# Tuta mobile 1.1.6

Shared React Native / Expo app for iOS and Android. The Next.js website uses the same account, health records, community, product catalogue, care service and membership APIs.

## Navigation

| Primary tab | Pages |
| --- | --- |
| მთავარი / Home | Members-only community, topics, posts, comments and replies |
| პერიოდი / Period | Overview, calendar, daily journal and insights |
| სერვისები / Services | Doctors, conversations, appointments, library, pregnancy, partner sharing, guided journey, doctor PDF report and calculators |
| მარკეტი / Market | Four product categories, photo galleries, cart, delivery address and optional map pin |
| პროფილი / Profile | Account and logout, orders, Premium, calendar reminders and cycle settings |

The header contains sign-in/registration or account access. The hamburger holds About, Privacy, Terms and language selection. Administrative controls stay in the website admin panel. Feature visibility follows the server's admin-managed settings; existing appointment cancellation, order history and consent withdrawal remain accessible when sales entry points are disabled.

## Connected features and limits

- Georgian and English, shared app icon, bundled fonts, safe-area layout and Android back navigation.
- Email/password registration, confirmation, sign-in, logout and password recovery. Password confirmation must match. Supabase must allow the app callback `com.tutahealth.app://auth-callback`.
- Health records live in Supabase `health_state` under RLS. No new health record is saved to device storage. Foreground/realtime refresh and revision checks protect synchronization. Account changes invalidate pending private reads and writes.
- Cycle predictions use actual history and the shared tested cycle engine. Estimates are not confirmed ovulation, diagnosis or contraception. Pregnancy pauses period predictions.
- The existing community supports topic filtering, anonymous posts/replies, threaded comments, author editing/deletion, reports and verified doctor labels.
- Comments can load older pages beyond the initial page. Only verified doctors can have a profile photo.
- Library content and verified doctor profiles come from real website APIs; empty services are not replaced with invented records.
- Doctor messaging and new appointments require server-verified Premium. History and cancellation remain available to the authorized participant.
- Premium and market checkout use the existing **Flitt test integration**, not live charging. Prices: 4.99 GEL for 30 days or 49.90 GEL per year. The server blocks a repeat Premium purchase during paid coverage. New Premium subscriptions can opt into test renewal, which can be paused or resumed without shortening paid access. Successful browser return alone never grants access or marks an order paid.
- Doctor PDF report uses the last six months of the same report model as the website, with cycles, symptom frequency and irregularity flags. Export requires confirmation and membership verification.
- Reminders export a calendar file. **Native push notification delivery is not implemented.**
- Automated medical symptom review and full account deletion remain clearly labelled as planned, matching the website. A health-record reset is not account deletion. No AI assistant is included.

## Privacy

AsyncStorage holds the authentication session, language and only product IDs/quantities for the cart, not delivery addresses, pins or health records. Legacy local health records may be imported once and removed after successful cloud save. Explicit PDF/calendar exports use temporary cache files, deleted after the share sheet closes; copies the user shares remain at their chosen destination.

Chat messages expire 48 hours after sending. The app removes expired messages from its in-memory view and does not keep a local chat archive.

Photos use signed Cloudinary uploads through the website server. Community access is members-only, but a copied Cloudinary image URL is not an independently authenticated private file.

## Setup

Run from this directory:

```sh
npm ci
npm start
npm run typecheck
npm test
npx expo export --platform all
```

Configure only public Supabase/project values in `mobile/.env.local`, following `.env.example`. `EXPO_PUBLIC_TUTA_API_URL` must point to the deployed HTTPS website. Server-only Cloudinary secrets, payment secrets, Mailtrap credentials and Supabase service-role keys must never be placed in `EXPO_PUBLIC_*`. All required website migrations and environment settings must already be applied to the intended Tuta project.

`metro.config.js` proxies a fixed allowlist of customer API routes to the deployed site only for localhost web development. Native releases call the HTTPS website directly; this does not disable production CORS or expose administrative routes.

## Native builds

Generated projects and build artifacts are ignored by Git. Preserve the configured scene-lifecycle plugin when regenerating iOS:

```sh
npx expo prebuild --no-clean --no-install
cd ios
pod install
open Tuta.xcworkspace
```

Open **Tuta.xcworkspace**, not Tuta.xcodeproj, so CocoaPods modules are included. The current iOS deployment target is 26.6. Device installation requires a matching signing team and an unexpired profile. Personal Team builds expire and must be signed/installed again.

The Android preview is `../android/releases/Tuta-1.1.6-preview.apk` (versionCode 10). It uses development signing for direct testing, not a production Play Store release key. Do not uninstall an existing app merely to update it.

Flitt checkout started from the native app uses an HTTPS return page to reopen Premium or Orders. Returning from the browser does not confirm a payment; only the independently verified Flitt server callback can do that.

Before distribution, run native builds and physical-device checks in addition to JavaScript tests. Payment settlement, medical content review, actual doctor operations, store approval and external email/delivery reliability are not proven by a successful build.
