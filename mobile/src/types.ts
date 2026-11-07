export type Lang = 'ka' | 'en';
export type Tab = 'home' | 'cycle' | 'calendar' | 'log' | 'insights' | 'profile' | 'about' | 'blog' | 'premium' | 'privacy' | 'terms' | 'journey';
export type Period = {start:string; duration:number};
export type Log = {date:string; mood:string; energy:number; pain:number; flow:string; symptoms:string[]; notes:string};
export type Data = {version:1; lang:Lang; name:string; cycleLength:number; periods:Period[]; logs:Log[]};
export const emptyData:Data={version:1,lang:'ka',name:'',cycleLength:28,periods:[],logs:[]};
export function validData(v:unknown):v is Data {
  if(!v||typeof v!=='object')return false;
  const d=v as Data;
  return d.version===1 && ['ka','en'].includes(d.lang) && typeof d.name==='string' && Number.isInteger(d.cycleLength) && d.cycleLength>=21 && d.cycleLength<=45 && Array.isArray(d.periods) && d.periods.every(p=>typeof p.start==='string'&&Number.isInteger(p.duration)&&p.duration>=1&&p.duration<=10) && Array.isArray(d.logs) && d.logs.every(l=>typeof l.date==='string'&&typeof l.mood==='string'&&typeof l.flow==='string'&&typeof l.notes==='string'&&Array.isArray(l.symptoms)&&l.symptoms.every(s=>typeof s==='string')&&[l.energy,l.pain].every(n=>Number.isInteger(n)&&n>=1&&n<=5));
}
