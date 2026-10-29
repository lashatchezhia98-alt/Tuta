# TUTA iOS app

ეს საქაღალდე განკუთვნილია TUTA-ს iOS აპლიკაციისთვის.

iOS და Android იყენებს საერთო React Native / Expo კოდს: `../mobile/`.

გაშვება: `cd ../mobile && npm run ios` (საჭიროა Xcode Simulator).

Xcode-ში გახსენი `mobile/ios/Tuta.xcodeproj` (არა ეს დოკუმენტაციის საქაღალდე). Native Xcode პროექტის შესაქმნელად გაუშვი `npx expo prebuild --platform ios` `mobile/` საქაღალდიდან. პროექტი შეიქმნება `mobile/ios/`-ში. რეალურ მოწყობილობაზე ხელმოწერილი build ცალკე ეტაპია.
