import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activityBadgeText, activityGroups, activityKinds, activityTone, activityTones } from "../src/activity.mjs";
import { careOverview } from "../src/care-presentation.mjs";
import { cartStockIssue, deliveryFieldErrors } from "../src/market-model.mjs";
import { reviewSymptoms } from "../../lib/symptom-review.mjs";

test("symptom review counts distinct indicators within each condition", () => {
  assert.deepEqual(reviewSymptoms(["acne", "acne", "hairLoss", "bogus"]), {
    pcos: false, endometriosis: false, discuss: false,
  });
  assert.deepEqual(reviewSymptoms(["longCycles", "acne", "hairLoss"]), {
    pcos: true, endometriosis: false, discuss: true,
  });
  assert.deepEqual(reviewSymptoms(["severeCramps", "painDuringSex", "heavyFlow"]), {
    pcos: false, endometriosis: true, discuss: true,
  });
  assert.equal(reviewSymptoms(["severeCramps"]).discuss, true);
});

test("each database activity kind has a bilingual label and destination", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261114120000_mobile_activity_notifications.sql", import.meta.url), "utf8");
  const kinds = [...sql.match(/kind text not null check \(kind in \(([\s\S]*?)\)\)/)[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
  assert.deepEqual(Object.keys(activityKinds).sort(), kinds.sort());
  for (const [ge, en, page] of Object.values(activityKinds)) assert.ok(ge && en && page);
  for (const [key] of activityGroups) assert.match(sql, new RegExp(`\\b${key} boolean not null default true`));
});

test("notification status is separate from whether it was read", () => {
  assert.equal(activityTone("care_message"), "info");
  assert.equal(activityTone("market_paid"), "success");
  assert.equal(activityTone("visit_cancelled"), "error");
  for (const { label, background, color, icon } of Object.values(activityTones)) {
    assert.ok(label[0] && label[1] && icon);
    assert.notEqual(background, color);
  }
  assert.equal(activityBadgeText(24), "24");
  assert.equal(activityBadgeText(125), "99+");
});

test("doctor overview shows unread threads, the next confirmed appointment, and future times only", () => {
  const visit = starts_at => ({ status:"confirmed", consultation_slots:{ starts_at } });
  const overview = careOverview([{has_unread:true}, {}, {has_unread:false}],
    [visit("2026-12-08"), visit("2026-12-07"), visit("2026-12-01"), { ...visit("2026-12-05"), status:"cancelled" }],
    [{ starts_at:"2026-12-22" }, { starts_at:"2026-12-01" }, { starts_at:"2026-12-10" }], Date.parse("2026-12-04"));
  assert.equal(overview.unread, 1);
  assert.equal(overview.nextVisit.consultation_slots.starts_at, "2026-12-07");
  assert.deepEqual(overview.openSlots.map(s => s.starts_at), ["2026-12-10","2026-12-22"]);
});

test("cart hints distinguish invalid delivery fields, unavailable items and stock limits", () => {
  assert.deepEqual(deliveryFieldErrors("T", "123", ""), {recipient:true,phone:true,address:true});
  assert.deepEqual(deliveryFieldErrors("Test", "+995 (555) 010-101", "Test Street 12"), {recipient:false,phone:false,address:false});
  assert.equal(cartStockIssue(undefined, 1), "unavailable");
  assert.equal(cartStockIssue({stock_quantity:0}, 1), "unavailable");
  assert.equal(cartStockIssue({stock_quantity:1}, 2), "quantity");
  assert.equal(cartStockIssue({stock_quantity:2}, 2), null);
});
