"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { CycleSettings, getCycle, isoDate } from "../lib/cycle";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { authRedirectBase } from "../lib/auth-redirect";
import {useHealthState,type HealthData} from "./use-health-state";
import AdminFeaturePanel from "@/components/admin-feature-panel";
import BrandMark from '@/components/brand-mark';
import HeaderActions from '@/components/header-actions';
import CycleOverview from "@/components/cycle-overview";
import { forecast } from "../mobile/src/cycle.mjs";
import PremiumCheckout from "@/components/premium-checkout";
import HealthWorkspace from "@/components/health-workspace";
import Library from "@/components/library";
import CareWorkspace from "@/components/care-workspace";
import Marketplace from "@/components/marketplace";
import PasswordField from "@/components/password-field";
import {authDestination} from '@/lib/auth-destination';
import FreeCalculator from '@/components/free-calculator';
import { featureForRoute, useSiteFeatures,useSiteFeaturesStatus } from "@/lib/site-features";

type Lang = "ka" | "en";
function validBirthDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T12:00:00Z`);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return false;const today=isoDate(new Date());const age=Number(today.slice(0,4))-Number(value.slice(0,4))-(today.slice(5)<value.slice(5)?1:0);return age>=1&&age<=120&&value<=today}
type PageKind = "about"|"blog"|"market"|"premium"|"register"|"login"|"forgot-password"|"reset-password"|"dashboard"|"log"|"insights"|"report"|"settings"|"ovulation"|"period"|"admin"|"consultation";

const pageInfo: Record<PageKind, {ka:[string,string],en:[string,string]}> = {
  about:{ka:["თუთას შესახებ","თუთა შეიქმნა იმისთვის, რომ ჯანმრთელობაზე ზრუნვა იყოს მარტივი, პირადი და გასაგები."],en:["About TUTA","TUTA was created to make health awareness simple, private and easy to understand."]},
  blog:{ka:["ჯანმრთელობის ბიბლიოთეკა","ზოგადი საკითხავი მასალა პერიოდზე, ყოველდღიურ კეთილდღეობასა და ექიმთან ვიზიტისთვის მომზადებაზე."],en:["Health library","General reading on periods, everyday wellbeing and preparing for a doctor visit."]},
  market:{ka:["მარკეტი / მაღაზია","შერჩეული პროდუქტები ყოველდღიური თავის მოვლისთვის."],en:["Market / shop","Thoughtfully selected products for everyday care."]},
  premium:{ka:["TUTA Premium","ფასიანი ფუნქციები მზადდება და ამ ვერსიაში ჯერ არ არის ჩართული."],en:["TUTA Premium","Paid features are in development and are not active in this version."]},
  register:{ka:["შექმენი ანგარიში","დაიწყე შენი ციკლის გაცნობიერება უსაფრთხო და პირად სივრცეში."],en:["Create your account","Start understanding your cycle in a safe and private space."]},
  login:{ka:["კეთილი იყოს შენი დაბრუნება","შედი ანგარიშზე და გააგრძელე იქიდან, სადაც გაჩერდი."],en:["Welcome back","Sign in and continue where you left off."]},
  "forgot-password":{ka:["პაროლის აღდგენა","შეიყვანე ანგარიშის ელფოსტა და გამოგიგზავნით აღდგენის ბმულს."],en:["Reset your password","Enter your account email and we’ll send you a recovery link."]},
  "reset-password":{ka:["ახალი პაროლი","აირჩიე ახალი პაროლი შენი ანგარიშისთვის."],en:["Choose a new password","Set a new password for your account."]},
  dashboard:{ka:["პერიოდი","შენი პერიოდისა და დღიურის მიმდინარე მიმოხილვა."],en:["Period","Your current period and journal overview."]},
  log:{ka:["დღიური ჩანაწერი","მონიშნე განწყობა, ენერგია, ტკივილი, ნაკადი და სიმპტომები."],en:["Daily log","Track mood, energy, pain, flow and symptoms."]},
  insights:{ka:["შენი პატერნები","დროთა განმავლობაში აღმოჩენილი ცვლილებები და ციკლის ანალიტიკა."],en:["Your patterns","Changes and cycle analytics discovered over time."]},
  report:{ka:["ექიმის ანგარიში","ექიმისთვის განკუთვნილი PDF ანგარიში ჯერ მზადდება."],en:["Doctor's report","A doctor-ready PDF report is still in development."]},
  settings:{ka:["პარამეტრები","ნახე ანგარიში და მონაცემების სინქრონიზაციის სტატუსი."],en:["Settings","View your account and data synchronization status."]},
  ovulation:{ka:["ოვულაციის კალკულატორი","გამოთვალე სავარაუდო ოვულაციის დღე და ნაყოფიერი ფანჯარა."],en:["Ovulation calculator","Estimate your ovulation day and fertile window."]},
  period:{ka:["პერიოდის კალკულატორი","გამოთვალე შემდეგი პერიოდის სავარაუდო თარიღი."],en:["Period calculator","Estimate the start date of your next period."]},
  admin:{ka:["ადმინისტრაცია","მართე საიტის ფუნქციების ხილვადობა და კონტენტი."],en:["Administration","Manage feature visibility and site content."]},
  consultation:{ka:["ექიმთან კონსულტაცია","ექიმთან ჩატი და ვიზიტის დაჯავშნა ჯერ არ არის ჩართული."],en:["Doctor consultation","Doctor chat and appointment booking are not active yet."]},
};

function useSiteLanguage(){const [lang,setLang]=useState<Lang>("ka");useEffect(()=>{if(localStorage.getItem("tuta-language")==="en")setLang("en")},[]);useEffect(()=>{localStorage.setItem("tuta-language",lang);document.documentElement.lang=lang},[lang]);return{lang,setLang}}
function InnerLogo({lang,inverse=false}:{lang:Lang,inverse?:boolean}){return <a href="/" className={`inner-logo ${inverse?"inverse":""}`}><BrandMark/><strong>{lang==="ka"?"თუთა":"TUTA"}</strong></a>}

function InnerHeader({lang,setLang,showActions=true}:{lang:Lang,setLang:(v:Lang)=>void,consult?:boolean,showActions?:boolean}){return <header className="inner-header"><div className="inner-container inner-nav"><InnerLogo lang={lang}/>{showActions&&<HeaderActions lang={lang} setLang={setLang}/>}</div></header>}

function StandardPage({kind,lang}:{kind:PageKind,lang:Lang}){const data=pageInfo[kind][lang];const cards=lang==="ka"?[["შენი რიტმის გასაცნობად","თუთა აერთიანებს პერიოდის კალენდარს, ყოველდღიურ დღიურსა და ქალების საზოგადოებას. თუთა მეგრულად მთვარეს ნიშნავს."],["კონტროლი შენს ხელშია","ჯანმრთელობის ჩანაწერები ანგარიშში ინახება. პოსტები მათგან განცალკევებულია; პარტნიორთან გაზიარებისთვის თავად ირჩევ მონაცემებს და თანხმობას აუქმებ ნებისმიერ დროს."],["ინფორმაცია და პროფესიული დახმარება","პროგნოზები შეფასებაა და არა დიაგნოზი. ექიმები ჩნდებიან ადმინისტრატორის მიერ კვალიფიკაციის გადამოწმების შემდეგ. გადახდები ამ ეტაპზე მხოლოდ სატესტოა."]]:[["Understand your rhythm","Tuta brings together a period calendar, daily journal and a community for women. Tuta means moon in Mingrelian."],["You stay in control","Health entries are stored in your account, separate from community posts. You choose what to share with a partner and can revoke consent at any time."],["Information and professional care","Predictions are estimates, not diagnoses. Doctors appear after administrator qualification checks. Payments currently operate in test mode only."]];return <><section className="inner-hero"><div className="inner-container"><span className="inner-kicker">TUTA HEALTH</span><h1>{data[0]}</h1><p>{data[1]}</p></div></section><section className="inner-body inner-container"><div className="info-grid">{cards.map(([title,body])=><article key={title}><h2>{title}</h2><p>{body}</p></article>)}</div><p><a href="/privacy">{lang==='ka'?'კონფიდენციალურობა':'Privacy'}</a> · <a href="/terms">{lang==='ka'?'წესები და პირობები':'Terms'}</a></p></section></>}
function PremiumPage({lang}:{lang:Lang}){return <><section className="inner-hero compact"><div className="inner-container"><span className="inner-kicker">TUTA PREMIUM</span><h1>{lang==="ka"?"Premium სატესტო პაკეტი":"Premium test plan"}</h1><p>{lang==="ka"?"სატესტო გადახდა და Premium წვდომის გააქტიურების სრული შემოწმება.":"Test the payment flow and Premium access activation."}</p></div></section><PremiumCheckout lang={lang}/></>}

function AuthPage({kind,lang}:{kind:"login"|"register"|"forgot-password"|"reset-password",lang:Lang}){
  const login=kind==="login";
  const register=kind==="register";
  const forgot=kind==="forgot-password";
  const reset=kind==="reset-password";
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [birthDate,setBirthDate]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [recoveryReady,setRecoveryReady]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const ka=lang==="ka";

  useEffect(()=>{
    if(!login)return;
    let active=true;
    try{
      const supabase=getSupabaseBrowserClient();
      const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
        if(active&&event==="SIGNED_IN"&&session)router.replace(authDestination(window.location.search));
      });
      void supabase.auth.getSession().then(({data:{session}})=>{
        if(active&&session)router.replace(authDestination(window.location.search));
      }).catch(()=>{});
      return()=>{active=false;subscription.unsubscribe()};
    }catch{queueMicrotask(()=>{if(active)setError(ka?"ანგარიშის სერვისი დაყენებული არ არის.":"Account service is not configured.")});return()=>{active=false}}
  },[login,router,ka]);

  useEffect(()=>{
    if(!reset)return;
    let active=true;
    try{
      const supabase=getSupabaseBrowserClient();
      const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
        if(active&&(event==="PASSWORD_RECOVERY"||session)){setRecoveryReady(true);setError("")}
      });
      void supabase.auth.getSession().then(({data:{session},error})=>{
        if(!active)return;
        if(error)setError(ka?"აღდგენის ბმული არასწორია ან ვადა გაუვიდა.":"The recovery link is invalid or has expired.");
        else if(session){setRecoveryReady(true);setError("")}
        else setError(ka?"ჯერ გახსენი ელფოსტაზე მიღებული აღდგენის ბმული.":"Open the recovery link from your email first.");
      }).catch(()=>{if(active)setError(ka?"კავშირის შემოწმება ვერ მოხერხდა.":"Could not verify your recovery link.")});
      return()=>{active=false;subscription.unsubscribe()};
    }catch{queueMicrotask(()=>{if(active)setError(ka?"ანგარიშის სერვისი დაყენებული არ არის.":"Account service is not configured.")});return()=>{active=false}}
  },[reset,ka]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(register&&(!firstName.trim()||!lastName.trim())){setError(ka?"შეიყვანე სახელი და გვარი.":"Enter your first and last name.");return}
    if(register&&!validBirthDate(birthDate)){setError(ka?"კალენდარში აირჩიე დაბადების სწორი თარიღი.":"Choose a valid birth date from the calendar.");return}
    if((register||reset)&&password!==confirmPassword){setError(ka?"პაროლები არ ემთხვევა ერთმანეთს.":"Passwords do not match.");return}
    if((register||reset)&&password.length<8){setError(ka?"პაროლი მინიმუმ 8 სიმბოლოს უნდა შეიცავდეს.":"Password must be at least 8 characters.");return}
    setBusy(true);setError("");setNotice("");
    try{
      const supabase=getSupabaseBrowserClient();
      const redirectBase=authRedirectBase(process.env.NEXT_PUBLIC_SITE_URL,window.location.origin);
      if(forgot){
        const {error}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:`${redirectBase}/reset-password`});
        if(error)throw error;
        setNotice(ka?"თუ ამ ელფოსტით ანგარიში არსებობს, აღდგენის ბმულს მალე მიიღებ. შეამოწმე სპამიც.":"If an account exists for this email, you’ll receive a recovery link shortly. Check spam too.");
      }else if(reset){
        if(!recoveryReady)throw new Error("Missing recovery session");
        const {error}=await supabase.auth.updateUser({password});
        if(error)throw error;
        setNotice(ka?"პაროლი შეიცვალა. ახლა შეგიძლია შეხვიდე ანგარიშში.":"Password updated. You can now sign in.");
        setPassword("");setConfirmPassword("");
        await supabase.auth.signOut({scope:"local"});
        setRecoveryReady(false);
      }else{
        const result=login
          ? await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password})
          : await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{data:{first_name:firstName.trim(),last_name:lastName.trim(),name:`${firstName.trim()} ${lastName.trim()}`,date_of_birth:birthDate},emailRedirectTo:`${redirectBase}/login`}});
        if(result.error)throw result.error;
        if(register&&!result.data.session){
        setNotice(ka?"ანგარიში შეიქმნა. შესვლისთვის ელფოსტაზე გამოგზავნილი ბმული დაადასტურე.":"Account created. Confirm your email using the link we sent before signing in.");
        }else{router.replace(authDestination(window.location.search))}
      }
    }catch(cause){
      const message=cause instanceof Error?cause.message:"";
      if(/invalid login credentials/i.test(message))setError(ka?"ელფოსტა ან პაროლი არასწორია.":"Email or password is incorrect.");
      else if(/already registered|user already exists/i.test(message))setError(ka?"ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ან პაროლის აღდგენა გამოიყენე.":"An account with this email already exists. Sign in or reset your password.");
      else if(/fetch|network|failed to connect/i.test(message))setError(ka?"სერვერთან კავშირი ვერ შედგა. გადაამოწმე ინტერნეტი და Supabase პროექტის სტატუსი.":"Could not reach the server. Check your connection and Supabase project status.");
      else if(/missing recovery session/i.test(message))setError(ka?"ჯერ გახსენი ელფოსტაზე მიღებული აღდგენის ბმული.":"Open the recovery link from your email first.");
      else setError(ka?"მოქმედება ვერ შესრულდა. სცადე ხელახლა.":"That didn’t work. Please try again.");
    }finally{setBusy(false)}
  }

  return <section className="auth-page"><div className="auth-panel"><InnerLogo lang={lang}/><h1>{pageInfo[kind][lang][0]}</h1><p>{pageInfo[kind][lang][1]}</p><form onSubmit={submit} noValidate={false}>
    {!reset&&<label>{ka?"ელფოსტა (მომხმარებლის სახელი)":"Email (username)"}<input type="email" placeholder="name@example.com" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>}
    {register&&<label>{ka?"სახელი":"First name"}<input type="text" autoComplete="given-name" value={firstName} onChange={e=>setFirstName(e.target.value)} required maxLength={80}/></label>}
    {register&&<label>{ka?"გვარი":"Last name"}<input type="text" autoComplete="family-name" value={lastName} onChange={e=>setLastName(e.target.value)} required maxLength={80}/></label>}
    {register&&<label>{ka?"დაბადების თარიღი":"Date of birth"}<input type="date" autoComplete="bday" value={birthDate} onChange={e=>setBirthDate(e.target.value)} required min={`${new Date().getFullYear()-120}-01-01`} max={isoDate(new Date())}/></label>}
    {!forgot&&<PasswordField label={reset?(ka?"ახალი პაროლი":"New password"):(ka?"პაროლი":"Password")} lang={lang} autoComplete={login?"current-password":"new-password"} value={password} onChange={setPassword}/>}
    {(register||reset)&&<PasswordField label={ka?(reset?"გაიმეორე ახალი პაროლი":"გაიმეორე პაროლი"):(reset?"Confirm new password":"Confirm password")} lang={lang} value={confirmPassword} onChange={setConfirmPassword}/>}
    {register&&<p>{ka?'ანგარიშის შექმნამდე გაეცანი':'Before creating an account, read our'} <a href="/terms" target="_blank" rel="noreferrer">{ka?'წესებსა და პირობებს':'Terms of use'}</a> {ka?'და':'and'} <a href="/privacy" target="_blank" rel="noreferrer">{ka?'კონფიდენციალურობის წესებს':'Privacy notice'}</a>.</p>}
    {error&&<p className="admin-login-error" role="alert">{error}</p>}{notice&&<p className="auth-notice" role="status">{notice}</p>}
    <button type="submit" disabled={busy||(reset&&!recoveryReady)}>{busy?(ka?"მუშავდება…":"Please wait…"):login?(ka?"შესვლა":"Sign in"):register?(ka?"ანგარიშის შექმნა":"Create account"):forgot?(ka?"ბმულის გაგზავნა":"Send recovery link"):(ka?"პაროლის შეცვლა":"Update password")}</button>
  </form>{login&&<a href="/forgot-password">{ka?"დაგავიწყდა პაროლი?":"Forgot password?"}</a>}<a href={login?"/register":"/login"}>{login?(ka?"არ გაქვს ანგარიში?":"Need an account?"):(ka?"შესვლაზე დაბრუნება":"Back to sign in")}</a></div><div className="auth-art"><div className="auth-moon"/><p>{ka?"შენი მონაცემები შენ გეკუთვნის.":"Your data belongs to you."}</p></div></section>
}

function Calculator({kind,lang}:{kind:"period"|"ovulation",lang:Lang}){const [date,setDate]=useState("");const [length,setLength]=useState(28);const result=useMemo(()=>{if(!date||length<21||length>45)return null;try{return getCycle(date,length,5)}catch{return null}},[date,length]);const format=(v:string)=>new Intl.DateTimeFormat(lang==="ka"?"ka-GE":"en-GB",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${v}T12:00:00`));return <><section className="inner-hero compact"><div className="inner-container"><span className="inner-kicker">TUTA TOOLS</span><h1>{pageInfo[kind][lang][0]}</h1><p>{pageInfo[kind][lang][1]}</p></div></section><section className="calculator inner-container"><label>{lang==="ka"?"ბოლო პერიოდის პირველი დღე":"First day of last period"}<input type="date" value={date} onChange={e=>setDate(e.target.value)} max={isoDate(new Date())}/></label><label>{lang==="ka"?"ციკლის საშუალო ხანგრძლივობა":"Average cycle length"}<input type="number" min="21" max="45" value={length} onChange={e=>setLength(Math.round(Number(e.target.value)))}/></label>{date&&(!result||length<21||length>45)&&<p style={{gridColumn:"1/-1",color:"#9b2c3b"}}>{lang==="ka"?"შეიყვანე სწორი თარიღი და ციკლის ხანგრძლივობა (21–45 დღე).":"Enter a valid date and cycle length (21–45 days)."}</p>}<div className="calculator-result"><small>{kind==="period"?(lang==="ka"?"შემდეგი პერიოდი":"Next period"):(lang==="ka"?"სავარაუდო ოვულაცია":"Estimated ovulation")}</small><strong>{result?(kind==="period"?format(result.nextPeriod):format(result.ovulation)):"..."}</strong>{result&&<><small style={{display:"block",marginTop:18}}>{lang==="ka"?"ნაყოფიერი ფანჯარა":"Fertile window"}</small><strong>{format(result.fertileStart)} – {format(result.fertileEnd)}</strong></>}</div></section></>}

