# Tuta system push notifications

The inbox works independently of this setup. Push builds are opt-in: they never
prompt for OS permission before the member uses **Notifications → Settings**.
Lock-screen alerts carry no message, sender, transaction or health details.

1. Link Tuta to its Expo project. In the Expo project enable access-token
   security for push. Configure Apple APNs using the enrolled Apple Developer
   team and enable the capability for `com.tutahealth.app`. For Android, register
   the same application ID in Firebase and configure FCM v1 credentials in Expo.
   See [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
2. For credential-enabled builds, set `EXPO_PUBLIC_TUTA_PUSH_PROJECT_ID` and
   `TUTA_PUSH_IOS=1` and/or `TUTA_PUSH_GOOGLE_SERVICES_FILE`. Apply Expo prebuild
   to a reviewed native checkout (do not use `--clean` over local native changes),
   verify signing and the generated APNs entitlement/Firebase configuration,
   then build and install on real devices.
3. Apply the push migration after the activity migrations. Deploy the
   `activity-push` Supabase Edge Function. Keep the Expo access token in the Edge
   Function secret `ACTIVITY_EXPO_ACCESS_TOKEN`. Generate a separate 32+ character
   random worker secret in `ACTIVITY_PUSH_WORKER_SECRET` and store that same value
   in Supabase Vault for the scheduler. Do not expose either secret in a client,
   the repository, or logs.
4. Schedule a POST once per minute from Supabase Cron to
   `/functions/v1/activity-push`, sending the Vault secret as a bearer token.
   Follow [Supabase's scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions)
   and limit the scheduler to this function. The function rejects other methods,
   wrong secrets and missing provider configuration before claiming jobs.
5. On iOS and Android, opt in on two test accounts, send a reply while the
   recipient app is closed, tap the banner, then repeat with the category and
   device toggles turned off and after sign-out. Check both provider receipts and
   actual receipt on the device; an accepted Expo ticket alone is not delivery.

Push is not enabled in the standard preview builds. Never use production
user content in test notifications.
