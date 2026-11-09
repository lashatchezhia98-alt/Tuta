export const PAYMENT_RETURN_URL = "com.tutahealth.app://payment-return";

const uuid = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const orders = {
  premium: new RegExp(`^tuta-${uuid}$`, "i"),
  market: new RegExp(`^tuta-market-${uuid}$`, "i"),
};

export function validPaymentOrder(kind, order) {
  return (kind === "premium" || kind === "market") &&
    typeof order === "string" && orders[kind].test(order);
}

export function paymentReturnLink(kind, order) {
  return `${PAYMENT_RETURN_URL}/${kind === "market" ? "market" : "premium"}${validPaymentOrder(kind, order) ? `/${order}` : ""}`;
}

export function parsePaymentReturn(value) {
  if (typeof value !== "string" || !value.startsWith(`${PAYMENT_RETURN_URL}/`)) return null;
  const [kind, order, extra] = value.slice(PAYMENT_RETURN_URL.length + 1).split("/");
  if (extra !== undefined || (kind !== "premium" && kind !== "market")) return null;
  if (order !== undefined && !validPaymentOrder(kind, order)) return null;
  return kind === "market" ? "orders" : "premium";
}
