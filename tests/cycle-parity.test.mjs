import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { getCycle, getCurrentCycle, cycleDayFor, phaseForCycleDay } from '../lib/cycle.ts';
import { cycleAt, addDays } from '../mobile/src/cycle.mjs';
import { validHealthData } from '../lib/health-data.ts';

test('stored health data rejects invalid dates, duplicates and malformed entries', () => {
  const base = { version: 1, lang: 'ka', name: '', cycleLength: 28, periods: [{ start: '2026-01-01', duration: 5 }], logs: [] };
  assert.equal(validHealthData(base), true);
  assert.equal(validHealthData({ ...base, periods: [{ start: '2026-02-30', duration: 5 }] }), false);
  assert.equal(validHealthData({ ...base, periods: [...base.periods, ...base.periods] }), false);
  assert.equal(validHealthData({ ...base, periods: [null] }), false);
  assert.equal(validHealthData({ ...base, logs: [null] }), false);
  const log = { date: '2026-01-01', mood: 'calm', energy: 3, pain: 1, flow: 'light', symptoms: [], notes: '' };
  assert.equal(validHealthData({ ...base, logs: [log] }), true);
  assert.equal(validHealthData({ ...base, logs: [{ ...log, symptoms: [{}] }] }), false);
  assert.equal(validHealthData({ ...base, logs: [{ ...log, date: '2026-02-30' }] }), false);
});

test('web and mobile agree on every day for supported settings', () => {
  for (let length = 21; length <= 45; length++) {
    for (let duration = 1; duration <= 10; duration++) {
      const start = '2024-02-20';
      const web = getCycle(start, length, duration);
      for (let day = 1; day <= length + 2; day++) {
        const date = addDays(start, day - 1);
        const mobile = cycleAt([{ start, duration }], length, date, date);
        assert.equal(cycleDayFor(date, start), mobile.day);
        assert.equal(phaseForCycleDay(day, duration, length), mobile.phase);
        assert.equal(web.nextPeriod, mobile.next);
        assert.equal(web.ovulation, mobile.ovulation);
        assert.equal(web.fertileStart, mobile.fertileStart);
        assert.equal(web.fertileEnd, mobile.fertileEnd);
      }
    }
  }
});

test('invalid dates and fractional settings are rejected', () => {
  for (const date of ['2025-02-29', '2024-02-30', '2024-13-01', 'invalid']) {
    assert.throws(() => getCycle(date));
  }
  assert.equal(getCycle('2024-02-29').nextPeriod, '2024-03-28');
  assert.throws(() => getCycle('2024-01-01', 28.5));
  assert.throws(() => addDays('2024-01-01', 0.5));
});

test('overdue cycle is not silently reset or clamped', () => {
  const current = getCurrentCycle({ startDate: '2026-01-01', cycleLength: 28, periodDuration: 5 }, new Date('2026-02-10T12:00:00'));
  assert.equal(current.cycleDay, 41);
  assert.equal(current.overdue, true);
  assert.equal(current.phase, 'unknown');
  assert.equal(phaseForCycleDay(0, 5, 28), 'unknown');
});

test('date-only calculations survive DST and timezone changes', () => {
  const moduleUrl = new URL('../lib/cycle.ts', import.meta.url).href;
  for (const TZ of ['Asia/Tbilisi', 'America/New_York', 'Europe/Berlin', 'Pacific/Auckland']) {
    const script = `import {cycleDayFor,addDays,isoDate} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify([cycleDayFor('2026-03-10','2026-03-07'),isoDate(addDays('2026-03-07',3)),cycleDayFor('2026-11-03','2026-10-31')]));`;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), [4, '2026-03-10', 4], TZ);
  }
});