function Consultation({lang}:{lang:Lang}){return <><section className="inner-hero compact"><div className="inner-container"><span className="inner-kicker">TUTA CARE</span><h1>{pageInfo.consultation[lang][0]}</h1><p>{pageInfo.consultation[lang][1]}</p></div></section><section className="inner-container" style={{padding:"60px 20px 100px"}}><div className="calculator-result"><small>{lang==="ka"?"დაგეგმილი სერვისი":"PLANNED SERVICE"}</small><h2 style={{margin:"10px 0"}}>{lang==="ka"?"კონსულტაცია ჯერ მიუწვდომელია":"Consultations are not available yet"}</h2><p>{lang==="ka"?"ექიმების სია, ჩატი და ჯავშანი ამ ვერსიაში არ მუშაობს. Premium გამოწერაც ჯერ არ იყიდება.":"Doctor profiles, chat and booking are not active in this version. Premium subscriptions are not on sale yet."}</p></div></section></>}

function Admin({lang}:{lang:Lang}){return <AdminFeaturePanel initialLang={lang}/>}

function AppDashboard({kind,lang}:{kind:PageKind,lang:Lang}){
 const items=["dashboard","log","insights","report","settings"] as PageKind[];
 const health=useHealthState();const {data,session,loaded,error}=health;
 const last=data.periods.at(-1);const settings:CycleSettings={startDate:last?.start||"",cycleLength:data.cycleLength,periodDuration:last?.duration||5};
 const [draft,setDraft]=useState<CycleSettings>(settings),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>setDraft(settings),[settings.startDate,settings.cycleLength,settings.periodDuration]);
 const saveCycle=async()=>{if(!draft.startDate||draft.startDate>isoDate(new Date())||!Number.isInteger(draft.cycleLength)||draft.cycleLength<21||draft.cycleLength>45||!Number.isInteger(draft.periodDuration)||draft.periodDuration<1||draft.periodDuration>10){setNotice(lang==="ka"?"შეამოწმე თარიღი და ხანგრძლივობები.":"Check the date and durations.");return}setBusy(true);setNotice("");try{await health.save({...data,cycleLength:draft.cycleLength,periods:[...data.periods.filter(p=>p.start!==draft.startDate),{start:draft.startDate,duration:draft.periodDuration}].sort((a,b)=>a.start.localeCompare(b.start))});setNotice(lang==="ka"?"ბაზაში შენახულია ✓":"Saved to your account ✓")}catch{setNotice(lang==="ka"?"შენახვა ვერ მოხერხდა. განაახლე მონაცემები და სცადე თავიდან.":"Could not save. Review the latest data and retry.")}finally{setBusy(false)}};
 return <section className="app-shell"><aside><InnerLogo lang={lang}/>{items.map(k=><a key={k} className={kind===k?"active":""} href={`/app/${k}`}>{pageInfo[k][lang][0]}</a>)}</aside><main><span className="inner-kicker">TUTA APP</span><h1>{pageInfo[kind][lang][0]}</h1><p>{pageInfo[kind][lang][1]}</p>{!loaded?<p role="status">{lang==="ka"?"ჩანაწერები იტვირთება…":"Loading your records…"}</p>:!session?<div className="calculator-result"><p>{lang==="ka"?"ჩანაწერები ინახება შენს ანგარიშში და სინქრონდება აპსა და საიტს შორის. შესვლის გარეშე ჩანაწერები არ ჩანს.":"Records are saved to your account and synced between app and website. Sign in to view them."}</p><a href="/login">{lang==="ka"?"შესვლა ან რეგისტრაცია":"Sign in or register"}</a></div>:<>{error&&<p role="alert">{lang==="ka"?"მონაცემთა ბაზასთან კავშირი ვერ შედგა ან ჩანაწერი შეიცვალა. სცადე განახლება.":error}</p>}{health.legacy&&<div className="calculator-result"><p>{lang==="ka"?"ამ ბრაუზერში ძველი ჩანაწერები მოიძებნა. შეგიძლია ისინი ანგარიშში გადაიტანო. წარმატებული გადატანის შემდეგ ლოკალური ასლი წაიშლება.":"Older browser entries were found. Import them into your account; the local copy is removed only after a successful save."}</p><button type="button" onClick={()=>void health.importLegacy().catch(()=>{})}>{lang==="ka"?"ჩანაწერების გადატანა":"Import entries"}</button></div>}{kind==="dashboard"?<><div className="calculator" style={{padding:"24px 0 0"}}><label>{lang==="ka"?"ბოლო პერიოდის პირველი დღე":"First day of last period"}<input type="date" max={isoDate(new Date())} value={draft.startDate} onChange={e=>setDraft({...draft,startDate:e.target.value})}/></label><label>{lang==="ka"?"ციკლის ხანგრძლივობა":"Cycle length"}<input type="number" min="21" max="45" value={draft.cycleLength} onChange={e=>setDraft({...draft,cycleLength:Number(e.target.value)})}/></label><label>{lang==="ka"?"პერიოდის ხანგრძლივობა":"Period duration"}<input type="number" min="1" max="10" value={draft.periodDuration} onChange={e=>setDraft({...draft,periodDuration:Number(e.target.value)})}/></label><button type="button" disabled={busy} onClick={()=>void saveCycle()}>{busy?(lang==="ka"?"ინახება…":"Saving…"):(lang==="ka"?"ციკლის შენახვა":"Save cycle")}</button></div>{notice&&<p role="status">{notice}</p>}<CycleOverview periods={data.periods} cycleLength={data.cycleLength} lang={lang}/></>:<FeatureAppPage kind={kind} lang={lang} data={data} save={health.save}/>}</>}</main></section>
}

