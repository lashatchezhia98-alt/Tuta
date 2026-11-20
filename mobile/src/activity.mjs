export const activityGroups = [
  ["post_comment", "კომენტარები ჩემს პოსტებზე", "Comments on my posts"],
  ["comment_reply", "პასუხები ჩემს კომენტარებზე", "Replies to my comments"],
  ["care", "ექიმის შეტყობინებები და ვიზიტები", "Doctor messages and visits"],
  ["market", "შეკვეთები და გადახდები", "Orders and payments"],
  ["premium", "პრემიუმის გადახდები", "Premium payments"],
];

export const activityKinds = {
  post_comment: ["შენს პოსტზე ახალი კომენტარია", "New comment on your post", "home"],
  comment_reply: ["შენს კომენტარს უპასუხეს", "New reply to your comment", "home"],
  care_message: ["კონსულტაციაში ახალი შეტყობინებაა", "New consultation message", "care"],
  visit_confirmed: ["ვიზიტი დადასტურდა", "Visit confirmed", "care"],
  visit_cancelled: ["ვიზიტი გაუქმდა", "Visit cancelled", "care"],
  market_paid: ["შეკვეთის გადახდა დადასტურდა", "Order payment confirmed", "orders"],
  market_payment_failed: ["შეკვეთის გადახდა არ დასრულდა ან გაუქმდა", "Order payment failed or was reversed", "orders"],
  market_shipped: ["შეკვეთა გზაშია", "Order shipped", "orders"],
  market_delivered: ["შეკვეთა მიწოდებულია", "Order delivered", "orders"],
  market_cancelled: ["შეკვეთა გაუქმდა", "Order cancelled", "orders"],
  premium_paid: ["პრემიუმის გადახდა დადასტურდა", "Premium payment confirmed", "premium"],
  premium_payment_failed: ["პრემიუმის გადახდა არ დასრულდა ან გაუქმდა", "Premium payment failed or was reversed", "premium"],
};

export const activityTones = {
  info: { background: "#F2ECFA", color: "#624386", icon: "i", label: ["სიახლე", "Update"] },
  success: { background: "#EAF5EE", color: "#286345", icon: "✓", label: ["დადასტურება", "Confirmation"] },
  action: { background: "#FFF3D6", color: "#80520A", icon: "!", label: ["მოქმედებაა საჭირო", "Action needed"] },
  error: { background: "#FCEAEC", color: "#A12D47", icon: "×", label: ["შეცდომა ან გაუქმება", "Error or cancellation"] },
};

export function activityTone(kind) {
  switch (kind) {
    case "visit_confirmed": case "market_paid": case "market_delivered": case "premium_paid": return "success";
    case "visit_cancelled": case "market_cancelled": case "market_payment_failed": case "premium_payment_failed": return "error";
    default: return "info";
  }
}

export const activityReadEvent = "tuta-activity-read";
export const activityBadgeText = count => count > 99 ? "99+" : String(count);
