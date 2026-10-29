# TUTA Android app

ეს საქაღალდე განკუთვნილია TUTA-ს Android აპლიკაციისთვის.

iOS და Android იყენებს საერთო React Native / Expo კოდს: `../mobile/`.

გაშვება: `cd ../mobile && npm run android` (საჭიროა Android emulator ან დაკავშირებული მოწყობილობა).

Native Gradle პროექტის შესაქმნელად გაუშვი `npx expo prebuild --platform android` `mobile/` საქაღალდიდან. პროექტი შეიქმნება `mobile/android/`-ში. გასავრცელებელი APK/AAB ცალკე build ეტაპია.

## Preview builds

ძველი Android preview APK-ები ინახება `android/releases/`-ში და Git-ში არ იტვირთება, რადგან თითოეული დაახლოებით 72 MB-ია. უახლესი ამჟამად `Tuta-1.0.1-preview.apk`-ია. ეს Android ფაილია და iPhone-ზე არ ყენდება.
