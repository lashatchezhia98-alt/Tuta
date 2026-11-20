// Date-only arithmetic uses UTC to avoid DST and timezone shifts.
const DAY = 86400000;
export function monthLabel(date, ka) {
  const names=ka?['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი']:['January','February','March','April','May','June','July','August','September','October','November','December'];
  return names[date.getMonth()];
}
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
// Use the same calendar day for account forecasts, even when devices are in different zones.
const accountCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function predictionDateKey(now = new Date()) {
  const parts = Object.fromEntries(accountCalendar.formatToParts(now).map(({type,value})=>[type,value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function stamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date');
  const result = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0,10) !== value) throw new Error('Invalid date');
  return result;
}
export function addDays(value, days) {
  if (!Number.isInteger(days)) throw new Error('Days must be an integer');
  return new Date(stamp(value) + days * DAY).toISOString().slice(0,10);
}
export function distance(a, b) { return Math.round((stamp(b) - stamp(a)) / DAY); }
export function phaseForDay(day, duration, length) {
  if (!Number.isInteger(day) || day < 1 || day > length) return 'unknown';
  const ovulationDay = length - 13; // Date offset is zero-based, cycle day is one-based.
  if (day <= duration) return 'menstruation';
  // Keep unusual observed intervals, but do not assign calculated hormonal phases.
  if (length < 21 || length > 45) return 'unknown';
  if (Math.abs(day - ovulationDay) <= 1) return 'ovulation';
  return day < ovulationDay - 1 ? 'follicular' : 'luteal';
}
export function validBirthDate(value, today = dateKey()) {
  try {
    stamp(value);stamp(today);
    const age = Number(today.slice(0,4))-Number(value.slice(0,4))-(today.slice(5)<value.slice(5)?1:0);
    return age>=1 && age<=120 && value<=today;
  } catch { return false; }
}
export function validSetup(start, length, duration, today = dateKey()) {
  try { return stamp(start) <= stamp(today) && Number.isInteger(length) && length >= 21 && length <= 45 && Number.isInteger(duration) && duration >= 1 && duration <= 10; } catch { return false; }
}
export function periodFromSelectedDays(days, today = dateKey()) {
  const sorted = [...new Set(days)].sort();
  if (!sorted.length || sorted.length > 10 || sorted.at(-1) > today) return null;
  try {
    const start = sorted[0];
    if (!sorted.every((day, index) => day === addDays(start, index))) return null;
    return { start, duration: sorted.length };
  } catch {
    return null;
  }
}
export function periodDaysBetween(a, b, today = dateKey()) {
  const [start, end] = [a, b].sort();
  try {
    const span = distance(start, end);
    if (span < 0 || span > 9 || end > today) return null;
    return Array.from({ length: span + 1 }, (_, i) => addDays(start, i));
  } catch { return null; }
}
export function selectPeriodDay(days, anchor, day, today = dateKey()) {
  if (!periodDaysBetween(day, day, today)) return { days, anchor };
  if (days.includes(day)) return { days: days.filter(value => value !== day), anchor: null };
  const span = anchor && days.includes(anchor) ? periodDaysBetween(anchor, day, today) : null;
  if (span) return { days: [...new Set([...days, ...span])], anchor: null };
  return { days: [...days, day], anchor: day };
}
// The history picker can collect separate bleeding runs across months.
export function periodsFromHistorySelection(days, existing, editingStart, today = dateKey()) {
  const selected = [...new Set(days)].sort();
  const runs = [];
  if (!selected.length) return { error: 'selection' };
  try {
    for (const day of selected) {
      stamp(day);
      if (day > today) return { error: 'selection' };
      const last = runs.at(-1);
      if (last && day === addDays(last.start, last.duration)) {
        if (++last.duration > 10) return { error: 'selection' };
      } else runs.push({ start: day, duration: 1 });
    }
    const edited = existing.find(p => p.start === editingStart);
    const intersects = (a, b) => a.start < addDays(b.start, b.duration) && b.start < addDays(a.start, a.duration);
    const periods = edited && runs.some(run => intersects(run, edited))
      ? existing.filter(p => p.start !== editingStart) : [...existing];
    let start;
    for (const run of runs) {
      let merged = run;
      // Importing history is additive: keep dates already saved, and combine
      // only intersecting entries. An explicitly edited entry was removed above.
      for (let index = 0; index < periods.length;) {
        const saved = periods[index];
        if (!intersects(merged, saved)) { index++; continue; }
        const first = saved.start < merged.start ? saved.start : merged.start;
        const savedEnd = addDays(saved.start, saved.duration);
        const mergedEnd = addDays(merged.start, merged.duration);
        const duration = distance(first, savedEnd > mergedEnd ? savedEnd : mergedEnd);
        if (duration > 10) return { error: 'selection' };
        merged = { start: first, duration };
        periods.splice(index, 1);
        index = 0;
      }
      periods.push(merged);
      start = merged.start;
    }
    return { periods: ordered(periods), start };
  } catch {
    return { error: 'selection' };
  }
}
// Preview the actual entries affected by the same transaction that will save them.
export function periodSelectionReview(days, existing, editingStart, today = predictionDateKey()) {
  const result = periodsFromHistorySelection(days, existing, editingStart, today);
  const selected = new Set(days);
  const entries = result.periods?.filter(period =>
    Array.from({ length: period.duration }, (_, index) => addDays(period.start, index)).some(day => selected.has(day))
  ) ?? [];
  return { ...result, entries };
}

export function calendarDateLabel(date, ka, year = false) {
  return new Intl.DateTimeFormat(ka ? 'ka-GE' : 'en-GB', {
    day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC',
  }).format(new Date(stamp(date)));
}

export function calendarRangeLabel(start, end, ka, year = false) {
  return start === end ? calendarDateLabel(start, ka, year)
    : `${calendarDateLabel(start, ka, year && start.slice(0, 4) !== end.slice(0, 4))} – ${calendarDateLabel(end, ka, year)}`;
}
export function ordered(periods) {
  const sorted = [...periods].sort((a,b)=>a.start.localeCompare(b.start));
  sorted.forEach((p,i)=>{
    stamp(p.start);
    if(!Number.isInteger(p.duration)||p.duration<1||p.duration>10)throw new Error('Invalid period duration');
    if(i&&sorted[i-1].start===p.start)throw new Error('Duplicate period start');
  });
  return sorted;
}
// Close start dates are allowed; only overlapping recorded bleeding is blocked.
export function overlapsPeriod(periods, candidate, replacingStart = candidate.start) {
  ordered([candidate]);
  const end = addDays(candidate.start, candidate.duration);
  return ordered(periods).some(p => p.start !== replacingStart && candidate.start < addDays(p.start, p.duration) && end > p.start);
}
export function history(periods) {
  const sorted = ordered(periods);
  return sorted.slice(0,-1).map((p,i)=>({...p, length:distance(p.start,sorted[i+1].start)}));
}
export function averages(periods, fallback) {
  if(!Number.isInteger(fallback)||fallback<21||fallback>45)throw new Error('Invalid average cycle length');
  const completed = history(periods);
  return {
    length: completed.length >= 3 ? completed.reduce((s,p)=>s+p.length,0)/completed.length : fallback,
    duration: completed.length >= 3 ? completed.reduce((s,p)=>s+p.duration,0)/completed.length : (ordered(periods).at(-1)?.duration ?? 5),
    completed,
  };
}
export function cycleAt(periods, fallback, date = dateKey(), asOf = dateKey()) {
  stamp(date);stamp(asOf);
  const sorted = ordered(periods).filter(p=>p.start<=date&&p.start<=asOf);
  const base = sorted.at(-1);
  if (!base) return null;
  const avg = averages(sorted, fallback);
  const length = Math.round(avg.length), duration = base.duration;
  const day = distance(base.start,date)+1;
  const next = addDays(base.start,length), ovulation = addDays(next,-14);
  const fertileStart = addDays(ovulation,-5), fertileEnd=addDays(ovulation,1);
  const phase=phaseForDay(day,duration,length);
  return {day,phase,next,ovulation,fertileStart,fertileEnd,overdue:distance(next,date)>0,length,duration,start:base.start};
}
export function forecast(periods, fallback, asOf=predictionDateKey(), pregnancyActive=false) {
  stamp(asOf);
  const recorded=ordered(periods).filter(p=>p.start<=asOf);
  const avg=averages(recorded,fallback);
  const last=recorded.at(-1);
  const lengths=avg.completed.map(p=>p.length);
  const sufficient=lengths.length>=3;
  const irregular=sufficient&&lengths.some(n=>Math.abs(n-avg.length)>7);
  const spread=sufficient?Math.max(...lengths)-Math.min(...lengths):0;
  const reliability=!sufficient?'limited':irregular||spread>7||avg.length<21||avg.length>45?'low':'consistent';
  if(pregnancyActive)return {status:'pregnancy',source:sufficient?'history':'manual',reliability,irregular,expected:null,earliest:null,latest:null,starts:[],fertilityAvailable:false,averageLength:avg.length,averageDuration:avg.duration,completed:lengths.length};
  if(!last)return {status:'empty',source:'manual',reliability:'limited',irregular:false,expected:null,earliest:null,latest:null,starts:[],fertilityAvailable:false,averageLength:avg.length,averageDuration:avg.duration,completed:0};
  const length=Math.round(avg.length);
  const expected=addDays(last.start,length);
  const status=asOf>expected?'overdue':'active';
  return {
    status,source:sufficient?'history':'manual',reliability,irregular,
    expected,
    // Observed historical spread, not a calibrated probability/confidence interval.
    earliest:sufficient?addDays(last.start,Math.min(...lengths)):null,
    latest:sufficient?addDays(last.start,Math.max(...lengths)):null,
    starts:status==='overdue'?[]:Array.from({length:6},(_,i)=>addDays(last.start,length*(i+1))),
    fertilityAvailable:status==='active'&&sufficient&&reliability==='consistent'&&length>=21&&length<=45&&last.duration<length-13&&Math.round(avg.duration)<length-13,
    averageLength:avg.length,averageDuration:avg.duration,completed:lengths.length,
  };
}

/** @param {{periods: {start: string, duration: number}[], cycleLength: number, logs?: {date: string, flow: string, sexualActivity?: string}[], pregnancy?: {active: boolean}}} data */
export function periodCalendarModel({ periods, cycleLength, logs = [], pregnancy }, today = predictionDateKey()) {
  const model = forecast(periods, cycleLength, today, pregnancy?.active);
  const duration = Math.round(model.averageDuration);
  const windows = model.starts.map(start => ({ start, end: addDays(start, duration - 1) }));
  const logByDate = new Map(logs.filter(log => log.date <= today).map(log => [log.date, log]));
  const recorded = ordered(periods).filter(p => p.start <= today);
  const fertileWindows = model.fertilityAvailable ? [recorded.at(-1).start, ...model.starts].map(start => {
    const ovulation = addDays(start, Math.round(model.averageLength) - 14);
    return { start: addDays(ovulation, -5), end: addDays(ovulation, 1), ovulation };
  }).filter(window => window.end >= today) : [];
  const recent = windows.length ? history(recorded).slice(-6) : [];
  // A date without a flow entry is not evidence of a light day.
  const heavierOffsets = windows.length ? new Set(Array.from({ length: duration }, (_, offset) => {
    const flows = recent.filter(p => offset < p.duration)
      .map(p => logByDate.get(addDays(p.start, offset))?.flow)
      .filter(flow => ['none', 'spotting', 'light', 'medium', 'heavy'].includes(flow));
    return flows.length >= 3 && flows.filter(flow => flow === 'heavy').length * 3 >= flows.length * 2
      ? offset : -1;
  })) : new Set();
  const nextFertile = fertileWindows[0];
  return {
    ...model, today, windows, nextWindow: windows[0] ?? null,
    nextFertileWindow: nextFertile ? { start: nextFertile.start < today ? today : nextFertile.start, end: nextFertile.end } : null,
    day(date) {
      stamp(date);
      const window = windows.find(w => date >= w.start && date <= w.end);
      const fertility = date >= today && fertileWindows.find(w => date >= w.start && date <= w.end);
      const state = date <= today && recorded.some(p => date >= p.start && date < addDays(p.start, p.duration)) ? 'period'
        : window ? 'predicted' : fertility ? 'fertile' : '';
      const log = logByDate.get(date);
      return {
        state,
        today: date === today,
        ovulation: state === 'fertile' && !!fertility && fertility.ovulation === date,
        journal: !!log,
        expectedEnd: window?.end === date,
        expectedHeavy: !!window && heavierOffsets.has(distance(window.start, date)),
        heavy: log?.flow === 'heavy',
        activity: ['protected', 'unprotected', 'unspecified'].includes(log?.sexualActivity),
      };
    },
  };
}

/** @param {boolean} ka
 * @returns {{key: 'heavy'|'expectedHeavy'|'expectedEnd'|'activity', symbol: string, label: string}[]} */
export function periodDayMarkers(ka) {
  return [
    { key: 'heavy', symbol: '●', label: ka ? 'ჩაწერილი ძლიერი სისხლდენა' : 'Recorded heavy flow' },
    { key: 'expectedHeavy', symbol: '◉', label: ka ? 'სავარაუდო ძლიერი სისხლდენა' : 'Estimated heavier flow' },
    { key: 'expectedEnd', symbol: '–', label: ka ? 'პერიოდის სავარაუდო ბოლო დღე' : 'Estimated last day' },
    { key: 'activity', symbol: '♥', label: ka ? 'ჩაწერილი სქესობრივი აქტივობა' : 'Sexual activity logged' },
  ];
}

export const calendarColors = { period: '#F8DCE6', predicted: '#A64065', fertile: '#4F8267' };

export function periodCalendarLegend(ka, marking = false) {
  return [
    { key: 'period', label: ka ? 'ჩაწერილი პერიოდი' : 'Recorded period' },
    { key: 'predicted', label: ka ? 'მოსალოდნელი პერიოდი' : 'Estimated period' },
    { key: 'fertile', label: ka ? 'სავარაუდო ნაყოფიერი დღეები' : 'Estimated fertile days' },
    { key: 'ovulation', symbol: '◆', label: ka ? 'სავარაუდო ოვულაცია' : 'Estimated ovulation' },
    { key: 'journal', symbol: '•', label: ka ? 'დღიურის ჩანაწერი' : 'Journal entry' },
    { key: 'today', label: ka ? 'დღეს' : 'Today' },
    ...(marking ? [{ key: 'draft', symbol: '✓', label: ka ? 'მონიშნულია, ჯერ შეუნახავია' : 'Selected, not yet saved' }] : []),
    ...periodDayMarkers(ka),
  ];
}

export function periodDayLabel(day, date, ka, marked = false) {
  const descriptions = periodCalendarLegend(ka, marked).filter(({ key }) =>
    day.state === key || key === 'draft' || (key in day && day[key])
  );
  return [date, ...descriptions.map(marker => marker.label)].join(', ');
}

export function calendarState(periods, fallback, date, asOf=dateKey(), pregnancyActive=false) {
  return periodCalendarModel({ periods, cycleLength: fallback, pregnancy: { active: pregnancyActive } }, asOf).day(date).state;
}
export function predictions(periods, fallback, asOf=dateKey()) {
  return forecast(periods,fallback,asOf).starts;
}

// Count a symptom only once per completed cycle and phase. Daily repeats in one
// cycle must not look like a recurring pattern across several cycles.
export function symptomPatterns(periods, logs) {
  const completed=history(periods);
  const seen=new Map();
  for (const [index, period] of completed.entries()) {
    const next=addDays(period.start,period.length);
    for (const log of logs) {
      if(log.date<period.start||log.date>=next)continue;
      const day=distance(period.start,log.date)+1;
      const phase=phaseForDay(day,period.duration,period.length);
      if (phase === 'unknown') continue;
      for(const symptom of new Set(log.symptoms)) {
        const key=`${symptom}\u0000${phase}`;
        if(!seen.has(key))seen.set(key,new Set());
        seen.get(key).add(index);
      }
    }
  }
  return [...seen.entries()].filter(([,cycles])=>cycles.size>=3).map(([key,cycles])=>{
    const [symptom,phase]=key.split('\u0000');
    return {symptom,phase,count:cycles.size,total:completed.length};
  }).sort((a,b)=>b.count-a.count||a.symptom.localeCompare(b.symptom));
}
