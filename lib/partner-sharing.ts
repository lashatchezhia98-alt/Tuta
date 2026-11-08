import { validHealthData } from './health-data';
import { dateKey } from '../mobile/src/cycle.mjs';

export type ShareScopes = {cycle:boolean;pregnancy:boolean};
export function shareScopes(value:unknown):ShareScopes {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid scopes');
  const s=value as ShareScopes;
  if(typeof s.cycle!=='boolean'||typeof s.pregnancy!=='boolean'||(!s.cycle&&!s.pregnancy))throw new Error('Choose what to share');
  return {cycle:s.cycle,pregnancy:s.pregnancy};
}
// This projection is the ONLY health payload a partner endpoint may return.
// No names, emails, journal entries, notes or symptoms leave this boundary.
export function sharedHealth(payload:unknown, scopes:ShareScopes, today=dateKey()) {
  if(!validHealthData(payload))throw new Error('Invalid health state');
  return {
    cycle:scopes.cycle&&!payload.pregnancy?.active ? {cycleLength:payload.cycleLength,periods:payload.periods.filter(p=>p.start<=today).sort((a,b)=>a.start.localeCompare(b.start)).slice(-4).map(p=>({start:p.start,duration:p.duration}))} : null,
    pregnancy:scopes.pregnancy&&payload.pregnancy?.active ? {active:true,dating:payload.pregnancy.dating,date:payload.pregnancy.date,updatedAt:payload.pregnancy.updatedAt} : null,
  };
}
