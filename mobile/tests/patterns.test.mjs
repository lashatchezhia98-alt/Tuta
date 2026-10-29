import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,symptomPatterns} from '../src/cycle.mjs';

const periods=[0,28,56,84].map(offset=>({start:addDays('2026-01-01',offset),duration:5}));
const log=(date,symptoms)=>({date,symptoms});

test('symptom pattern needs three different completed cycles in one phase',()=>{
  const logs=[0,28,56].map(offset=>log(addDays('2026-01-01',offset+2),['cramps']));
  assert.deepEqual(symptomPatterns(periods,logs),[{symptom:'cramps',phase:'menstruation',count:3,total:3}]);
});

test('multiple days in one cycle and current unfinished cycle do not count',()=>{
  const logs=[1,2,3,29,30,85].map(offset=>log(addDays('2026-01-01',offset),['headache']));
  assert.deepEqual(symptomPatterns(periods,logs),[]);
});

test('a symptom in different phases is not a repeating phase pattern',()=>{
  const logs=[1,35,70].map(offset=>log(addDays('2026-01-01',offset),['bloating']));
  assert.deepEqual(symptomPatterns(periods,logs),[]);
});
