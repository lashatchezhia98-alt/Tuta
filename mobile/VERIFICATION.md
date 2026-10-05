# Verification

- TypeScript: mobile application and existing Next.js project passed.
- Cycle unit tests: invalid / future dates, leap-day / DST arithmetic, matching phase and ovulation date, overdue cycle behavior, actual period start history, three-cycle averages and six estimates.
- 2026-10-05: all 14 cycle tests and mobile TypeScript checks passed. Added coverage for delayed forecast suspension, historical-data leakage, fractional-average calendar alignment, variability, duplicate dates, and every stable length from 21 to 45 days. See `PREDICTIONS.md` for model limits.
- Expo export: iOS, Android and web bundles generated successfully. These are JS bundles, not signed IPA / APK packages.
- Browser: first-run setup with synthetic data, Georgian and English UI, five-tab navigation, journal save with a selected symptom, custom symptom and free-text note, reopening the saved entry from calendar, future dates disabled in the date picker.
- 320px and 390px phone viewports: no document horizontal overflow; browser error capture empty. Language and the saved entry persisted after a full reload.
- Screenshots in `screenshots/` use synthetic test data, not real health records.
- Native projects generated with Expo prebuild. Android `assembleRelease` succeeded on 2026-10-03, and APK v2 signature verification passed. The standalone preview APK contains its JS bundle and fonts and is signed with the generated development key, not a store release key. Simulator/device execution and iOS native compilation have not been performed.
- 2026-10-05: Android 1.0.1 (versionCode 2) rebuilt successfully; APK signature verified. Output: `../android/Tuta-1.0.1-preview.apk`. This includes the revised prediction logic and explanatory UI. It remains a development-key-signed preview, not a clinically validated or store-ready release.

The browser preview is the same React Native source rendered through React Native Web. Native keyboard behavior, screen reader behavior, device storage and platform safe areas still need device testing.
