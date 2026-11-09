# TUTA Android app

ეს საქაღალდე განკუთვნილია TUTA-ს Android აპლიკაციისთვის.

iOS და Android იყენებს საერთო React Native / Expo კოდს: `../mobile/`.

გაშვება: `cd ../mobile && npm run android` (საჭიროა Android emulator ან დაკავშირებული მოწყობილობა).

Native Gradle პროექტის შესაქმნელად გაუშვი `npx expo prebuild --platform android` `mobile/` საქაღალდიდან. პროექტი შეიქმნება `mobile/android/`-ში. გასავრცელებელი APK/AAB ცალკე build ეტაპია.

## Preview builds

Android preview APK-ები ინახება `android/releases/`-ში და Git-ში არ იტვირთება. ახალი ვერსიაა `Tuta-1.1.3-preview.apk` (versionCode 7). ეს სატესტო ხელმოწერის მქონე Android ფაილია და iPhone-ზე არ ყენდება. ფუნქციებისა და შეზღუდვების აღწერაა `mobile/README.md`-ში.
