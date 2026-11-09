export function flittReturnUrl(origin: string, type: "premium" | "market", orderId: string, mobile: boolean) {
  const target = new URL("/api/payments/flitt/return", origin);
  target.searchParams.set("type", type);
  if (type === "market" || mobile) target.searchParams.set("order", orderId);
  if (mobile) target.searchParams.set("client", "app");
  return target.toString();
}
