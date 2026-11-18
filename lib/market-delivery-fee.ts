export const maxDeliveryFeeTetri = 100_000;

export function marketDeliveryFee(features?: Record<string, unknown>): number {
  const value = features?.marketDeliveryFeeTetri;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maxDeliveryFeeTetri ? value : 0;
}
