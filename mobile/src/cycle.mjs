// Date-only arithmetic uses UTC to avoid DST and timezone shifts.
const DAY = 86400000;
export function monthLabel(date, ka) {
  const names=ka?['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი']:['January','February','March','April','May','June','July','August','September','October','November','December'];
  return names[date.getMonth()];
}
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
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
export function forecast(periods, fallback, asOf=dateKey()) {
  stamp(asOf);
  const recorded=ordered(periods).filter(p=>p.start<=asOf);
  const avg=averages(recorded,fallback);
  const last=recorded.at(-1);
  const lengths=avg.completed.map(p=>p.length);
  const sufficient=lengths.length>=3;
  const irregular=sufficient&&lengths.some(n=>Math.abs(n-avg.length)>7);
  const spread=sufficient?Math.max(...lengths)-Math.min(...lengths):0;
  const reliability=!sufficient?'limited':irregular||spread>7||avg.length<21||avg.length>45?'low':'consistent';
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
export function calendarState(periods, fallback, date, asOf=dateKey()) {
  stamp(date);
  const recorded=ordered(periods).filter(p=>p.start<=asOf);
  const known=date<=asOf&&recorded.some(p=>date>=p.start && date<addDays(p.start,p.duration));
  if(known)return 'period';
  const current=cycleAt(recorded,fallback,date,asOf);
  if(!current)return '';
  const model=forecast(recorded,fallback,asOf);
  if(date>=asOf){
    if(model.status==='overdue')return '';
    const length=Math.round(model.averageLength);
    const offset=distance(current.start,date)%length;
    const boundary=Math.floor(distance(current.start,date)/length);
    if(boundary>=1&&boundary<=6&&offset<Math.round(model.averageDuration))return 'predicted';
    const ov=length-14;
    if(model.fertilityAvailable&&boundary<=6&&offset>=ov-5&&offset<=ov+1)return 'fertile';
    return '';
  }
  // Fertility is never presented as a recorded biological event in the past.
  return '';
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
