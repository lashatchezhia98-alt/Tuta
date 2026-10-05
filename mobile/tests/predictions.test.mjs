import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,cycleAt,calendarState,predictions,forecast,history} from '../src/cycle.mjs';

function series(lengths,durations=[]) {
 let start='2025-01-01';
 const entries=[{start,duration:5}];
 lengths.forEach((length,i)=>{start=addDays(start,length);entries.push({start,duration:durations[i]??5});});
 return entries;
}
test('no phantom future period or fertility predictions while an actual period is overdue',()=>{
 const p=[{start:'2026-10-01',duration:5}];
 assert.deepEqual(predictions(p,28,'2026-10-30'),[]);
 assert.equal(calendarState(p,28,'2026-11-26','2026-10-30'),'');
 assert.equal(calendarState(p,28,'2026-11-10','2026-10-30'),'');
 assert.equal(forecast(p,28,'2026-10-30').status,'overdue');
});
test('historical phases do not use data from later cycles',()=>{
 const past=series([28,28,28]);
 const extended=[...past,{start:addDays(past.at(-1).start,42),duration:5}];
 const date=addDays(past.at(-1).start,14);
 assert.deepEqual(cycleAt(past,28,date,date),cycleAt(extended,28,date,date));
});
test('fractional averages produce exactly the same period starts in calendar and six-cycle list',()=>{
 const p=series([28,28,29]);const asOf=p.at(-1).start;
 const list=predictions(p,28,asOf);
 assert.equal(list.length,6);
 for(const start of list)assert.equal(calendarState(p,28,start,asOf),'predicted');
});
test('irregular data is labelled uncertain and gets an observed date range',()=>{
 const p=series([24,28,40]);const model=forecast(p,28,p.at(-1).start);
 assert.equal(model.reliability,'low');assert.equal(model.irregular,true);
 assert.equal(model.earliest,addDays(p.at(-1).start,24));
 assert.equal(model.latest,addDays(p.at(-1).start,40));
 assert.equal(model.expected,addDays(p.at(-1).start,31));
 assert.equal(model.fertilityAvailable,false);
});
test('no precise fertile estimate before enough completed cycles',()=>{
 const p=series([28]);const model=forecast(p,28,p.at(-1).start);
 assert.equal(model.reliability,'limited');assert.equal(model.source,'manual');
 assert.equal(model.fertilityAvailable,false);
});
test('logging the new actual period clears delay and recalculates schedule',()=>{
 const p=series([28,28,28]);const start=addDays(p.at(-1).start,31);
 assert.equal(forecast(p,28,start).status,'overdue');
 const updated=[...p,{start,duration:6}];
 assert.equal(forecast(updated,28,start).status,'active');
 assert.equal(cycleAt(updated,28,start,start).day,1);
 assert.equal(calendarState(updated,28,start,start),'period');
 assert.equal(predictions(updated,28,start)[0],addDays(start,29));
});
test('duplicate starts and impossible dates cannot create zero-length history',()=>{
 assert.throws(()=>history([{start:'2026-02-30',duration:5}]));
 assert.throws(()=>history([{start:'2026-01-01',duration:5},{start:'2026-01-01',duration:5}]));
});
test('stable cycles from 21 through 45 days have aligned period and ovulation estimates',()=>{
 for(let length=21;length<=45;length++){
   const p=series([length,length,length]);const asOf=p.at(-1).start;
   const model=forecast(p,28,asOf);
   assert.equal(model.expected,addDays(asOf,length));
   assert.equal(model.fertilityAvailable,true);
   const ovulation=addDays(model.expected,-14);
   assert.equal(cycleAt(p,28,ovulation,asOf).phase,'ovulation');
   assert.equal(calendarState(p,28,ovulation,asOf),'fertile');
   model.starts.forEach(start=>assert.equal(calendarState(p,28,start,asOf),'predicted'));
 }
});
test('no fertility estimate when recorded bleeding overlaps the calculated ovulation date',()=>{
 const p=series([21,21,21],[10,10,10]);
 assert.equal(forecast(p,21,p.at(-1).start).fertilityAvailable,false);
});
test('unsorted entries and future entries cannot shift the current forecast',()=>{
 const p=series([27,28,29]);const asOf=p.at(-1).start;
 assert.deepEqual(forecast(p,28,asOf),forecast([...p].reverse(),28,asOf));
 assert.deepEqual(forecast(p,28,asOf),forecast([...p,{start:addDays(asOf,90),duration:5}],28,asOf));
});
