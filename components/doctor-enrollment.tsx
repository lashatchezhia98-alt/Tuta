"use client";
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import { pendingDoctorVerification, prequalifiedDoctorInvitation } from '@/lib/doctor-enrollment';
type Entry={id:string;email:string;first_name:string;last_name:string;specialty:string;license_reference:string;bio:string;status:string;user_id:string|null};
export default function DoctorEnrollment({lang}:{lang:'ka'|'en'}){
  const ka=lang==='ka';const [email,setEmail]=useState(''),[entries,setEntries]=useState<Entry[]>([]),[checked,setChecked]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
  const load=useCallback(async()=>{try{const r=await fetch('/api/admin/doctors',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setEntries(d.enrollments);return true}catch(e){setMessage(e instanceof Error?e.message:'Error');return false}finally{setLoading(false)}},[]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load]);
  async function action(body:Record<string,unknown>){setBusy(true);setMessage('');try{
    const r=await fetch('/api/admin/doctors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);
    if(body.action==='invite-qualified')setEmail('');
    if(await load())setMessage(body.action==='remove'
      ? (ka?'ექიმის ჩანაწერი წაიშალა. პირადი ანგარიში არ შეცვლილა.':'Doctor record removed. The personal account was not changed.')
      :body.action==='approve'?(ka?'ექიმის სტატუსი მინიჭებულია. საჯარო პროფილის ჩართვა პროფილებისა და ვიზიტების გვერდიდან შეგიძლია.':'Doctor approved. Enable the public profile on the profiles and visits page.')
      :d.invited?(ka?'ერთჯერადი მოწვევის ბმული გაიგზავნა.':'One-time invitation sent.'):(ka?'არსებული ანგარიში დაკავშირებულია. ახალი წერილი არ გაგზავნილა.':'Existing account linked. No new email was sent.'));
  }catch(e){
    if(body.action==='invite-qualified')await load();
    setMessage(e instanceof Error?e.message:'Error');
  }finally{setBusy(false)}}
  return <section className="workspace-card"><h2>{ka?'ექიმის მოწვევა':'Invite a doctor'}</h2>
    <p>{ka?'მოიწვიე მხოლოდ გადამოწმებული ექიმი. პროფილი გამოჩნდება, როგორც კი ექიმი შეავსებს და გამოაქვეყნებს.':'Invite only a verified doctor. Their profile goes live as soon as they complete and publish it.'}</p>
    <form className="workspace-form" onSubmit={e=>{e.preventDefault();if(!busy&&confirm(ka?'ადასტურებ, რომ ექიმის კვალიფიკაცია გადაამოწმე და ის მოწვევაზე თანახმაა?':'Confirm that you checked the doctor’s qualifications and they agreed to receive an invitation.'))void action({action:'invite-qualified',email,confirmed:true})}}>
      <label>{ka?'ელფოსტა':'Email'}<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <button type="submit" disabled={busy}>{ka?'ერთჯერადი მოწვევის გაგზავნა':'Send one-time invitation'}</button>
    </form>
    <p role="status">{message}</p>
    <Link href="/admin/care">{ka?'პროფილებისა და ვიზიტების მართვა →':'Manage profiles and appointments →'}</Link>
    {" · "}<Link href="/consultation/doctor">{ka?'ექიმის კაბინეტი →':'Doctor workspace →'}</Link>
    <h3>{ka?'ექიმების სია':'Doctor list'}</h3>
    <button type="button" disabled={busy} onClick={()=>void load()}>{ka?'სიის განახლება':'Refresh list'}</button>
    {loading?<p role="status">{ka?'სია იტვირთება…':'Loading registrations…'}</p>:!entries.length&&<p>{ka?'ექიმის რეგისტრაცია ჯერ არ დამატებულა.':'No doctor registrations yet.'}</p>}
    {entries.map(entry=><article className="workspace-card" key={entry.id}><h4>{entry.first_name==='Pending'&&entry.last_name==='Pending'?entry.email:`${entry.first_name} ${entry.last_name}`}</h4><p>{entry.email}{entry.specialty!==pendingDoctorVerification ? ` · ${entry.specialty}` : ''}</p><p>{ka?'სტატუსი: ':'Status: '}{entry.status==='verified'?(ka?'გადამოწმებულია':'Verified'):entry.status==='invited'?(entry.license_reference===prequalifiedDoctorInvitation?(ka?'ექიმს პროფილი ჯერ არ შეუვსია':'Awaiting profile completion'):(ka?'ანგარიში დაკავშირებულია, გადამოწმებას ელოდება':'Account linked, awaiting verification')):(ka?'მოწვევა ჯერ არ გაგზავნილა':'Invitation not yet sent')}</p>
      {entry.status!=='verified'&&<><button type="button" disabled={busy} onClick={()=>{if(confirm(ka?`გაიგზავნოს ერთჯერადი ბმული მისამართზე ${entry.email}? თუ ექიმს ანგარიში უკვე დადასტურებული აქვს, ის დაუკავშირდება ჩანაწერს წერილის გარეშე.`:`Send a one-time link to ${entry.email}? An existing confirmed account will be linked without another email.`))void action({action:'invite',id:entry.id})}}>{entry.status==='invited'?(ka?'მოწვევის ხელახლა გაგზავნა':'Resend invitation'):(ka?'ერთჯერადი რეგისტრაციის ბმულის გაგზავნა':'Send one-time registration link')}</button>
      {entry.user_id && (entry.license_reference===prequalifiedDoctorInvitation ? <p><Link href="/consultation/doctor/setup">{ka?'პროფილის შესავსები გვერდი (არსებული ანგარიშისთვის)':'Profile setup page (for an existing account)'}</Link></p> : <details><summary>{ka?'კვალიფიკაციის გადამოწმება':'Verify qualifications'}</summary>
        <form className="workspace-form" onSubmit={e=>{
          e.preventDefault();
          if(busy||!checked[entry.id])return;
          const values=new FormData(e.currentTarget);
          void action({action:'approve',id:entry.id,qualifications_verified:true,specialty:values.get('specialty'),license_reference:values.get('license_reference'),bio:values.get('bio')});
        }}>
          <label>{ka?'სპეციალობა':'Specialty'}<input required name="specialty" maxLength={120} defaultValue={entry.specialty===pendingDoctorVerification?'':entry.specialty}/></label>
          <label>{ka?'სერტიფიკატის ნომერი / გადამოწმების წყარო':'Certificate number / verification reference'}<input required name="license_reference" minLength={2} maxLength={200} defaultValue={entry.license_reference===pendingDoctorVerification?'':entry.license_reference}/></label>
          <label>{ka?'პროფესიული აღწერა':'Professional bio'}<textarea name="bio" maxLength={2000} defaultValue={entry.bio}/></label>
          <label><input type="checkbox" required checked={Boolean(checked[entry.id])} onChange={e=>setChecked({...checked,[entry.id]:e.target.checked})}/>{ka?'პირადად გადავამოწმე ექიმის ვინაობა და კვალიფიკაცია.':'I independently verified the doctor’s identity and qualifications.'}</label>
          <button type="submit" disabled={busy||!checked[entry.id]}>{ka?'ექიმის სტატუსის მინიჭება':'Approve verified doctor'}</button>
        </form>
      </details>)}</>}
      <button type="button" disabled={busy} onClick={()=>{
        const name=`${entry.first_name} ${entry.last_name} (${entry.email})`;
        if(confirm(ka?`წაიშალოს ექიმის ჩანაწერი: ${name}? პირადი თუთას ანგარიში არ წაიშლება. თუ პროფილს ვიზიტის ან მიმოწერის ისტორია აქვს, წაშლა არ შესრულდება.`:`Remove doctor record for ${name}? The personal Tuta account will not be deleted. Profiles with booking or conversation history cannot be removed.`)){
          void action({action:'remove',id:entry.id,confirmed:true});
        }
      }}>{ka?'ექიმის ჩანაწერის წაშლა':'Remove doctor record'}</button>
    </article>)}
  </section>;
}
