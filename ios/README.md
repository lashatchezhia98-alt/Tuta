# TUTA iOS app

ეს საქაღალდე განკუთვნილია TUTA-ს iOS აპლიკაციისთვის.

iOS და Android იყენებს საერთო React Native / Expo კოდს: `../mobile/`.

გაშვება: `cd ../mobile && npm run ios` (საჭიროა Xcode Simulator).

Xcode-ში გახსენი `mobile/ios/Tuta.xcworkspace`, არა `Tuta.xcodeproj`: აპს CocoaPods-ის მოდულებიც სჭირდება. პროექტის შესაქმნელად გაუშვი `npx expo prebuild --no-clean --no-install --platform ios` `mobile/` საქაღალდიდან, შემდეგ `mobile/ios/`-ში `pod install`.

ახალი ვერსიაა 1.1.0 (build 4). iOS-ის მიმდინარე მინიმალური ვერსიაა 26.6. რეალურ ტელეფონზე საჭიროა შესაბამისი ხელმოწერა და მოქმედი პროფილი; Personal Team-ის სატესტო ხელმოწერა დროებითია. ფუნქციებისა და შეზღუდვების აღწერაა `mobile/README.md`-ში.
