import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { activityGroups, activityKinds } from "../src/activity.mjs";
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
