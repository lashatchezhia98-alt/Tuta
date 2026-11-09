"use client";
import { SiteCopyText } from "@/components/site-copy-provider";
import { useState } from 'react';
import Link from 'next/link';
import {useHealthState} from '@/app/use-health-state';
import {dateKey,addDays} from '../mobile/src/cycle.mjs';
import {pregnancyInput,pregnancyProgress} from '../mobile/src/pregnancy.mjs';
import {useMembership} from '../mobile/src/useMembership';

export default function PregnancyWorkspace({lang}:{lang:'ka'|'en'}){
  const health=useHealthState();
  return <PregnancyAccount key={health.session?.user.id??'guest'} lang={lang} health={health}/>;
}
function PregnancyAccount({lang,health}:{lang:'ka'|'en';health:ReturnType<typeof useHealthState>}){
  const ka=lang==='ka';
  const [dating,setDating]=useState<'dueDate'|'lmp'>('dueDate'),[date,setDate]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const {active:member}=useMembership(health.session?.access_token);
  if(!health.loaded)return <p role="status">{ka?'იტვირთება…':'Loading…'}</p>;
  if(!health.session)return <p><Link href="/login">{ka?'შესვლა / რეგისტრაცია':'Sign in / register'}</Link></p>;
  if(health.error)return <p role="alert">{ka?'ჩანაწერები ვერ ჩაიტვირთა. განაახლე გვერდი.':'Could not load your entries. Reload the page.'}</p>;
  const progress=pregnancyProgress(health.data.pregnancy);
  async function save(stop=false){setBusy(true);setMessage('');try{
    if(stop&&health.data.pregnancy)await health.save({...health.data,pregnancy:{...health.data.pregnancy,active:false,updatedAt:new Date().toISOString()}});
    else {if(!member)throw Error();await health.save({...health.data,pregnancy:pregnancyInput(dating,date)});}
    setMessage(ka?'შენახულია':'Saved');
  }catch{setMessage(ka?'შეამოწმე თარიღი, პრემიუმი და კავშირი. საწყისი შეფასება უნდა იყოს 0–42 კვირის ფარგლებში.':'Check the date, Premium access and connection. Initial dating must be within 0–42 weeks.')}finally{setBusy(false)}}
  return <section className="workspace-card"><h2><SiteCopyText id="pregnancy.title" lang={lang}/></h2>
    <p><SiteCopyText id="pregnancy.intro" lang={lang}/></p>
    {progress&&<><p><SiteCopyText id="pregnancy.active" lang={lang}/></p><h3>{progress.status==='active'?`${progress.weeks} ${ka?'კვირა':'weeks'} + ${progress.extraDays} ${ka?'დღე':'days'}`:(ka?'საჭიროა თარიღებისა და რეჟიმის გადახედვა':'Review your dates and tracking mode')}</h3><p>{ka?'მოსალოდნელი მშობიარობის თარიღი: ':'Estimated due date: '}{progress.dueDate}</p><p>{ka?'წყარო: ':'Source: '}{health.data.pregnancy?.dating==='dueDate'?(ka?'შენ მიერ შეყვანილი თარიღი':'Date you entered'):(ka?'ბოლო მენსტრუაციით გამოთვლილი ვარაუდი':'Last-period calculation')}</p><button disabled={busy} type="button" onClick={()=>{if(confirm(ka?'გამორთო ორსულობის რეჟიმი? ჩანაწერები არ წაიშლება და ახალი პერიოდი ავტომატურად არ დაემატება.':'Turn off pregnancy mode? Records stay saved; no new period will be invented.'))void save(true)}}><SiteCopyText id="pregnancy.stop" lang={lang}/></button></>}
    {!member&&<p>🔒 {member===null?(ka?'პრემიუმის სტატუსი მოწმდება. თუ ვერ ჩაიტვირთა, განაახლე გვერდი.':'Checking Premium status. Reload if unavailable.'):(ka?'ორსულობის მონიტორინგის დაწყება და თარიღის შეცვლა პრემიუმის ფუნქციაა. შენახული რეჟიმის გამორთვა ყოველთვის შეგიძლია.':'Starting tracking and changing dates are Premium features. You can always turn off an existing mode.')} <Link href="/premium">Premium</Link></p>}
    {member&&<form className="workspace-form" onSubmit={e=>{e.preventDefault();void save()}}><label><SiteCopyText id="pregnancy.dating" lang={lang}/><select value={dating} onChange={e=>{setDating(e.target.value as 'dueDate'|'lmp');setDate('')}}><option value="dueDate">{ka?'ექიმის მიერ განსაზღვრული მოსალოდნელი თარიღი':'Clinician-provided due date'}</option><option value="lmp">{ka?'ბოლო მენსტრუაციის პირველი დღე (ვარაუდი)':'First day of last period (estimate)'}</option></select></label><label><SiteCopyText id="pregnancy.date" lang={lang}/><input required type="date" value={date} min={dating==='lmp'?addDays(dateKey(),-294):addDays(dateKey(),-14)} max={dating==='lmp'?dateKey():addDays(dateKey(),280)} onChange={e=>setDate(e.target.value)}/></label><button disabled={busy}><SiteCopyText id="pregnancy.save" lang={lang}/></button></form>}
    <p role="status">{message}</p><p>{ka?'ბოლო მენსტრუაციის მეთოდი იყენებს 280 დღეს და 28-დღიან რეგულარულ ციკლს ვარაუდობს. არარეგულარული ციკლის, გაურკვეველი თარიღის ან IVF-ის შემთხვევაში გამოიყენე ექიმის მიერ განსაზღვრული თარიღი. აპი მას თვითნებურად არ ცვლის.':'Last-period dating adds 280 days and assumes a regular 28-day cycle. For irregular cycles, uncertain dates or IVF, use the date established with your clinician. The app does not automatically redate it.'}</p><a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date">{ka?'გამოთვლის წყარო: ACOG':'Calculation reference: ACOG'}</a>
    <p><Link href="/app/log"><SiteCopyText id="pregnancy.journal" lang={lang}/></Link> · <Link href="/blog?category=pregnancy"><SiteCopyText id="pregnancy.articles" lang={lang}/></Link></p>
  </section>;
}
