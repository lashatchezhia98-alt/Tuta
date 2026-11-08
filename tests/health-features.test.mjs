import test from 'node:test';
import assert from 'node:assert/strict';
import {pregnancyInput,pregnancyProgress,validPregnancy} from '../mobile/src/pregnancy.mjs';
import {forecast,calendarState} from '../mobile/src/cycle.mjs';
import {sourceModule} from './source-loader.mjs';
const {validHealthData}=sourceModule('lib/health-data.ts');
const {validData}=sourceModule('mobile/src/types.ts');
const {sharedHealth,shareScopes}=sourceModule('lib/partner-sharing.ts');
const {doctorEnrollment}=sourceModule('lib/doctor-enrollment.ts');
const state={version:1,lang:'ka',name:'PRIVATE NAME',cycleLength:28,periods:['2026-01-01','2026-01-29','2026-02-26','2026-03-26','2026-04-23'].map(start=>({start,duration:5})),logs:[{date:'2026-04-24',mood:'calm',energy:3,pain:2,flow:'light',symptoms:['PRIVATE SYMPTOM'],notes:'PRIVATE NOTE'}]};

test('pregnancy: LMP adds exactly 280 days, clinician due date is preserved',()=>{
 const p=pregnancyInput('lmp','2024-02-29','2024-03-07');
 assert.deepEqual(pregnancyProgress(p,'2024-03-07'),{dueDate:'2024-12-05',days:7,weeks:1,extraDays:0,daysUntilDue:273,status:'active'});
 const manual=pregnancyInput('dueDate','2026-12-31','2026-11-08');
 assert.equal(pregnancyProgress(manual,'2026-11-08').dueDate,'2026-12-31');
 assert.equal(pregnancyProgress({...manual,active:false},'2026-11-08'),null);
 assert.equal(pregnancyProgress(manual,'2027-01-16').status,'review');
 assert.equal(manual.date,'2026-12-31');
});
test('pregnancy rejects impossible dates and initial dating outside 0–42 weeks',()=>{
 for(const args of [['lmp','2026-02-30','2026-03-01'],['lmp','2026-11-09','2026-11-08'],['dueDate','2027-12-31','2026-11-08'],['lmp','2020-01-01','2026-11-08'],['other','2026-01-01','2026-11-08']])assert.throws(()=>pregnancyInput(...args));
 assert.equal(validPregnancy({active:true,dating:'lmp',date:'2026-01-01',updatedAt:'bad'}),false);
 assert.equal(validPregnancy(null),true);
});
test('pregnancy pauses predictions without inventing periods or removing known bleeding',()=>{
 const original=structuredClone(state.periods);
 const f=forecast(state.periods,28,'2026-04-25',true);
 assert.equal(f.status,'pregnancy');assert.equal(f.expected,null);assert.deepEqual(f.starts,[]);assert.equal(f.fertilityAvailable,false);
 assert.equal(forecast([],28,'2026-04-25',true).expected,null);
 assert.equal(calendarState(state.periods,28,'2026-05-21','2026-04-25',true),'');
 assert.equal(calendarState(state.periods,28,'2026-04-24','2026-04-25',true),'period');
 assert.deepEqual(state.periods,original);
});
test('web/mobile validation agree and remain backwards compatible',()=>{
 const pregnancy=pregnancyInput('lmp','2026-04-23','2026-04-25');
 for(const validate of [validHealthData,validData]){
  assert.equal(validate(state),true);assert.equal(validate({...state,pregnancy}),true);
  assert.equal(validate({...state,pregnancy:{...pregnancy,active:'yes'}}),false);
  assert.equal(validate({...state,periods:[{start:'2026-02-30',duration:5}]}),false);
  assert.equal(validate({...state,logs:[...state.logs,...state.logs]}),false);
 }
});
test('partner projection returns only consented dates; never names, notes or symptoms',()=>{
 assert.throws(()=>shareScopes({cycle:false,pregnancy:false}));
 assert.throws(()=>shareScopes({cycle:'true',pregnancy:false}));
 assert.deepEqual(shareScopes({cycle:true,pregnancy:false,logs:true}),{cycle:true,pregnancy:false});
 const projected=sharedHealth(state,{cycle:true,pregnancy:false},'2026-04-25');
 assert.equal(projected.cycle.periods.length,4);assert.equal(projected.cycle.periods[0].start,'2026-01-29');
 assert.equal(projected.pregnancy,null);assert.doesNotMatch(JSON.stringify(projected),/PRIVATE|notes|symptoms|name|logs/);
 assert.equal(sharedHealth(state,{cycle:true,pregnancy:false},'2026-02-01').cycle.periods.length,2);
 const pregnant={...state,pregnancy:pregnancyInput('lmp','2026-04-23','2026-04-25')};
 assert.deepEqual(sharedHealth(pregnant,{cycle:true,pregnancy:false}),{cycle:null,pregnancy:null});
 const summary=sharedHealth(pregnant,{cycle:false,pregnancy:true});assert.equal(summary.cycle,null);assert.equal(summary.pregnancy.date,'2026-04-23');
});
test('doctor registration requires real fields and explicit consent, normalizes email',()=>{
 const input={email:' Doctor@Example.com ',first_name:'ნინო',last_name:'მაისურაძე',specialty:'გინეკოლოგი',bio:'აღწერა',license_reference:'CERT-123',consent_confirmed:true};
 assert.equal(doctorEnrollment(input).email,'doctor@example.com');
 for(const invalid of [{consent_confirmed:false},{consent_confirmed:'true'},{license_reference:''},{specialty:''},{email:'bad'},{first_name:'ა'}])assert.throws(()=>doctorEnrollment({...input,...invalid}));
 assert.equal('password' in doctorEnrollment(input),false);
});