function FeatureAppPage({kind,lang,data,save}:{kind:PageKind,lang:Lang,data:HealthData,save:(next:HealthData)=>Promise<void>}){if(kind==="log")return <DailyLog lang={lang} data={data} save={save}/>;if(kind==="settings")return <AccountSettings lang={lang}/>;if(kind==="insights"){const model=forecast(data.periods,data.cycleLength);const avg=Math.round(model.averageLength);return <div className="app-content-cards"><article><small>{lang==="ka"?"საშუალო ციკლი":"Average cycle"}</small><strong>{avg} {lang==="ka"?"დღე":"days"}</strong></article><article><small>{lang==="ka"?"ჩანაწერები":"Daily logs"}</small><strong>{data.logs.length}</strong></article><article><small>{lang==="ka"?"სტატუსი":"Status"}</small><strong>{model.reliability==="limited"?(lang==="ka"?"არასაკმარისი ისტორია":"Limited history"):model.reliability==="low"?(lang==="ka"?"ცვალებადი":"Variable"):(lang==="ka"?"ისტორია თანმიმდევრულია":"Consistent history")}</strong></article></div>};return <div className="app-content-cards"><article><small>{lang==="ka"?"შემდეგი ნაბიჯი":"Next step"}</small><strong>{lang==="ka"?"დაამატე ციკლი":"Add a cycle"}</strong></article></div>}

