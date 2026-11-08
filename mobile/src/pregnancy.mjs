import { addDays, dateKey, distance, stamp } from './cycle.mjs';

export function validPregnancy(value) {
  if (value == null) return true;
  try {
    if (typeof value !== 'object' || Array.isArray(value) || typeof value.active !== 'boolean' || !['lmp','dueDate'].includes(value.dating)) return false;
    stamp(value.date);
    return typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt));
  } catch { return false; }
}

export function pregnancyProgress(value, today = dateKey()) {
  stamp(today);
  if (!value?.active || !validPregnancy(value)) return null;
  const dueDate = value.dating === 'dueDate' ? value.date : addDays(value.date,280);
  const start = addDays(dueDate,-280);
  const days = distance(start,today);
  return {dueDate,days,weeks:Math.floor(days/7),extraDays:days%7,daysUntilDue:distance(today,dueDate),status:days<0?'future':days>294?'review':'active'};
}

export function pregnancyInput(dating, date, today=dateKey()) {
  if (!['lmp','dueDate'].includes(dating)) throw new Error('Invalid dating method');
  stamp(date);stamp(today);
  const days=distance(dating==='lmp'?date:addDays(date,-280),today);
  // A form guard, not a diagnostic threshold. No silent clamping/redating.
  if(days<0||days>294)throw new Error('Review pregnancy dates');
  return {active:true,dating,date,updatedAt:new Date().toISOString()};
}
