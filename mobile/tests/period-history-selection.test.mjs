import assert from "node:assert/strict";
import test from "node:test";
import { addDays, periodDaysBetween, periodsFromHistorySelection, selectPeriodDay } from "../src/cycle.mjs";

const today = "2026-11-18";
const run = (start, count) => Array.from({ length: count }, (_, i) => addDays(start, i));

test("two taps fill the selected range, including across months, in either order", () => {
  assert.deepEqual(periodDaysBetween("2026-11-02", "2026-10-30", today), run("2026-10-30", 4));
  assert.deepEqual(periodDaysBetween(today, today, today), [today]);
  assert.equal(periodDaysBetween("2026-11-01", "2026-11-11", today), null);
  assert.equal(periodDaysBetween(today, "2026-11-19", today), null);
  assert.equal(periodDaysBetween("2026-02-30", today, today), null);
});

test("calendar taps add intervals, start a separate period after a gap and unmark existing days", () => {
  let selection = selectPeriodDay([], null, "2026-09-18", today);
  selection = selectPeriodDay(selection.days, selection.anchor, "2026-09-22", today);
  selection = selectPeriodDay(selection.days, selection.anchor, "2026-10-18", today);
  selection = selectPeriodDay(selection.days, selection.anchor, "2026-10-22", today);
  assert.deepEqual(selection.days, [...run("2026-09-18", 5), ...run("2026-10-18", 5)]);
  assert.equal(selectPeriodDay(selection.days, selection.anchor, "2026-10-22", today).days.length, 9);
  assert.equal(selectPeriodDay(selection.days, "2026-10-22", today, today).days.length, 11);
});

test("one save keeps earlier and later cycles separate and preserves other entries", () => {
  const existing = [{ start: "2026-08-16", duration: 4 }, { start: "2026-10-18", duration: 5 }];
  const selected = [...run("2026-10-18", 5), ...run("2026-09-18", 5)];
  assert.deepEqual(periodsFromHistorySelection(selected, existing, undefined, today), {
    start: "2026-10-18",
    periods: [existing[0], { start: "2026-09-18", duration: 5 }, existing[1]],
  });
});

test("month boundaries do not split a single run and ten-day limit applies per run", () => {
  const selected = [...run("2026-09-28", 6), ...run("2026-11-11", 5)];
  assert.deepEqual(periodsFromHistorySelection(selected, [], undefined, today).periods, [
    { start: "2026-09-28", duration: 6 }, { start: "2026-11-11", duration: 5 },
  ]);
  assert.deepEqual(periodsFromHistorySelection(run("2026-09-28", 11), [], undefined, today), { error: "selection" });
  assert.deepEqual(periodsFromHistorySelection(["2026-11-19"], [], undefined, today), { error: "selection" });
});

test("overlaps in history are merged without losing existing days, while an explicit edit can replace its record", () => {
  const existing = [{ start: "2026-10-18", duration: 5 }];
  const selected = [...run("2026-09-18", 5), ...run("2026-10-20", 4)];
  assert.deepEqual(periodsFromHistorySelection(selected, existing, undefined, today), {
    start: "2026-10-18",
    periods: [{ start: "2026-09-18", duration: 5 }, { start: "2026-10-18", duration: 6 }],
  });
  assert.deepEqual(existing, [{ start: "2026-10-18", duration: 5 }]);
  assert.deepEqual(periodsFromHistorySelection(selected, existing, "2026-10-18", today).periods, [
    { start: "2026-09-18", duration: 5 }, { start: "2026-10-20", duration: 4 },
  ]);
  assert.equal(periodsFromHistorySelection(run("2026-09-18", 5), existing, "2026-10-18", today).periods.length, 2);
});

test("a subset does not shorten history or duplicate dates; an unsafe merge leaves all records unchanged", () => {
  const existing = [{ start: "2026-10-18", duration: 7 }];
  assert.deepEqual(periodsFromHistorySelection(run("2026-10-20", 2), existing, undefined, today).periods, existing);
  assert.deepEqual(periodsFromHistorySelection([...run("2026-09-18", 5), ...run("2026-10-24", 6)], existing, undefined, today), { error: "selection" });
  assert.deepEqual(existing, [{ start: "2026-10-18", duration: 7 }]);
});
