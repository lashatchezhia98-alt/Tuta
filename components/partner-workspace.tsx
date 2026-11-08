"use client";
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useHealthState} from '@/app/use-health-state';
import {forecast} from '../mobile/src/cycle.mjs';
import {pregnancyProgress} from '../mobile/src/pregnancy.mjs';
import {sharedHealth} from '@/lib/partner-sharing';
import {useSiteFeatures} from '@/lib/site-features';

type Scopes={cycle:boolean;pregnancy:boolean};
type Outgoing={id:string;label:string;scopes:Scopes;expires_at:string;accepted_at:string|null;revoked_at:string|null};
type Incoming={id:string;label:string;available:boolean;summary:ReturnType<typeof sharedHealth>|null};
type State={outgoing:Outgoing[];incoming:Incoming[];premium:boolean};
export default function PartnerWorkspace({lang}:{lang:'ka'|'en'}){
  const health=useHealthState();
  return <PartnerAccount key={health.session?.user.id??'guest'} lang={lang} health={health}/>;
}
function PartnerAccount({lang,health}:{lang:'ka'|'en';health:ReturnType<typeof useHealthState>}){
  const ka=lang==='ka',token=health.session?.access_token;
  const enabled=useSiteFeatures().partners;
  const [snapshot,setSnapshot]=useState<{token:string;data:State;receivedAt:number}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[label,setLabel]=useState(''),[scopes,setScopes]=useState<Scopes>({cycle:false,pregnancy:false}),[invite,setInvite]=useState(''),[link,setLink]=useState('');
  const data=snapshot&&snapshot.token===token?snapshot.data:null;
  useEffect(()=>{const fragment=new URLSearchParams(window.location.hash.slice(1));const code=fragment.get('invite');if(code){const timer=setTimeout(()=>setInvite(code),0);history.replaceState(null,'',window.location.pathname);return()=>clearTimeout(timer)}},[]);
  const load=useCallback(async(signal?:AbortSignal)=>{
    if(!token)return;try{const r=await fetch('/api/partners',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});const body=await r.json();if(!r.ok)throw Error(body.error);if(!signal?.aborted){setSnapshot({token,data:body,receivedAt:Date.now()});setError('')}}catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Error')}
  },[token]);
  useEffect(()=>{const controller=new AbortController();const initial=setTimeout(()=>void load(controller.signal),0);const timer=setInterval(()=>{if(document.visibilityState==='visible')void load(controller.signal)},15000);return()=>{controller.abort();clearTimeout(initial);clearInterval(timer)}},[load]);
  async function action(body:Record<string,unknown>){if(!token)return;if(!enabled&&['invite','accept'].includes(String(body.action))){setError(ka?'ახალი გაზიარებები დროებით შეჩერებულია. არსებულის გაუქმება შეგიძლია.':'New sharing is paused. Existing sharing can still be revoked.');return}setBusy(true);setError('');try{
    const r=await fetch('/api/partners',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);
    if(d.token)setLink(`${window.location.origin}/app/partners#invite=${d.token}`);
    if(body.action==='accept')setInvite('');await load();
  }catch(e){setError(e instanceof Error?e.message:'Error')}finally{setBusy(false)}}
  if(!health.loaded)return <p role="status">{ka?'იტვირთება…':'Loading…'}</p>;
  if(!health.session)return <p>{ka?'მოწვევის მისაღებად შედი ანგარიშში, შემდეგ თავიდან გახსენი მოწვევის ბმული.':'Sign in, then reopen the invitation link to accept it.'} <Link href="/login">{ka?'შესვლა':'Sign in'}</Link></p>;
  const preview=!health.error&&(scopes.cycle||scopes.pregnancy)?sharedHealth(health.data,scopes):null;
  return <div><section className="workspace-card"><h2>{ka?'პარტნიორთან გაზიარება':'Partner sharing'}</h2>
    {!enabled&&<p role="status">{ka?'ახალი გაზიარებები შეჩერებულია; არსებული გაზიარებების ნახვა, გაუქმება და გასვლა ხელმისაწვდომია.':'New sharing is paused; viewing, revoking and leaving existing shares remain available.'}</p>}
    <p>{ka?'არაფერი ზიარდება ავტომატურად. შეგიძლია გააზიარო მხოლოდ ბოლო 4 პერიოდის თარიღები/ხანგრძლივობა ან ორსულობის დათარიღება. დღიური, სიმპტომები, შენიშვნები და ელფოსტა არ გაზიარდება.':'Nothing is shared automatically. Choose the last 4 period dates/durations or pregnancy dating only. Journal entries, symptoms, notes and email are never shared.'}</p>
    {error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={()=>void load()}>{ka?'განახლება':'Refresh'}</button>
    {!data&&<p role="status">{ka?'გაზიარებები ჯერ არ ჩაიტვირთა.':'Shares have not loaded yet.'}</p>}
    {data&&!data.premium&&<p>🔒 {ka?'მოწვევის შექმნას აქტიური პრემიუმი სჭირდება. მოწვევის მიღება, გასვლა და საკუთარი გაზიარების გაუქმება უფასოდ შეგიძლია.':'Creating invitations requires Premium. Receiving invitations, leaving and revoking your own shares do not.'} <Link href="/premium">Premium</Link></p>}
    {data?.premium&&<form className="workspace-form" onSubmit={e=>{e.preventDefault();void action({action:'invite',label,scopes})}}><label>{ka?'ამ გაზიარების სახელი':'Label for this share'}<input required maxLength={60} value={label} onChange={e=>setLabel(e.target.value)}/></label><label><input type="checkbox" checked={scopes.cycle} onChange={e=>setScopes({...scopes,cycle:e.target.checked})}/>{ka?'ბოლო 4 პერიოდის დაწყება, სისხლდენის დღეების რაოდენობა და საწყისი ციკლის ხანგრძლივობა':'Last 4 period starts, bleeding duration and initial cycle length'}</label><label><input type="checkbox" checked={scopes.pregnancy} onChange={e=>setScopes({...scopes,pregnancy:e.target.checked})}/>{ka?'ორსულობის რეჟიმი და შეყვანილი დათარიღება':'Pregnancy mode and entered dating'}</label>
      {preview&&<details><summary>{ka?'ზუსტად რა გაზიარდება?':'Exactly what will be shared?'}</summary>{preview.cycle&&<><p>{ka?'საწყისი ციკლი: ':'Initial cycle: '}{preview.cycle.cycleLength}</p><ul>{preview.cycle.periods.map(p=><li key={p.start}>{p.start} · {p.duration} {ka?'დღე':'days'}</li>)}</ul></>}{preview.pregnancy&&<p>{ka?'ორსულობის დათარიღება: ':'Pregnancy dating: '}{preview.pregnancy.date} ({preview.pregnancy.dating})</p>}</details>}
      <p>{ka?'მოწვევის ბმული მოქმედებს 7 დღე და ერთ ანგარიშს შეუძლია მისი მიღება. გააზიარე მხოლოდ სანდო პირთან.':'The invitation expires in 7 days and can be accepted by one account. Share it only with someone you trust.'}</p><button disabled={busy||health.error!==''||(!scopes.cycle&&!scopes.pregnancy)}>{ka?'მოწვევის შექმნა':'Create invitation'}</button>
    </form>}
    {link&&<label>{ka?'მოწვევის პირადი ბმული, დააკოპირე':'Private invitation link, copy it'}<input readOnly value={link} onFocus={e=>e.target.select()}/></label>}
    <form className="workspace-form" onSubmit={e=>{e.preventDefault();void action({action:'accept',token:invite.trim()})}}><label>{ka?'მიღებული მოწვევის კოდი':'Invitation code received'}<input required value={invite} minLength={64} maxLength={64} autoComplete="off" onChange={e=>setInvite(e.target.value)}/></label><button disabled={busy}>{ka?'მოწვევის მიღება':'Accept invitation'}</button></form>
  </section>
  <section className="workspace-card"><h2>{ka?'ჩემი გაზიარებები':'My shares'}</h2>{data?.outgoing.map(row=><article className="workspace-card" key={row.id}><h3>{row.label}</h3><p>{row.revoked_at?(ka?'გაუქმებულია':'Revoked'):row.accepted_at?(ka?'მიღებულია':'Accepted'):Date.parse(row.expires_at)<(snapshot?.receivedAt||0)?(ka?'მოწვევა ვადაგასულია':'Invitation expired'):(ka?'მიღების მოლოდინში':'Awaiting acceptance')}</p>{!row.revoked_at&&<button disabled={busy} onClick={()=>void action({action:'revoke',id:row.id})}>{ka?'გაზიარების გაუქმება':'Revoke sharing'}</button>}</article>)}<p>{ka?'გაუქმება აჩერებს შემდგომ წვდომას. უკვე ნანახი ინფორმაციის უკან დაბრუნება შეუძლებელია.':'Revoking stops future access. Information already seen cannot be taken back.'}</p></section>
  <section className="workspace-card"><h2>{ka?'ჩემთვის გაზიარებული':'Shared with me'}</h2>{data?.incoming.map(row=>{
    const cycle=row.summary?.cycle,model=cycle?forecast(cycle.periods,cycle.cycleLength):null;
    const pregnancy=pregnancyProgress(row.summary?.pregnancy);
    return <article className="workspace-card" key={row.id}><h3>{row.label}</h3>{!row.available?<p>{ka?'გამზიარებლის პრემიუმი აღარ მოქმედებს.':'The owner’s Premium is no longer active.'}</p>:<>{model&&<p>{ka?'შემდეგი პერიოდის ვარაუდი: ':'Next period estimate: '}{model.status==='pregnancy'?(ka?'ორსულობის რეჟიმში შეჩერებულია':'Paused during pregnancy mode'):model.status==='overdue'?(ka?'ახალი ჩანაწერის მოლოდინში':'Awaiting a new entry'):model.expected||'—'}</p>}{pregnancy&&<p>{pregnancy.status==='active'?`${pregnancy.weeks} ${ka?'კვირა':'weeks'} + ${pregnancy.extraDays} ${ka?'დღე':'days'}`:(ka?'თარიღების გადახედვაა საჭირო':'Dates need review')}</p>}<p>{ka?'ყველა თარიღი შეფასებაა და არა დადასტურებული ბიოლოგიური მოვლენა.':'Dates are estimates, not confirmed biological events.'}</p></>}<button disabled={busy} onClick={()=>void action({action:'leave',id:row.id})}>{ka?'გაზიარებიდან გასვლა':'Leave sharing'}</button></article>;
  })}</section></div>;
}
