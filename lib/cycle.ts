import { addDays as shiftDate, dateKey, distance, phaseForDay, stamp } from "../mobile/src/cycle.mjs";

export type CyclePhase = "menstruation" | "follicular" | "ovulation" | "luteal" | "unknown";
export type CycleSettings = { startDate: string; cycleLength: number; periodDuration: number };

// Calendar dates must not change when the user's timezone or DST changes.
export function isoDate(value: Date) {
  if (!Number.isFinite(value.getTime())) throw new Error("Invalid date");
  return dateKey(value);
}
export function addDays(value: string | Date, amount: number) {
  const shifted = shiftDate(typeof value === "string" ? value : isoDate(value), amount);
  return new Date(shifted + "T12:00:00");
}
export function getCycle(startDate: string, cycleLength = 28, periodDuration = 5) {
  stamp(startDate);
  if (!Number.isInteger(cycleLength) || cycleLength < 21 || cycleLength > 45) throw new Error("Cycle length must be 21–45 days");
  if (!Number.isInteger(periodDuration) || periodDuration < 1 || periodDuration > 10 || periodDuration >= cycleLength) throw new Error("Invalid period duration");
  const nextPeriod = shiftDate(startDate, cycleLength);
  const ovulation = shiftDate(nextPeriod, -14);
  return {
    startDate,
    // Inclusive last bleeding day; not the exclusive end boundary.
    periodEnd: shiftDate(startDate, periodDuration - 1),
    nextPeriod, ovulation,
    fertileStart: shiftDate(ovulation, -5), fertileEnd: shiftDate(ovulation, 1),
    cycleLength, periodDuration,
  };
}
export function cycleDayFor(date: string, startDate: string) { return distance(startDate, date) + 1; }
export function phaseForCycleDay(day: number, duration: number, length: number): CyclePhase {
  return phaseForDay(day, duration, length);
}
export function getCurrentCycle(settings: CycleSettings, today = new Date()) {
  const base = getCycle(settings.startDate, settings.cycleLength, settings.periodDuration);
  const cycleDay = cycleDayFor(isoDate(today), settings.startDate);
  return { ...base, cycleDay, overdue: isoDate(today) > base.nextPeriod,
    phase: phaseForCycleDay(cycleDay, settings.periodDuration, settings.cycleLength) };
}
