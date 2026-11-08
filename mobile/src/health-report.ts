import type { Data as HealthData } from "./types";
import { history, dateKey, phaseForDay, distance } from "./cycle.mjs";

export function healthReport(data: HealthData, today = dateKey()) {
  const end = new Date(today + "T00:00:00Z");
  const monthStart = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 6, 1),
  );
  const lastDay = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  monthStart.setUTCDate(Math.min(end.getUTCDate(), lastDay));
  const from = monthStart.toISOString().slice(0, 10);
  const cycles = history(data.periods.filter((p) => p.start <= today)).filter(
    (p) => p.start >= from,
  );
  const logs = data.logs.filter((l) => l.date >= from && l.date <= today);
  const mean = cycles.length
    ? cycles.reduce((sum, p) => sum + p.length, 0) / cycles.length
    : null;
  const frequency = new Map<string, Set<string>>();
  for (const log of logs)
    for (const symptom of log.symptoms) {
      if (!frequency.has(symptom)) frequency.set(symptom, new Set());
      frequency.get(symptom)!.add(log.date);
    }
  const phaseTotals: Record<string, number> = {
    menstruation: 0,
    follicular: 0,
    ovulation: 0,
    luteal: 0,
    unknown: 0,
  };
  for (const cycle of cycles)
    for (let day = 1; day <= cycle.length; day++)
      phaseTotals[phaseForDay(day, cycle.duration, cycle.length)]++;
  return {
    from,
    today,
    cycles: cycles.map((p) => ({
      ...p,
      irregular: cycles.length >= 3 && Math.abs(p.length - mean!) > 7,
    })),
    mean,
    logs: logs.length,
    days: distance(from, today) + 1,
    symptoms: [...frequency]
      .map(([name, dates]) => ({ name, count: dates.size }))
      .sort((a, b) => b.count - a.count),
    phases: Object.entries(phaseTotals).map(([phase, days]) => ({
      phase,
      days: cycles.length ? days / cycles.length : 0,
    })),
  };
}

export function reminderCalendar(dates: string[]) {
  // All-day events deliberately contain no health details in their title.
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TutaHealth//Reminders//EN",
      "CALSCALE:GREGORIAN",
      ...dates.flatMap((date) => [
        "BEGIN:VEVENT",
        `UID:tuta-checkin-${date}@tutahealth.ge`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${date.replaceAll("-", "")}`,
        "SUMMARY:Tuta check-in",
        "BEGIN:VALARM",
        "TRIGGER:-PT12H",
        "ACTION:DISPLAY",
        "DESCRIPTION:Tuta check-in",
        "END:VALARM",
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ].join("\r\n") + "\r\n"
  );
}
