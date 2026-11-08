export const fulfillmentStates = [
  "new",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type Fulfillment = (typeof fulfillmentStates)[number];
export function canFulfill(from: string, to: string, payment: string) {
  if (to === "cancelled") return from === "new" || from === "packing";
  if (payment !== "approved") return false;
  return (
    (
      {
        new: ["packing"],
        packing: ["shipped"],
        shipped: ["delivered"],
      } as Record<string, string[]>
    )[from]?.includes(to) ?? false
  );
}
export const fulfillmentLabels: Record<Fulfillment, [string, string]> = {
  new: ["ახალი", "New"],
  packing: ["მზადდება", "Packing"],
  shipped: ["გაგზავნილი", "Shipped"],
  delivered: ["მიწოდებული", "Delivered"],
  cancelled: ["გაუქმებული", "Cancelled"],
};
export const paymentLabels: Record<string, [string, string]> = {
  pending: ["მოლოდინში", "Pending"],
  approved: ["დადასტურებული", "Approved"],
  declined: ["უარყოფილი", "Declined"],
  expired: ["ვადაგასული", "Expired"],
  reversed: ["დაბრუნებული", "Reversed"],
  processing: ["მუშავდება", "Processing"],
  created: ["შექმნილი", "Created"],
};
export type MarketOrder = {
  order_id: string;
  created_at: string;
  total_tetri: number;
  status: string;
  fulfillment_status: Fulfillment;
  mode: string;
  recipient_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  items: { name: string; quantity: number; price_tetri: number }[];
};
