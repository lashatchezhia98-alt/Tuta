# Web / native parity audit

Scope: user-facing screens and actions in the checked-out source. Admin routes,
payment return handlers and backend APIs are not native user screens.

| Area | Web | Native | Checked in this pass |
| --- | --- | --- | --- |
| Start and navigation | `/`, Services, mobile tabs, menu | Cycle home, Services, tabs, menu | Default period destination; shared service and menu mappings. Desktop marketing remains public. |
| Account access | Sign in, register, reset request, reset form | Auth screens and recovery deep link | Password auth, email verification, recovery and post-reset session paths. |
| Period | Dashboard, calendar, journal, insights | Summary, calendar, daily check-in, insights | Shared forecast, calendar date navigation, multi-day entry, sexual-activity logging, mobile summary layout and calendar markers. |
| Health support | Period/ovulation calculators, pregnancy, partner sharing, journey, symptom review, doctor report | Corresponding service screens | Shared calculation and guidance modules; pregnancy shortcuts and the ability to turn off an existing mode when creation is disabled. Report access uses the same membership, with browser print vs native PDF sharing. |
| Activity | Activity inbox | Bell / activity inbox | Account-scoped read state, categories, preferences, and linked posts/comments. Native operating-system push delivery is not implemented in web. |
| Announcements and reminders | Tuta announcements, calendar reminders | Tuta announcements, calendar reminders | Separate destinations; announcements use the same API and read state. Calendar exports use the account forecast on both. |
| Community and library | Feed and comments, articles | Feed and comments, articles | Post and comment actions; refresh on both (browser button / native pull gesture); shared bilingual title/body search and categories. |
| Consultations | Doctor list, chat, visits | Care screen | Shared care API, access gates, chat and booking paths. |
| Commerce | Market, cart and checkout, orders, Premium | Market, cart and checkout, orders, Premium | Shared catalogue/orders/payment APIs and Premium renewal paths. Payment handoff and receipt UI remain platform-specific. |
| Profile and account data | Settings, privacy, deletion requests | Profile, privacy, deletion requests | Cycle settings, health-data export and deletion, account deletion request, password change, and social links. |
| Public information | About, privacy, terms | About, privacy, terms | Reachable on both surfaces; administrator operations remain web-only by design. |

Automated coverage validates all 24 shared service destinations against the
production web route manifests and the native navigation table. It also checks
signed-in summary rendering, action dispatch, forecast marks, and shared
library search. This is not a device-by-device or live-account acceptance test.
Before release, exercise sign-in/recovery, write-and-refresh in the calendar
and journal, activity settings, consultation, and test checkout on the same
test account in iOS, Android and mobile Safari.
