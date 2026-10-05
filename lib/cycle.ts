export type CyclePhase = "menstruation" | "follicular" | "ovulation" | "luteal";

export type CycleSettings = { startDate: string; cycleLength: number; periodDuration: number };

const day = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
  d.setHours(12, 0, 0, 0);
  return d;
};

export function addDays(value: string | Date, amount: number) { const d = day(value); d.setDate(d.getDate() + amount); return d; }
export function isoDate(value: Date) { return value.toISOString().slice(0, 10); }

export function getCycle(startDate: string, cycleLength = 28, periodDuration = 5) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(day(startDate).getTime())) throw new Error("Invalid start date");
  if (!Number.isInteger(cycleLength) || cycleLength < 21 || cycleLength > 45) throw new Error("Cycle length must be 21–45 days");
  if (!Number.isInteger(periodDuration) || periodDuration < 1 || periodDuration > 10 || periodDuration >= cycleLength) throw new Error("Invalid period duration");
  const nextPeriod = addDays(startDate, cycleLength);
  const ovulation = addDays(nextPeriod, -14);
  return {
    startDate, periodEnd: isoDate(addDays(startDate, periodDuration - 1)),
    nextPeriod: isoDate(nextPeriod), ovulation: isoDate(ovulation),
    fertileStart: isoDate(addDays(ovulation, -5)), fertileEnd: isoDate(addDays(ovulation, 1)),
    cycleLength, periodDuration,
  };
}

export function cycleDayFor(date: string, startDate: string) { return Math.floor((day(date).getTime() - day(startDate).getTime()) / 86400000) + 1; }
export function phaseForCycleDay(cycleDay: number, periodDuration: number, cycleLength: number) {
  const ovulationDay = cycleLength - 14;
  if (cycleDay <= periodDuration) return "menstruation" as CyclePhase;
  if (cycleDay < ovulationDay - 1) return "follicular" as CyclePhase;
  if (cycleDay <= ovulationDay + 1) return "ovulation" as CyclePhase;
  return "luteal" as CyclePhase;
}

export function getCurrentCycle(settings: CycleSettings, today = new Date()) {
  const base = getCycle(settings.startDate, settings.cycleLength, settings.periodDuration);
  const cycleDay = Math.max(1, Math.min(settings.cycleLength, cycleDayFor(isoDate(today), settings.startDate)));
  return { ...base, cycleDay, phase: phaseForCycleDay(cycleDay, settings.periodDuration, settings.cycleLength) };
}
