import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, averages, cycleAt, forecast, history, overlapsPeriod, validSetup } from '../src/cycle.mjs';
import { cycleEducation, cycleReference, trackingJourney } from '../src/cycle-guidance.mjs';

const today = '2026-11-08';
const data = {periods:[], logs:[]};

test('reference intervals use exact age boundaries and do not invent missing age', () => {
  assert.equal(cycleReference('2008-11-09', today).kind, 'adolescent');
  assert.deepEqual(cycleReference('2008-11-08', today), {kind:'adult',min:24,max:38});
  assert.equal(cycleReference('1980-11-09', today).kind, 'adult');
  assert.equal(cycleReference('1980-11-08', today).kind, 'other');
  for (const value of [undefined,null,23,'','2027-01-01','2001-02-29']) assert.equal(cycleReference(value,today).kind, 'unknown');
  assert.equal(cycleReference('2020-11-08',today).kind,'other');
});

test('manual initial setting remains 21–45, not an observed-cycle limit', () => {
  for(const length of [21,28,45]) assert.equal(validSetup(today,length,1,today),true);
  for(const length of [20,46,28.5]) assert.equal(validSetup(today,length,1,today),false);
  for(const length of [9,18,46,75]) {
    const periods = [0,1,2,3].map(i=>({start:addDays('2025-01-01',length*i),duration:5}));
    const asOf = periods.at(-1).start;
    assert.deepEqual(history(periods).map(p=>p.length),[length,length,length]);
    assert.equal(averages(periods,28).length,length);
    const model=forecast(periods,28,asOf);
    assert.equal(model.expected,addDays(asOf,length));
    assert.equal(model.reliability,'low');
    assert.equal(model.fertilityAvailable,false);
    assert.equal(cycleAt(periods,28,addDays(asOf,5)).phase,'unknown');
  }
});

test('close but non-overlapping bleeding records are allowed; overlaps are blocked', () => {
  const periods=[{start:'2026-11-01',duration:5}];
  assert.equal(overlapsPeriod(periods,{start:'2026-11-07',duration:1}),false);
  assert.equal(overlapsPeriod(periods,{start:'2026-11-06',duration:1}),false);
  assert.equal(overlapsPeriod(periods,{start:'2026-11-05',duration:1}),true);
  assert.equal(overlapsPeriod(periods,{start:'2026-10-30',duration:4}),true);
  assert.equal(overlapsPeriod(periods,{start:'2026-11-01',duration:6}),false);
});

test('education separates setting limits, reference interval and actual observed range', () => {
  const periods=['2026-01-01','2026-01-19','2026-04-04'].map(start=>({start,duration:5}));
  const content=cycleEducation(periods,'2000-01-01','en',today);
  assert.match(content.summary,/shortest 18 days; longest 75 days; difference 57 days/);
  assert.match(content.paragraphs[0],/setting limit, not a definition/);
  assert.match(content.paragraphs[1],/24–38/);
  assert.match(content.paragraphs[2],/not clamped/);
  assert.match(content.paragraphs[3],/not a diagnosis/);
  assert.equal(cycleEducation([...periods,{start:'2027-01-01',duration:5}],undefined,'en',today).summary,content.summary);
});

test('journey is derived from saved entries and check-in completion resets daily', () => {
  assert.deepEqual(trackingJourney(data,'en',today).map(s=>s.done),[false,false,false,false]);
  const periods=[0,28,56,84].map(offset=>({start:addDays('2026-08-01',offset),duration:5}));
  const completed={periods,logs:[{date:today}]};
  assert.deepEqual(trackingJourney(completed,'en',today).map(s=>s.done),[true,true,true,false]);
  assert.equal(trackingJourney({...completed,periods:periods.slice(0,3)},'en',today)[1].done,false);
  assert.equal(trackingJourney(completed,'en',addDays(today,1))[2].done,false);
  assert.equal(trackingJourney({...data,periods:[{start:'2027-01-01',duration:5}]},'en',today)[0].done,false);
});
