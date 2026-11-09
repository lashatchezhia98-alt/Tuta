import { Linking, Platform } from "react-native";
import { checkoutDestination } from "./api";
import { PAYMENT_RETURN_URL, parsePaymentReturn } from "./payment-return.mjs";

export const checkoutInApp = Platform.OS === "ios" || Platform.OS === "android";

export async function openPaymentCheckout(value: unknown): Promise<string | null> {
  const url = checkoutDestination(value);
  if (!checkoutInApp) {
    await Linking.openURL(url);
    return null;
  }
  const { openAuthSessionAsync } = await import("expo-web-browser");
  const result = await openAuthSessionAsync(url, PAYMENT_RETURN_URL);
  return result.type === "success" && parsePaymentReturn(result.url) ? result.url : null;
}
