import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, periodCalendarLegend, periodCalendarModel, periodDayLabel, predictionDateKey } from '../src/cycle.mjs';

const today = '2026-04-29';
const periods = ['2026-01-10', '2026-02-07', '2026-03-07', '2026-04-04'].map(start => ({ start, duration: 5 }));
const baseline = { periods, cycleLength: 30 };

test('account calendar rolls over at Tbilisi midnight independent of the device date', () => {
  assert.equal(predictionDateKey(new Date('2026-04-29T19:59:59Z')), today);
  assert.equal(predictionDateKey(new Date('2026-04-29T20:00:00Z')), '2026-04-30');
});

test('summary and calendar agree on every predicted date and the inclusive last day', () => {
  const model = periodCalendarModel(baseline, today);
  assert.deepEqual(model.nextWindow, { start: '2026-05-02', end: '2026-05-06' });
  assert.equal(model.expected, model.nextWindow.start);
  for (const { start, end } of model.windows) {
    for (let offset = 0; offset < 5; offset++) {
      const day = model.day(addDays(start, offset));
      assert.equal(day.state, 'predicted');
      assert.equal(day.expectedEnd, offset === 4);
    }
    assert.notEqual(model.day(addDays(end, 1)).state, 'predicted');
  }
  const boundary = periodCalendarModel({ periods: [{ start: '2026-03-31', duration: 5 }], cycleLength: 28 }, '2026-04-20');
  assert.deepEqual(boundary.nextWindow, { start: '2026-04-28', end: '2026-05-02' });
  assert.equal(boundary.day('2026-05-02').expectedEnd, true);
});

test('heavy flow, estimated heavy flow, and private activity are distinct and can coexist', () => {
  const logs = periods.slice(0, 3).map((p, index) => ({
    date: addDays(p.start, 1), flow: index === 2 ? 'medium' : 'heavy', sexualActivity: 'unspecified',
  }));
  const model = periodCalendarModel({ ...baseline, logs }, today);
  assert.deepEqual(model.day(logs[0].date), { state: 'period', today: false, ovulation: false, journal: true, expectedEnd: false, expectedHeavy: false, heavy: true, activity: true });
  assert.match(periodDayLabel(model.day(logs[0].date), logs[0].date, false), /Recorded heavy flow, Sexual activity logged/);
  assert.equal(model.day('2026-05-03').expectedHeavy, true);
  assert.equal(model.day('2026-05-03').heavy, false);
  assert.equal(model.day('2026-05-03').activity, false);
  assert.equal(model.day('2026-05-04').expectedHeavy, false);
  assert.equal(periodCalendarModel({ ...baseline, logs: logs.slice(0, 2) }, today).day('2026-05-03').expectedHeavy, false);
  assert.deepEqual(model.windows, periodCalendarModel(baseline, today).windows);
});

test('one model provides matching fertile ranges, day markers and estimated ovulation', () => {
  const model = periodCalendarModel(baseline, today);
  assert.deepEqual(model.nextFertileWindow, { start: '2026-05-11', end: '2026-05-17' });
  for (let i = 0; i < 7; i++) {
    const date = addDays(model.nextFertileWindow.start, i);
    assert.equal(model.day(date).state, 'fertile');
    assert.equal(model.day(date).ovulation, i === 5);
  }
  assert.match(periodDayLabel(model.day('2026-05-16'), '2026-05-16', false), /Estimated fertile days, Estimated ovulation/);
  assert.deepEqual(periodCalendarModel(baseline, '2026-04-15').nextFertileWindow, { start: '2026-04-15', end: '2026-04-19' });
  assert.equal(periodCalendarModel({ ...baseline, periods: periods.slice(-1) }, today).nextFertileWindow, null);
});

test('today, a saved journal entry and a not-yet-saved selection coexist', () => {
  const model = periodCalendarModel({ ...baseline, logs: [{ date: today, flow: 'none' }] }, today);
  assert.equal(model.day(today).journal, true);
  assert.equal(model.day(today).today, true);
  const browsing = periodCalendarLegend(false);
  assert.equal(browsing.some(item => item.key === 'draft'), false);
  assert.deepEqual(periodCalendarLegend(false, true).find(item => item.key === 'draft').symbol, '✓');
  assert.match(periodDayLabel(model.day(today), today, false, true), /Journal entry, Today, Selected, not yet saved/);
});

test('pause hides estimates but never removes recorded activity or bleeding', () => {
  const logs = [{ date: periods[0].start, flow: 'heavy', sexualActivity: 'protected' }];
  for (const model of [
    periodCalendarModel({ ...baseline, logs, pregnancy: { active: true } }, today),
    periodCalendarModel({ ...baseline, logs }, '2026-05-03'),
  ]) {
    assert.equal(model.nextWindow, null);
    assert.equal(model.nextFertileWindow, null);
    assert.equal(model.day('2026-05-16').ovulation, false);
    assert.equal(model.day('2026-05-03').state, '');
    assert.equal(model.day(logs[0].date).activity, true);
    assert.equal(model.day(logs[0].date).heavy, true);
  }
});
