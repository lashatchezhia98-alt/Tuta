import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const config = Constants.expoConfig?.extra?.tutaPush;
export const pushAvailable = Boolean(config?.projectId &&
  (Platform.OS === "ios" ? config.ios : Platform.OS === "android" && config.android));
const channel = "tuta-activity";
type Lang = "ka" | "en";

export async function pushDeviceEnabled(userId: string) {
  if (!supabase) throw Error();
  const auth = await supabase.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw Error();
  const { data, error } = await supabase.from("activity_push_devices").select("session_id").maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function changePushDevice(enabled: boolean, lang: Lang, userId: string) {
  if (!supabase) throw Error();
  let token: string | null = null;
  if (enabled) {
    if (!pushAvailable) throw Error();
    const notifications = await import("expo-notifications");
    if (Platform.OS === "android") {
      await notifications.setNotificationChannelAsync(channel, {
        name: lang === "ka" ? "თუთას შეტყობინებები" : "Tuta notifications",
        importance: notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await notifications.getPermissionsAsync();
    const permissions = existing.granted ? existing : await notifications.requestPermissionsAsync();
    if (!permissions.granted && permissions.ios?.status !== notifications.IosAuthorizationStatus.PROVISIONAL)
      return "permission" as const;
    token = (await notifications.getExpoPushTokenAsync({ projectId: config.projectId })).data;
  }
  const auth = await supabase.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw Error();
  const { error } = await supabase.rpc("activity_push_set_device", { p_token: token, p_language: lang, p_user: userId });
  if (error) throw error;
  return "saved" as const;
}

export async function watchPushTaps(open: () => void, signal: AbortSignal) {
  if (!pushAvailable) return;
  const notifications = await import("expo-notifications");
  if (signal.aborted) return;
  const handle = (response: import("expo-notifications").NotificationResponse | null) => {
    if (!signal.aborted && response?.notification.request.content.data?.screen === "activity") {
      notifications.clearLastNotificationResponse();
      open();
    }
  };
  const sub = notifications.addNotificationResponseReceivedListener(handle);
  signal.addEventListener("abort", () => sub.remove(), { once: true });
  handle(notifications.getLastNotificationResponse());
}
