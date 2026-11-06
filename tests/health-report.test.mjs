import test from "node:test";
import assert from "node:assert/strict";
import { healthReport, reminderCalendar } from "../lib/health-report.ts";
import { articleInput, uuid } from "../lib/content-validation.ts";
const base = {
  version: 1,
  lang: "ka",
  name: "private",
  cycleLength: 28,
  periods: [],
  logs: [],
};
test("six calendar months clamp the day correctly across leap years", () => {
  assert.equal(healthReport(base, "2024-08-31").from, "2024-02-29");
  assert.equal(healthReport(base, "2025-08-31").from, "2025-02-28");
});
test("report excludes unfinished cycles and future entries, counts symptoms per day", () => {
  const data = {
    ...base,
    periods: [
      { start: "2026-08-01", duration: 5 },
      { start: "2026-08-29", duration: 4 },
      { start: "2026-09-26", duration: 5 },
      { start: "2026-12-01", duration: 5 },
    ],
    logs: [
      { date: "2026-08-05", symptoms: ["cramps", "cramps"] },
      { date: "2026-08-06", symptoms: ["cramps", "bloating"] },
      { date: "2026-12-01", symptoms: ["future"] },
    ],
  };
  const report = healthReport(data, "2026-10-01");
  assert.equal(report.cycles.length, 2);
  assert.equal(report.mean, 28);
  assert.deepEqual(report.symptoms, [
    { name: "cramps", count: 2 },
    { name: "bloating", count: 1 },
  ]);
  assert.equal(
    report.phases.reduce((n, p) => n + p.days, 0),
    28,
  );
});
test("irregular flag requires 3 completed cycles and more than 7 days deviation", () => {
  const report = healthReport(
    {
      ...base,
      periods: ["2026-07-01", "2026-07-29", "2026-08-26", "2026-10-10"].map(
        (start) => ({ start, duration: 5 }),
      ),
    },
    "2026-10-12",
  );
  assert.deepEqual(
    report.cycles.map((c) => c.irregular),
    [false, false, true],
  );
});
test("calendar export uses generic all-day reminders without health details", () => {
  const result = reminderCalendar(["2026-12-01"]);
  assert.match(result, /DTSTART;VALUE=DATE:20261201/);
  assert.match(result, /SUMMARY:Tuta check-in/);
  assert.doesNotMatch(result, /private|period|ovulation|symptom/i);
  assert.ok(result.endsWith("END:VCALENDAR\r\n"));
});
test("CMS validates complete translations, bounds and schedule", () => {
  const valid = {
    title_ka: "სათაური",
    body_ka: "ტექსტი",
    title_en: "",
    body_en: "",
    status: "draft",
    category: "cycle",
  };
  assert.equal(articleInput(valid).publish_at, null);
  assert.throws(() => articleInput({ ...valid, title_en: "Title" }));
  assert.throws(() => articleInput({ ...valid, body_ka: "x".repeat(6001) }));
  assert.throws(() =>
    articleInput({ ...valid, status: "scheduled", publish_at: "bad" }),
  );
  assert.throws(() => articleInput({ ...valid, status: "fake" }));
  assert.throws(() => uuid("x),patient_id.neq.x"));
});