function AccountSettings({lang}:{lang:Lang}){
  return <><AccountSettingsCard lang={lang}/><nav className="account-history-links" aria-label={lang==='ka'?'არსებული სერვისების მართვა':'Manage existing services'}><a href="/consultation">{lang==='ka'?'ჩემი ვიზიტები და მიმოწერა':'My appointments & messages'}</a><a href="/app/partners">{lang==='ka'?'გაზიარებების ნახვა და გაუქმება':'View & revoke sharing'}</a><a href="/market/orders">{lang==='ka'?'შეკვეთების ისტორია':'Order history'}</a></nav></>;
}
function AccountSettingsCard({lang}:{lang:Lang}){
  const [session,setSession]=useState<Session|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const ka=lang==="ka";
  useEffect(()=>{
    let active=true,observed=false;
    try{
      const supabase=getSupabaseBrowserClient();
      const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{observed=true;if(active)setSession(next)});
      void supabase.auth.getSession().then(({data:{session}})=>{if(active&&!observed)setSession(session)}).catch(()=>{});
      return()=>{active=false;subscription.unsubscribe()};
    }catch{queueMicrotask(()=>{if(active)setNotice(ka?"ანგარიშის სერვისი დაყენებული არ არის.":"Account service is not configured.")});return()=>{active=false}}
  },[ka]);
  async function signOut(){
    setBusy(true);setNotice("");
    try{
      const {error}=await getSupabaseBrowserClient().auth.signOut({scope:"local"});
      if(error)throw error;
      setSession(null);
      setNotice(ka?"ანგარიშიდან გამოხვედი.":"You have signed out.");
    }catch{setNotice(ka?"გამოსვლა ვერ მოხერხდა. სცადე ხელახლა.":"Could not sign out. Please try again.")}
    finally{setBusy(false)}
  }
  const nickname=session?.user.user_metadata?.nickname;
  return <section className="account-settings"><div className="calculator-result"><small>{ka?"ანგარიში":"Account"}</small><h2>{session?.user.email||(ka?"სტუმრის რეჟიმი":"Guest mode")}</h2>{typeof nickname==="string"&&nickname.trim()&&<p>{ka?"ნიკნეიმი":"Nickname"}: {nickname}</p>}<p>{ka?"ციკლისა და დღიურის ჩანაწერები შენს დაცულ ანგარიშშია და აპსა და საიტს შორის სინქრონდება.":"Cycle and journal records are stored in your private account and synced between the app and website."}</p>{session?<button type="button" disabled={busy} onClick={()=>void signOut()}>{busy?(ka?"მუშავდება…":"Please wait…"):(ka?"ანგარიშიდან გამოსვლა":"Sign out")}</button>:<div className="account-settings-links"><a href="/login">{ka?"შესვლა":"Sign in"}</a><a href="/register">{ka?"რეგისტრაცია":"Create account"}</a></div>}{notice&&<p role="status">{notice}</p>}</div></section>;
}

