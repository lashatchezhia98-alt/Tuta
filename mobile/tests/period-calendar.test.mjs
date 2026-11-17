import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, periodCalendarModel, periodDayLabel, predictionDateKey } from '../src/cycle.mjs';

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
  assert.deepEqual(model.day(logs[0].date), { state: 'period', expectedEnd: false, expectedHeavy: false, heavy: true, activity: true });
  assert.match(periodDayLabel(model.day(logs[0].date), logs[0].date, false), /Recorded heavy flow, Sexual activity logged/);
  assert.equal(model.day('2026-05-03').expectedHeavy, true);
  assert.equal(model.day('2026-05-03').heavy, false);
  assert.equal(model.day('2026-05-03').activity, false);
  assert.equal(model.day('2026-05-04').expectedHeavy, false);
  assert.equal(periodCalendarModel({ ...baseline, logs: logs.slice(0, 2) }, today).day('2026-05-03').expectedHeavy, false);
  assert.deepEqual(model.windows, periodCalendarModel(baseline, today).windows);
});

test('pause hides estimates but never removes recorded activity or bleeding', () => {
  const logs = [{ date: periods[0].start, flow: 'heavy', sexualActivity: 'protected' }];
  for (const model of [
    periodCalendarModel({ ...baseline, logs, pregnancy: { active: true } }, today),
    periodCalendarModel({ ...baseline, logs }, '2026-05-03'),
  ]) {
    assert.equal(model.nextWindow, null);
    assert.equal(model.day('2026-05-03').state, '');
    assert.equal(model.day(logs[0].date).activity, true);
    assert.equal(model.day(logs[0].date).heavy, true);
  }
});
