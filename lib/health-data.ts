import { ordered, stamp } from "../mobile/src/cycle.mjs";

export type HealthData = {
  version: 1;
  lang: "ka" | "en";
  name: string;
  cycleLength: number;
  periods: { start: string; duration: number }[];
  logs: { date: string; mood: string; energy: number; pain: number; flow: string; symptoms: string[]; notes: string }[];
};

// Validate stored/imported records before any forecast or save. Never repair or
// silently discard someone's health entries when they are malformed.
export function validHealthData(value: unknown): value is HealthData {
  try {
    if (!value || typeof value !== "object") return false;
    const d = value as HealthData;
    if (d.version !== 1 || !["ka", "en"].includes(d.lang) || typeof d.name !== "string"
      || !Number.isInteger(d.cycleLength) || d.cycleLength < 21 || d.cycleLength > 45
      || !Array.isArray(d.periods) || !Array.isArray(d.logs)) return false;
    ordered(d.periods); // Checks real dates, unique starts and period durations.
    if(new Set(d.logs.map(log=>log.date)).size!==d.logs.length)return false;
    return d.logs.every(log => {
      stamp(log.date);
      return typeof log.mood === "string" && typeof log.flow === "string" && typeof log.notes === "string"
        && Array.isArray(log.symptoms) && log.symptoms.every(symptom => typeof symptom === "string")
        && [log.energy, log.pain].every(n => Number.isInteger(n) && n >= 1 && n <= 5);
    });
  } catch { return false; }
}