function DailyLog({lang,data,save}:{lang:Lang,data:HealthData,save:(next:HealthData)=>Promise<void>}){const ka=lang==="ka";const today=isoDate(new Date());const existing=data.logs.find(log=>log.date===today);const [mood,setMood]=useState(existing?.mood||"calm"),[energy,setEnergy]=useState(existing?.energy||3),[pain,setPain]=useState(existing?.pain||1),[flow,setFlow]=useState(existing?.flow||"light"),[notes,setNotes]=useState(existing?.notes||""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);useEffect(()=>{setMood(existing?.mood||"calm");setEnergy(existing?.energy||3);setPain(existing?.pain||1);setFlow(existing?.flow||"light");setNotes(existing?.notes||"")},[existing?.mood,existing?.energy,existing?.pain,existing?.flow,existing?.notes]);const submit=async()=>{if(!Number.isInteger(energy)||!Number.isInteger(pain)||energy<1||energy>5||pain<1||pain>5){setNotice(ka?"შეიყვანე ქულა 1-დან 5-მდე.":"Choose a score from 1 to 5.");return}setBusy(true);try{const next=[...data.logs.filter(log=>log.date!==today),{date:today,mood,energy,pain,flow,symptoms:existing?.symptoms||[],notes}].sort((a,b)=>a.date.localeCompare(b.date));await save({...data,logs:next});setNotice(ka?"ბაზაში შენახულია ✓":"Saved to your account ✓")}catch{setNotice(ka?"შენახვა ვერ მოხერხდა. შეამოწმე კავშირი და სცადე თავიდან.":"Could not save. Check your connection and retry.")}finally{setBusy(false)}};const moods=[["happy",ka?"ბედნიერი":"Happy"],["calm",ka?"მშვიდი":"Calm"],["low",ka?"სევდიანი":"Low"],["tense",ka?"დაძაბული":"Tense"],["tired",ka?"დაღლილი":"Tired"]];const flows=[["spotting",ka?"ლაქები":"Spotting"],["light",ka?"მსუბუქი":"Light"],["medium",ka?"საშუალო":"Medium"],["heavy",ka?"ძლიერი":"Heavy"]];return <div className="calculator"><label>{ka?"განწყობა":"Mood"}<select value={mood} onChange={e=>setMood(e.target.value)}>{moods.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>{ka?"ენერგია (1–5)":"Energy (1–5)"}<input type="number" min="1" max="5" value={energy} onChange={e=>setEnergy(Number(e.target.value))}/></label><label>{ka?"ტკივილი (1–5)":"Pain (1–5)"}<input type="number" min="1" max="5" value={pain} onChange={e=>setPain(Number(e.target.value))}/></label><label>{ka?"ნაკადი":"Flow"}<select value={flow} onChange={e=>setFlow(e.target.value)}>{flows.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>{ka?"შენიშვნა":"Notes"}<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label><button type="button" disabled={busy} onClick={()=>void submit()} style={{gridColumn:"1/-1",height:50,border:0,borderRadius:9,background:"var(--ink)",color:"white"}}>{busy?(ka?"ინახება…":"Saving…"):(ka?"დღის შენახვა":"Save today")}</button>{notice&&<p role="status">{notice}</p>}</div>}

export default function InnerPage({kind}:{kind:PageKind}){
  const {lang,setLang}=useSiteLanguage();
  const features=useSiteFeatures();
  const featureStatus=useSiteFeaturesStatus();
  const pathByKind:Partial<Record<PageKind,string>>={blog:"/blog",market:"/market",premium:"/premium",consultation:"/consultation",dashboard:"/app/dashboard",log:"/app/log",insights:"/app/insights",report:"/app/report"};
  const featureId=featureForRoute(pathByKind[kind]||"");
  const featureDisabled=featureId!==null&&!features[featureId];
  if(featureDisabled&&kind!=='consultation'&&featureStatus!=='ready')return <><InnerHeader lang={lang} setLang={setLang}/><main className="inner-container settings-workspace"><p role="status">{featureStatus==='loading'?(lang==='ka'?'პარამეტრები იტვირთება…':'Loading settings…'):(lang==='ka'?'პარამეტრები ვერ ჩაიტვირთა. სცადე განახლება.':'Could not load settings. Please retry.')}</p>{featureStatus==='error'&&<button type="button" onClick={()=>window.location.reload()}>{lang==='ka'?'განახლება':'Reload'}</button>}</main></>;
  if(kind==="login"||kind==="register"||kind==="forgot-password"||kind==="reset-password")return <AuthPage kind={kind} lang={lang}/>;
  if(kind==='settings')return <><InnerHeader lang={lang} setLang={setLang}/><main className="inner-container settings-workspace"><nav className="workspace-nav" aria-label={lang==='ka'?'ჩემი სივრცე':'My space'}><a href="/community">{lang==='ka'?'მთავარი':'Home'}</a><a href="/app/dashboard">{lang==='ka'?'პერიოდი':'Period'}</a><a href="/app/features">{lang==='ka'?'ყველა ფუნქცია':'All features'}</a><a href="/market/orders">{lang==='ka'?'ჩემი შეკვეთები':'My orders'}</a></nav><h1>{pageInfo.settings[lang][0]}</h1><AccountSettings lang={lang}/><p><a href="/forgot-password">{lang==='ka'?'პაროლის აღდგენა':'Reset password'}</a> · <a href="/privacy">{lang==='ka'?'კონფიდენციალურობა':'Privacy'}</a></p></main></>;
  if(["dashboard","log","insights","report"].includes(kind))return featureDisabled?<UnavailableFeature lang={lang}/>:<><InnerHeader lang={lang} setLang={setLang} consult={features.doctorConsultation}/><HealthWorkspace kind={kind} lang={lang}/></>;
  return <>
    <InnerHeader lang={lang} setLang={setLang} consult={features.doctorConsultation} showActions={kind!=="admin"}/>
    {kind==="consultation"?<CareWorkspace lang={lang}/>:featureDisabled?<UnavailableFeature lang={lang}/>:kind==="blog"?<div className="inner-container"><Library lang={lang}/></div>:kind==="market"?<Marketplace lang={lang}/>:kind==="admin"?<Admin lang={lang}/>:kind==="premium"?<PremiumPage lang={lang}/>:kind==="period"||kind==="ovulation"?<FreeCalculator kind={kind} lang={lang}/>:<StandardPage kind={kind} lang={lang}/>}
    {kind!=="admin"&&<footer className="inner-footer"><div className="inner-container"><InnerLogo lang={lang} inverse/><p>{lang==="ka"?"შენი ჯანმრთელობის ცნობიერება იწყება აქ.":"Your health awareness starts here."}</p></div></footer>}
  </>
}

function UnavailableFeature({lang}:{lang:Lang}){return <section className="inner-hero compact"><div className="inner-container"><span className="inner-kicker">TUTA</span><h1>{lang==="ka"?"ეს ფუნქცია დროებით გამორთულია":"This feature is temporarily unavailable"}</h1><p>{lang==="ka"?"სცადე მოგვიანებით ან დაბრუნდი მთავარ გვერდზე.":"Please try again later or return to the home page."}</p><a className="inner-nav-cta" href="/">{lang==="ka"?"მთავარზე დაბრუნება":"Back to home"}</a></div></section>}
