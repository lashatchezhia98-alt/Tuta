import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCycleEstimate, formatCalculatorDate } from "../src/cycle-calculator.mjs";

test("a period estimate in the past never appears as a next period or a fertile window", () => {
  assert.deepEqual(calculateCycleEstimate("2025-01-01", 28, 5, "2026-11-17"), {
    status: "overdue", nextPeriod: null, fertility: null,
  });
});

test("the expected day is still shown on that day, with past fertility marked", () => {
  const result = calculateCycleEstimate("2026-10-20", 28, 5, "2026-11-17");
  assert.equal(result.status, "estimated");
  assert.equal(result.nextPeriod, "2026-11-17");
  assert.equal(result.fertility.passed, true);
});

test("current estimates keep the intended date arithmetic and support Georgian without Intl", () => {
  assert.deepEqual(calculateCycleEstimate("2026-11-16", 28, 5, "2026-11-17"), {
    status: "estimated", nextPeriod: "2026-12-14",
    fertility: { ovulation: "2026-11-30", start: "2026-11-25", end: "2026-12-01", passed: false },
  });
  assert.equal(formatCalculatorDate("2026-11-29", true), "29 ნოემბერი 2026");
  assert.equal(formatCalculatorDate("2024-02-29", false), "29 February 2024");
});

test("invalid inputs and ovulation during recorded bleeding do not produce misleading estimates", () => {
  assert.equal(calculateCycleEstimate("2026-11-18", 28, 5, "2026-11-17").status, "invalid");
  assert.equal(calculateCycleEstimate("2026-11-16", 28.5, 5, "2026-11-17").status, "invalid");
  assert.equal(calculateCycleEstimate("2026-02-30", 28, 5, "2026-11-17").status, "invalid");
  assert.equal(calculateCycleEstimate("2026-11-16", 21, 10, "2026-11-17").fertility, null);
});
