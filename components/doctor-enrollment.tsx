"use client";
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
type Entry={id:string;email:string;first_name:string;last_name:string;specialty:string;license_reference:string;status:string;user_id:string|null};
const empty={email:'',first_name:'',last_name:'',specialty:'',bio:'',license_reference:'',consent_confirmed:false};
export default function DoctorEnrollment({lang}:{lang:'ka'|'en'}){
  const ka=lang==='ka';const [form,setForm]=useState(empty),[entries,setEntries]=useState<Entry[]>([]),[checked,setChecked]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
  const load=useCallback(async()=>{try{const r=await fetch('/api/admin/doctors',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setEntries(d.enrollments);return true}catch(e){setMessage(e instanceof Error?e.message:'Error');return false}finally{setLoading(false)}},[]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load]);
  async function action(body:Record<string,unknown>){setBusy(true);setMessage('');try{
    const r=await fetch('/api/admin/doctors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);
    if(body.action==='register')setForm(empty);if(await load())setMessage(body.action==='approve'?(ka?'ექიმის სტატუსი მინიჭებულია. საჯარო პროფილის ჩართვა პროფილებისა და ვიზიტების გვერდიდან შეგიძლია.':'Doctor approved. Enable the public profile on the profiles and visits page.'):body.action==='invite'?(d.invited?(ka?'მოწვევის წერილი გაიგზავნა.':'Invitation email sent.'):(ka?'არსებული ანგარიში დაკავშირებულია. ახალი წერილი არ გაგზავნილა.':'Existing account linked. No new email was sent.')):(ka?'მონაცემები შენახულია. ახლა მოიწვიე ექიმი.':'Registration saved. You can now invite the doctor.'));
  }catch(e){setMessage(e instanceof Error?e.message:'Error')}finally{setBusy(false)}}
  return <section className="workspace-card"><h2>{ka?'ექიმის რეგისტრაცია':'Register a doctor'}</h2>
    <p>{ka?'1. შეავსე მონაცემები. 2. მოიწვიე ან დააკავშირე ექიმის ანგარიში. 3. ელფოსტის დადასტურებისა და კვალიფიკაციის რეალური შემოწმების შემდეგ მიანიჭე ექიმის სტატუსი. საჯარო პროფილს ქვემოთ, ცალკე ჩართავ.':'1. Enter details. 2. Invite or link the doctor’s account. 3. Verify qualifications and email ownership before granting doctor status. Enable the public profile separately below.'}</p>
    <form className="workspace-form" onSubmit={e=>{e.preventDefault();void action({action:'register',...form})}}>
      {([['first_name',ka?'სახელი':'First name'],['last_name',ka?'გვარი':'Last name'],['email',ka?'ელფოსტა':'Email'],['specialty',ka?'სპეციალობა':'Specialty'],['license_reference',ka?'სერტიფიკატის ნომერი / გადამოწმების წყარო':'Certificate number / verification reference']] as const).map(([key,label])=><label key={key}>{label}<input required type={key==='email'?'email':'text'} minLength={key==='specialty'?1:2} maxLength={key==='email'?254:key==='license_reference'?200:key==='specialty'?120:60} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
      <label>{ka?'პროფესიული აღწერა':'Professional bio'}<textarea maxLength={2000} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label>
      <label><input required type="checkbox" checked={form.consent_confirmed} onChange={e=>setForm({...form,consent_confirmed:e.target.checked})}/>{ka?'ექიმისგან მიღებულია თანხმობა ანგარიშის შექმნაზე და პროფესიული პროფილის გამოქვეყნებაზე.':'The doctor consented to account creation and publication of their professional profile.'}</label>
      <button disabled={busy}>{ka?'მონაცემების შენახვა':'Save registration'}</button>
    </form>
    <p role="status">{message}</p>
    <Link href="/admin/care">{ka?'პროფილებისა და ვიზიტების მართვა →':'Manage profiles and appointments →'}</Link>
    <h3>{ka?'რეგისტრაციები და გადამოწმება':'Registrations and verification'}</h3>
    <button type="button" disabled={busy} onClick={()=>void load()}>{ka?'სიის განახლება':'Refresh list'}</button>
    {loading?<p role="status">{ka?'სია იტვირთება…':'Loading registrations…'}</p>:!entries.length&&<p>{ka?'ექიმის რეგისტრაცია ჯერ არ დამატებულა.':'No doctor registrations yet.'}</p>}
    {entries.map(entry=><article className="workspace-card" key={entry.id}><h4>{entry.first_name} {entry.last_name}</h4><p>{entry.email} · {entry.specialty}</p><p>{ka?'სერტიფიკატი / წყარო: ':'Certificate / reference: '}{entry.license_reference}</p><p>{ka?'სტატუსი: ':'Status: '}{entry.status==='verified'?(ka?'გადამოწმებულია':'Verified'):entry.status==='invited'?(ka?'ანგარიში დაკავშირებულია, გადამოწმებას ელოდება':'Account linked, awaiting verification'):(ka?'მონაცემები შენახულია':'Registration saved')}</p>
      {entry.status!=='verified'&&<><button type="button" disabled={busy} onClick={()=>{if(confirm(ka?'გაიგზავნოს მოწვევა? თუ ანგარიში უკვე არსებობს, ის დაუკავშირდება ჩანაწერს.':'Send an invitation? An existing account will be linked instead.'))void action({action:'invite',id:entry.id})}}>{ka?'მოწვევა / ანგარიშის დაკავშირება':'Invite / link account'}</button>
      <label><input type="checkbox" checked={Boolean(checked[entry.id])} onChange={e=>setChecked({...checked,[entry.id]:e.target.checked})}/>{ka?'პირადად გადავამოწმე ექიმის ვინაობა და მოქმედი პროფესიული კვალიფიკაცია.':'I independently verified the doctor’s identity and current professional qualifications.'}</label>
      <button type="button" disabled={busy||!entry.user_id||!checked[entry.id]} onClick={()=>void action({action:'approve',id:entry.id,qualifications_verified:true})}>{ka?'ექიმის სტატუსის მინიჭება':'Approve verified doctor'}</button></>}
    </article>)}
  </section>;
}
