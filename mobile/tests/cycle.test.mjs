import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stamp,addDays,validSetup,validBirthDate,cycleAt,history,averages,predictions,calendarState,periodFromSelectedDays} from '../src/cycle.mjs';
test('combines selected bleeding days across months into one period',()=>{
  const today='2026-11-14';
  assert.deepEqual(periodFromSelectedDays(['2026-11-01','2026-10-31','2026-11-02'],today),{start:'2026-10-31',duration:3});
  assert.deepEqual(periodFromSelectedDays([today],today),{start:today,duration:1});
  assert.equal(periodFromSelectedDays(['2026-11-12',today],today),null);
  assert.equal(periodFromSelectedDays(['2026-11-15'],today),null);
  assert.equal(periodFromSelectedDays(['2026-11-00'],today),null);
  assert.equal(periodFromSelectedDays(Array.from({length:11},(_,i)=>addDays(today,-i)),today),null);
});
test('birth date must be a real calendar date and an age between 1 and 120',()=>{
  assert.equal(validBirthDate('2000-02-29','2026-10-26'),true);
  assert.equal(validBirthDate('2001-02-29','2026-10-26'),false);
  assert.equal(validBirthDate('2026-10-25','2026-10-26'),false);
  assert.equal(validBirthDate('1900-01-01','2026-10-26'),false);
});
test('rejects rolled-over dates and future starting dates',()=>{
  assert.throws(()=>stamp('2026-02-30'));
  assert.equal(validSetup('2026-10-03',28,5,'2026-10-02'),false);
  assert.equal(validSetup('2026-10-01',28,5,'2026-10-02'),true);
});
test('date arithmetic crosses leap days and DST independently of timezone',()=>{
  assert.equal(addDays('2024-02-28',2),'2024-03-01');
  assert.equal(addDays('2026-03-07',3),'2026-03-10');
});
test('a recorded duration never marks future bleeding as confirmed',()=>{
  const periods=[{start:'2026-10-22',duration:5}];
  assert.equal(calendarState(periods,28,'2026-10-25','2026-10-25'),'period');
  assert.notEqual(calendarState(periods,28,'2026-10-26','2026-10-25'),'period');
});
test('ovulation phase aligns to the actual predicted date',()=>{
  const p=[{start:'2026-10-01',duration:5}];
  const c=cycleAt(p,28,'2026-10-15');
  assert.equal(c.next,'2026-10-29');assert.equal(c.ovulation,'2026-10-15');
  assert.equal(c.day,15);assert.equal(c.phase,'ovulation');
  assert.equal(c.fertileStart,'2026-10-10');assert.equal(c.fertileEnd,'2026-10-16');
  assert.equal(cycleAt(p,28,'2026-10-30').day,30);
  assert.equal(cycleAt(p,28,'2026-10-30').phase,'unknown');
  assert.equal(cycleAt(p,28,'2026-09-30'),null);
});
test('history measures actual starts, averages require three completed cycles',()=>{
  const p=['2026-06-01','2026-06-28','2026-07-27','2026-08-24'].map(start=>({start,duration:5}));
  assert.deepEqual(history(p).map(p=>p.length),[27,29,28]);
  assert.equal(averages(p,30).length,28);
  assert.equal(averages(p.slice(0,3),30).length,30);
  assert.equal(predictions(p,30,'2026-08-24').length,6);
  assert.equal(predictions(p,30,'2026-08-24')[0],'2026-09-21');
});
