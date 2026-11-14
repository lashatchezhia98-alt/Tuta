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
