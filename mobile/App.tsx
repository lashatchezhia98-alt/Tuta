import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,KeyboardAvoidingView,Linking,Platform,Pressable,ScrollView,Share,TextInput,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {StatusBar} from 'expo-status-bar';
import {useFonts} from 'expo-font';
import {Fredoka_600SemiBold} from '@expo-google-fonts/fredoka/600SemiBold';
import {NotoSansGeorgian_400Regular} from '@expo-google-fonts/noto-sans-georgian/400Regular';
import {NotoSansGeorgian_700Bold} from '@expo-google-fonts/noto-sans-georgian/700Bold';
import {Icon,MoonFlower,Face,CycleOrbit} from './src/Art';
import {C,T,CTA,Chip,DateField,FieldLabel,Scale,s} from './src/ui';
import PasswordInput from './src/PasswordInput';
import {Data,Log,Tab,emptyData,validData} from './src/types';
import {dateKey,stamp,addDays,validSetup,validBirthDate,cycleAt,calendarState,averages,predictions,forecast,distance,monthLabel,symptomPatterns} from './src/cycle.mjs';
import {isSupabaseConfigured,supabase} from './src/supabase';
import type {Session} from '@supabase/supabase-js';
import {CommunityFeed} from './src/CommunityFeed';
import {AppMenu,MenuPage} from './src/MenuPages';
import {PregnancyScreen,PartnerScreen} from './src/HealthFeatureScreens';
import {CycleEducation,GuidedJourney} from './src/CycleSupport';
import {overlapsPeriod} from './src/cycle.mjs';

const KEY='tuta.mobile.v1';
const moods=[['happy','ბედნიერი','Happy'],['calm','მშვიდი','Calm'],['low','სევდიანი','Low'],['tense','დაძაბული','Tense'],['tired','დაღლილი','Tired']];
import { symptoms } from './src/symptoms.mjs';
const phases:Record<string,[string,string]>={menstruation:['მენსტრუაცია','Period'],follicular:['ფოლიკულური','Follicular'],ovulation:['ოვულაცია','Ovulation'],luteal:['ლუთეალური','Luteal'],unknown:['ფაზა უცნობია','Phase unknown']};
const tabs:[Tab,string,string][]=[['home','მთავარი','Home'],['cycle','პერიოდი','Period'],['calendar','კალენდარი','Calendar'],['log','დღიური','Log'],['insights','ანალიზი','Insights']];
type Shared={data:Data;save:(d:Data)=>Promise<boolean>;birthDate?:string};

export default function App(){
 const [fonts,error]=useFonts({Display:Fredoka_600SemiBold,Body:NotoSansGeorgian_400Regular,BodyBold:NotoSansGeorgian_700Bold});
 if(!fonts&&!error)return <View style={[s.root,{justifyContent:'center'}]}><ActivityIndicator color={C.ink}/></View>;
 return <SafeAreaProvider><Shell/></SafeAreaProvider>;
}
function Shell(){
 const [data,setData]=useState<Data>(emptyData),[ready,setReady]=useState(false),[problem,setProblem]=useState('');
 const [legacy,setLegacy]=useState<Data|null>(null),[loadedUser,setLoadedUser]=useState<string|null>(null);
 const [tab,setTab]=useState<Tab>('home'),[logDate,setLogDate]=useState(dateKey()),[calendarDate,setCalendarDate]=useState(dateKey()),[dirty,setDirty]=useState(false),[pending,setPending]=useState<Tab|null>(null);
 const [session,setSession]=useState<Session|null>(null),[authMode,setAuthMode]=useState<'login'|'register'|'forgot'|'reset'|null>(null),[authBusy,setAuthBusy]=useState(false);
 const [menuOpen,setMenuOpen]=useState(false);
 const insets=useSafeAreaInsets();const scroll=useRef<ScrollView>(null);const saving=useRef(false);const handledAuthLink=useRef<string|null>(null);const revision=useRef<number|null>(null);const activeUser=useRef<string|null>(null);
 useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[tab,data.periods.length===0]);
 useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[authMode]);
 useEffect(()=>{if(!supabase){setReady(true);return}let alive=true;void supabase.auth.getSession().then(({data:{session}})=>{if(alive)setSession(session)}).finally(()=>{if(alive)setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{setSession(next);if(event==='PASSWORD_RECOVERY')setAuthMode('reset');else if(next)setAuthMode(mode=>mode==='reset'?mode:null)});return()=>{alive=false;subscription.unsubscribe()}},[]);
 const refresh=useCallback(async(userId:string)=>{
  if(!supabase)return;
  const {data:row,error}=await supabase.from('health_state').select('payload,revision').eq('user_id',userId).maybeSingle();
  if(error)throw error;
  if(activeUser.current!==userId)return;
  if(row){if(!validData(row.payload))throw new Error('Invalid health data');setData(row.payload);revision.current=Number(row.revision)}
  else {setData(emptyData);revision.current=null}
 },[]);
 useEffect(()=>{
  const userId=session?.user.id;
  if(!userId){activeUser.current=null;revision.current=null;setData(emptyData);setLegacy(null);setLoadedUser(null);return}
  activeUser.current=userId;
  let active=true;setReady(false);setProblem('');
  void (async()=>{try{
   await refresh(userId);
   const raw=await AsyncStorage.getItem(KEY);
   if(raw){const parsed:unknown=JSON.parse(raw);if(validData(parsed)&&(parsed.periods.length>0||parsed.logs.length>0)&&active)setLegacy(parsed);else await AsyncStorage.removeItem(KEY)}
  }catch{if(active)setProblem('მონაცემთა ბაზასთან კავშირი ვერ დამყარდა. სცადე ხელახლა. / Could not load your records. Please retry.')}finally{if(active){setLoadedUser(userId);setReady(true)}}})();
  const channel=supabase!.channel(`health-state-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'health_state',filter:`user_id=eq.${userId}`},()=>{if(active&&!saving.current)void refresh(userId).catch(()=>{})}).subscribe();
  const foreground=AppState.addEventListener('change',state=>{if(state==='active'&&active&&!saving.current)void refresh(userId).catch(()=>{})});
  return()=>{active=false;foreground.remove();void supabase!.removeChannel(channel)};
 },[session?.user.id,refresh]);
 useEffect(()=>{
  if(!supabase)return;
  let active=true;
  const receive=async(url:string|null)=>{
   if(!active||!url||!url.startsWith('com.tutahealth.app://auth-callback')||handledAuthLink.current===url)return;
   handledAuthLink.current=url;
   try{
    const fragment=url.split('#')[1]||'';
    const params=new URLSearchParams(fragment||url.split('?')[1]||'');
    if(params.get('error'))throw new Error('Auth link error');
    const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');
    if(!access_token||!refresh_token)throw new Error('Missing auth tokens');
    const {error}=await supabase!.auth.setSession({access_token,refresh_token});
    if(error)throw error;
    if(active)setAuthMode(params.get('type')==='recovery'?'reset':null);
   }catch{if(active)setProblem('ელფოსტის ბმული არასწორია ან ვადა გაუვიდა. / Email link is invalid or expired.');}
  };
  void Linking.getInitialURL().then(receive).catch(()=>{});
  const listener=Linking.addEventListener('url',event=>{void receive(event.url)});
  return()=>{active=false;listener.remove()};
 },[]);
 const save=async(next:Data)=>{if(!session||!supabase){setAuthMode('login');return false}if(saving.current)return false;saving.current=true;try{
  if(!validData(next))throw new Error('Invalid health data');
  const userId=session.user.id;let row;
  if(revision.current===null){const result=await supabase.from('health_state').insert({user_id:userId,payload:next,revision:1}).select('revision').single();row=result.data;if(result.error)throw result.error}
  else {const result=await supabase.from('health_state').update({payload:next,revision:revision.current+1,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('revision',revision.current).select('revision').maybeSingle();row=result.data;if(result.error)throw result.error}
  if(!row){await refresh(userId);setProblem('ჩანაწერი სხვა მოწყობილობაზე შეიცვალა. მონაცემები განახლდა; სცადე თავიდან. / Records changed elsewhere. Review the latest data and retry.');return false}
  revision.current=Number(row.revision);setData(next);setProblem('');return true;
 }catch{setProblem('ბაზაში შენახვა ვერ მოხერხდა. შეამოწმე ინტერნეტი და სცადე ხელახლა. / Could not save to the database. Check your connection and retry.');return false}finally{saving.current=false}};
 const importLegacy=async()=>{if(!legacy)return;const merged:Data={...data,name:data.name||legacy.name,periods:[...data.periods,...legacy.periods.filter(p=>!data.periods.some(current=>current.start===p.start))].sort((a,b)=>a.start.localeCompare(b.start)),logs:[...data.logs,...legacy.logs.filter(log=>!data.logs.some(current=>current.date===log.date))].sort((a,b)=>a.date.localeCompare(b.date))};if(await save(merged)){await AsyncStorage.removeItem(KEY);setLegacy(null)}};
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;
 const nav=(next:Tab)=>{if(tab==='log'&&dirty&&next!==tab){setPending(next);return;}setTab(next);scroll.current?.scrollTo({y:0,animated:false});};
 const openLog=(date=dateKey())=>{setLogDate(date);nav('log');};
 const openCalendar=(date=dateKey())=>{setCalendarDate(date);nav('calendar');};
 if(!ready||session&&loadedUser!==session.user.id)return <View style={[s.root,{justifyContent:'center'}]}><ActivityIndicator/></View>;
 const needsSetup=data.periods.length===0&&!data.pregnancy?.active;
 return <View style={s.root}><View style={s.frame}><StatusBar style="dark"/><SafeAreaView edges={['top']} style={{flex:1,backgroundColor:C.bg}}>
 <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel={t('საზოგადოების მთავარი','Community home')} onPress={()=>{setAuthMode(null);nav('home')}}><T weight="display" style={s.logo}>{ka?'თუთა':'TUTA'}</T></Pressable>{!authMode&&<View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel={session?t('ჩემი ანგარიში','My account'):t('შესვლა','Sign in')} onPress={session?()=>nav('profile'):()=>setAuthMode('login')} style={[s.chip,{minWidth:73,minHeight:44,paddingHorizontal:12,alignItems:'center',backgroundColor:C.yellow}]}><T weight="bold" style={{fontSize:14}}>{session?t('ანგარიში','Account'):t('შესვლა','Sign in')}</T></Pressable>{!session&&<Pressable accessibilityRole="button" accessibilityLabel={t('რეგისტრაცია','Register')} onPress={()=>setAuthMode('register')} style={[s.chip,{minHeight:44,paddingHorizontal:10,alignItems:'center',backgroundColor:C.white,borderWidth:1,borderColor:C.line}]}><T weight="bold" style={{fontSize:13}}>{t('რეგისტრაცია','Register')}</T></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel={t('მენიუს გახსნა','Open menu')} onPress={()=>setMenuOpen(true)} style={s.round}><Icon name="menu"/></Pressable></View>}</View>
 {problem?<View style={[s.banner,{marginHorizontal:20}]}><T accessibilityRole="alert">{problem}</T></View>:null}
 {legacy&&session?<View style={[s.banner,{marginHorizontal:20}]}><T>{t('ამ ტელეფონზე ძველი ჩანაწერები მოიძებნა. გადაიტანე შენს ანგარიშში; წარმატებული გადატანის შემდეგ მოწყობილობიდან წაიშლება.','Older entries were found on this phone. Import them into your account; they will be removed from the device only after a successful save.')}</T><CTA title={t('ჩანაწერების გადატანა','Import entries')} onPress={()=>void importLegacy()}/></View>:null}
 {pending?<View style={[s.banner,{marginHorizontal:20}]}><T>{t('შენიშვნები ჯერ არ შეგინახავს. გახვიდე?','Your changes are not saved. Leave this page?')}</T><View style={[s.row,{marginTop:12}]}><Chip label={t('დარჩენა','Stay')} selected onPress={()=>setPending(null)}/><Chip label={t('გასვლა','Discard')} selected={false} onPress={()=>{setDirty(false);setTab(pending);setPending(null);}}/></View></View>:null}
 <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:20}}>
 {authMode?<AuthScreen kind={authMode} lang={data.lang} busy={authBusy} setBusy={setAuthBusy} back={()=>setAuthMode(null)} forgot={()=>setAuthMode('forgot')} login={()=>setAuthMode('login')} register={()=>setAuthMode('register')}/>:tab==='home'?<CommunityFeed lang={data.lang} session={session} onSignIn={()=>setAuthMode('login')}/>:['about','blog','premium','privacy','terms'].includes(tab)?<MenuPage key={tab} page={tab as 'about'|'blog'|'premium'|'privacy'|'terms'} lang={data.lang}/>:!session?<View style={s.content}><T weight="display" style={s.title}>{t('შედი შენს ანგარიშში','Sign in to your account')}</T><T style={s.muted}>{t('ციკლისა და დღიურის ჩანაწერები შენს დაცულ ანგარიშში ინახება და აპსა და ვებსაიტზე სინქრონდება.','Cycle and journal entries are saved to your private account and synced with the app and website.')}</T><CTA title={t('შესვლა ან რეგისტრაცია','Sign in or create account')} onPress={()=>setAuthMode('login')}/></View>:tab==='profile'?<Profile data={data} save={save} birthDate={session.user.user_metadata?.date_of_birth} session={session} authEnabled={isSupabaseConfigured} authBusy={authBusy} setAuthBusy={setAuthBusy}/>:tab==='pregnancy'?<PregnancyScreen data={data} save={save} token={session.access_token}/>:tab==='partners'?<PartnerScreen data={data} token={session.access_token}/>:tab==='journey'?<GuidedJourney data={data} onNavigate={nav}/>:needsSetup?<Setup data={data} save={save} birthDate={session.user.user_metadata?.date_of_birth}/>:tab==='cycle'?<Home data={data} openCalendar={openCalendar} openPregnancy={()=>nav('pregnancy')}/>:tab==='calendar'?<Calendar key={calendarDate} initialDate={calendarDate} data={data} save={save} openLog={openLog}/>:tab==='log'?<Daily key={logDate} data={data} save={save} date={logDate} dirty={setDirty}/>:<Insights data={data} birthDate={session.user.user_metadata?.date_of_birth}/>}
 </ScrollView></KeyboardAvoidingView>
 {!authMode&&<View style={[s.nav,{paddingBottom:Math.max(insets.bottom,8)}]}>{tabs.map(([id,geo,en])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:tab===id}} accessibilityLabel={t(geo,en)} onPress={()=>id==='log'&&tab!=='log'?openLog():id==='calendar'&&tab!=='calendar'?openCalendar():nav(id)} style={s.navItem}><View style={[s.navIcon,tab===id&&{backgroundColor:C.yellow}]}><Icon name={id}/></View><T weight={tab===id?'bold':'regular'} numberOfLines={2} style={{fontSize:ka?11:12,textAlign:'center',flexShrink:1}}>{t(geo,en)}</T></Pressable>)}</View>}
 <AppMenu visible={menuOpen} lang={data.lang} showSettings={!session} onClose={()=>setMenuOpen(false)} onNavigate={nav} onLanguage={()=>{if(session)void save({...data,lang:ka?'en':'ka'});else setData({...data,lang:ka?'en':'ka'});setMenuOpen(false)}}/>
 </SafeAreaView></View></View>;
}

function Setup({data,save,editing=false,birthDate}:{editing?:boolean}&Shared){
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;
 const [start,setStart]=useState(editing?data.periods.at(-1)?.start||'':''),[length,setLength]=useState(String(data.cycleLength)),[duration,setDuration]=useState(String(data.periods.at(-1)?.duration||5)),[name,setName]=useState(data.name),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const submit=async()=>{if(data.pregnancy?.active){setMessage(t('პერიოდის დასამატებლად ჯერ გამორთე ორსულობის რეჟიმი.','Turn off pregnancy mode before logging a period.'));return;}if(!validSetup(start,Number(length),Number(duration))){setMessage(t('შეიყვანე რეალური თარიღი (არა მომავალი), ციკლი 21–45 და პერიოდი 1–10 დღე.','Use a valid non-future date, cycle length 21–45 and period duration 1–10 days.'));return;}
 if(Number(duration)>distance(start,dateKey())+1){setMessage(t('სისხლდენის ხანგრძლივობაში მხოლოდ უკვე გასული დღეები ჩაწერე.','Only count bleeding days that have already happened.'));return;}
 const existing=data.periods.find(p=>p.start===start);
 if(overlapsPeriod(data.periods,{start,duration:Number(duration)},existing?.start)){setMessage(t('სისხლდენის დღეები არსებულ ჩანაწერს ემთხვევა. შესასწორებლად აირჩიე მისი დაწყების თარიღი.','Bleeding days overlap another entry. Use its start date to edit it.'));return;}
 setBusy(true);const periods=[...data.periods.filter(p=>p.start!==start),{start,duration:Number(duration)}].sort((a,b)=>a.start.localeCompare(b.start));
 if(await save({...data,name:name.trim(),cycleLength:Number(length),periods})){setMessage(t('შენახულია ✓','Saved ✓'));}setBusy(false);};
 return <View style={s.content}>{!editing&&<><View style={{alignItems:'center',backgroundColor:C.lav,borderRadius:32,marginBottom:24}}><MoonFlower size={170}/></View><T weight="display" style={s.title}>{t('შენი რიტმით.','In your rhythm.')}</T><T style={[s.muted,{marginBottom:24}]}>{t('დავიწყოთ შენი ციკლით. ჩანაწერები შენს ანგარიშში შეინახება.','Let’s start with your cycle. Entries will be saved to your account.')}</T></>}
 <View style={s.section}><FieldLabel>{t('სახელი (სურვილისამებრ)','Name (optional)')}</FieldLabel><TextInput accessibilityLabel="Name" style={s.input} value={name} onChangeText={setName} maxLength={40}/></View>
 <View style={s.section}><FieldLabel>{t('პერიოდის დაწყება','Period start')}</FieldLabel><DateField label={t('პერიოდის დაწყება','Period start')} value={start} onChange={value=>{setStart(value);try{setDuration(String(Math.min(Number(duration)||5,Math.max(1,distance(value,dateKey())+1))))}catch{}}} ka={ka}/><T style={s.muted}>{t('ახალი თარიღი ისტორიას დაემატება.','A new date adds a period to history.')}</T></View>
 <View style={[s.row,s.section,{alignItems:'flex-start'}]}><View style={{flex:1}}><FieldLabel>{t('ციკლი (დღე)','Cycle (days)')}</FieldLabel><TextInput accessibilityLabel="Cycle length" style={s.input} keyboardType="number-pad" value={length} onChangeText={setLength} maxLength={2}/></View><View style={{flex:1}}><FieldLabel>{t('გასული სისხლდენის დღეები','Bleeding days so far')}</FieldLabel><TextInput accessibilityLabel="Period duration" style={s.input} keyboardType="number-pad" value={duration} onChangeText={setDuration} maxLength={2}/></View></View>
 <CycleEducation data={data} birthDate={birthDate}/>
 {message?<T accessibilityLiveRegion="polite" style={s.error}>{message}</T>:null}<CTA title={busy?t('ინახება…','Saving…'):editing?t('შენახვა','Save period'):t('დავიწყოთ','Find my rhythm')} onPress={()=>void submit()} disabled={busy}/>
 <T style={[s.muted,{marginTop:20}]}>{t('შენახული ჩანაწერები სინქრონდება შენს ანგარიშთან.','Saved entries sync with your account.')}</T>
 </View>;
}
function Home({data,openCalendar,openPregnancy}:{data:Data;openCalendar:(date?:string)=>void;openPregnancy:()=>void}){
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;
 if(data.pregnancy?.active)return <View style={s.content}><T weight="display" style={s.title}>{t('ორსულობის რეჟიმი','Pregnancy mode')}</T><T style={s.muted}>{t('პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია.','Period and fertile-day estimates are paused.')}</T><CTA title={t('ორსულობის გვერდი','Pregnancy page')} onPress={openPregnancy}/></View>;
 const c=cycleAt(data.periods,data.cycleLength);if(!c)return null;
 const today=dateKey(),model=forecast(data.periods,data.cycleLength),left=distance(today,c.next);
 const week=Array.from({length:7},(_,i)=>addDays(today,i-3));
 const phase=model.status==='overdue'||model.reliability==='low'&&c.phase!=='menstruation'?'unknown':c.phase;
 const reliability=model.reliability==='consistent'?t('ისტორიაზე დაფუძნებული','Based on your history'):model.reliability==='low'?t('სიზუსტე შეზღუდულია','Limited accuracy'):t('საწყისი შეფასება','Initial estimate');
 return <View style={s.content}>
  <T style={[s.muted,{fontSize:15}]}>{data.name?t(`გამარჯობა, ${data.name}`,`Hello, ${data.name}`):t('შენი სივრცე','Your space')}</T>
  <T weight="display" style={[s.title,{marginTop:3,marginBottom:18}]}>{t('დღეს შენს რიტმში','Today in your rhythm')}</T>
  <View style={[s.card,{backgroundColor:'#EEE6F7',borderColor:'#E1D3F1',padding:20,overflow:'hidden'}]}>
   <View style={s.topBar}><T weight="bold" style={{fontSize:14,color:C.muted}}>{t('მიმდინარე ციკლი','CURRENT CYCLE')}</T><T style={{fontSize:14,color:C.muted}}>{t(`${c.length} დღიანი შეფასება`,`${c.length}-day estimate`)}</T></View>
   <View style={[s.row,{gap:10,justifyContent:'space-between'}]}><View style={{flex:1}}><T style={s.muted}>{t('ციკლის დღე','Cycle day')}</T><T weight="display" style={{fontSize:69,lineHeight:78}}>{c.day}</T><View style={{alignSelf:'flex-start',backgroundColor:C.white,borderRadius:12,paddingHorizontal:10,paddingVertical:7,marginTop:5,maxWidth:'100%'}}><T weight="bold" style={{fontSize:14}}>{phases[phase][ka?0:1]}</T></View></View><CycleOrbit day={c.day} length={c.length} size={142}/></View>
   <T style={[s.muted,{marginTop:17}]}>{t('ფაზა სავარაუდოა და ჩანაწერების მიხედვით იცვლება.','Phase is estimated and updates with your entries.')}</T>
  </View>
  <Pressable accessibilityRole="button" accessibilityLabel={t('შემდეგი პერიოდის კალენდარში ნახვა','View next period in calendar')} onPress={()=>openCalendar(model.status==='active'&&model.expected?model.expected:today)} style={s.card}><View style={s.topBar}><T weight="bold" style={{fontSize:18}}>{t('შემდეგი პერიოდი','Next period')}</T><Icon name="arrow" size={19}/></View><T weight="display" style={{fontSize:27,lineHeight:36}}>{model.status==='overdue'?t('პროგნოზი შეჩერებულია','Estimate paused'):left>0?t(`${left} დღეში`,`In ${left} days`):t('სავარაუდოდ დღეს','Estimated today')}</T><T style={[s.muted,{marginTop:5}]}>{model.status==='active'?`${model.expected} · ${reliability}`:t('ჩაწერე დაწყების თარიღი კალენდარში.','Record the start date in Calendar.')}</T></Pressable>
  <View style={s.card}><T weight="bold" style={{fontSize:18,marginBottom:14}}>{t('შენი კვირა','Your week')}</T><View style={{flexDirection:'row',gap:5}}>{week.map(day=>{const state=calendarState(data.periods,data.cycleLength,day,undefined,data.pregnancy?.active);const weekday=new Date(`${day}T12:00:00Z`).getUTCDay();const labels=ka?['კვ','ორ','სა','ოთ','ხუ','პა','შა']:['Su','Mo','Tu','We','Th','Fr','Sa'];return <Pressable key={day} accessibilityRole="button" accessibilityLabel={day} onPress={()=>openCalendar(day)} style={{flex:1,minHeight:62,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:day===today?C.ink:state==='period'?C.lav:state==='fertile'?C.yellow:'#F3F1F6'}}><T style={{fontSize:13,color:day===today?C.white:C.muted}}>{labels[weekday]}</T><T weight="bold" style={{fontSize:16,color:day===today?C.white:C.ink}}>{Number(day.slice(-2))}</T></Pressable>})}</View></View>
  <T style={s.muted}>{t('პროგნოზები შეფასებაა და არ წარმოადგენს კონტრაცეფციის მეთოდს.','Predictions are estimates and are not a method of contraception.')}</T>
 </View>;
}
function Daily({data,save,date,dirty}:{date:string;dirty:(v:boolean)=>void}&Shared){
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;
 const blank=(d:string):Log=>({date:d,mood:'calm',energy:3,pain:1,flow:'none',symptoms:[],notes:''});
 const [savedDate,setSavedDate]=useState(date);const [entry,setEntry]=useState<Log>(()=>data.logs.find(l=>l.date===date)||blank(date)),[custom,setCustom]=useState(''),[symptomSearch,setSymptomSearch]=useState(''),[showAllSymptoms,setShowAllSymptoms]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const change=(patch:Partial<Log>)=>{setEntry(e=>({...e,...patch}));dirty(true);setMessage('');};
 const toggle=(sym:string)=>change({symptoms:entry.symptoms.includes(sym)?entry.symptoms.filter(s=>s!==sym):[...entry.symptoms,sym]});
 const query=symptomSearch.trim().toLocaleLowerCase();
 const visibleSymptoms=symptoms.filter(([id,a,b],i)=>entry.symptoms.includes(id)||(query?`${a} ${b}`.toLocaleLowerCase().includes(query):showAllSymptoms||i<9));
 const submit=async()=>{try{stamp(entry.date);if(entry.date>dateKey())throw new Error();}catch{setMessage(t('თარიღი უნდა იყოს დღეს ან წარსულში.','Choose a valid date today or in the past.'));return;}
 if(entry.date!==savedDate&&data.logs.some(l=>l.date===entry.date)){setMessage(t('ამ თარიღზე ჩანაწერი უკვე გაქვს. მის შესაცვლელად გახსენი კალენდრიდან.','There is already a check-in for this date. Open it from the calendar to edit.'));return;}
 setBusy(true);const symptom=custom.trim();const final={...entry,symptoms:[...new Set([...entry.symptoms,...(symptom?[symptom]:[])])]};if(await save({...data,logs:[...data.logs.filter(l=>l.date!==entry.date),final].sort((a,b)=>a.date.localeCompare(b.date))})){setEntry(final);setSavedDate(final.date);setCustom('');dirty(false);setMessage(t('შენახულია ✓','Check-in saved ✓'));}setBusy(false);};
 return <View style={s.content}><T style={[s.muted,{fontSize:15}]}>{t('ყოველდღიური ჩანაწერი','DAILY CHECK-IN')}</T><T weight="display" style={[s.title,{marginTop:4,marginBottom:10}]}>{t('როგორ ხარ დღეს?','How do you feel?')}</T><T style={[s.muted,{marginBottom:20}]}>{t('მონიშნე მხოლოდ ის, რაც დღეს შენთვის მნიშვნელოვანია.','Record what matters to you today. You can edit it later.')}</T>
 <View style={s.section}><FieldLabel>{t('თარიღი','Date')}</FieldLabel><DateField label={t('თარიღი','Date')} value={entry.date} onChange={v=>change({date:v})} ka={ka}/><T style={s.muted}>{t('უკვე შენახული დღის შესაცვლელად გახსენი ის კალენდარში.','To edit an existing day, open it from the calendar.')}</T></View>
 <View style={s.section}><FieldLabel>{t('როგორ გრძნობ თავს?','How are you feeling today?')}</FieldLabel><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:4}}>{moods.map(([id,geo,en])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:entry.mood===id}} onPress={()=>change({mood:id})} style={{width:86,minHeight:112,paddingVertical:12,borderRadius:18,borderWidth:entry.mood===id?2:1,borderColor:entry.mood===id?C.ink:'#E8E4ED',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:entry.mood===id?C.lav:'#F8F7FA'}}><Face mood={id} size={50}/><T weight={entry.mood===id?'bold':'regular'} style={{fontSize:14,textAlign:'center'}}>{t(geo,en)}</T></Pressable>)}</ScrollView></View>
 <Scale label={t('ენერგია · 1 დაბალი, 5 მაღალი','Energy · 1 low, 5 high')} value={entry.energy} onChange={energy=>change({energy})}/><Scale label={t('ტკივილი · 1 მსუბუქი, 5 ძლიერი','Pain · 1 mild, 5 severe')} value={entry.pain} onChange={pain=>change({pain})}/>
 <View style={s.section}><FieldLabel>{t('ნაკადი','Flow')}</FieldLabel><View style={s.wrap}>{[['none','არ არის','None'],['spotting','ლაქები','Spotting'],['light','მსუბუქი','Light'],['medium','საშუალო','Medium'],['heavy','ძლიერი','Heavy']].map(([id,a,b])=><Chip key={id} label={t(a,b)} selected={entry.flow===id} onPress={()=>change({flow:id})}/>)}</View></View>
 <View style={s.section}><FieldLabel>{t('დღის სიმპტომები','Any symptoms today?')}</FieldLabel><TextInput accessibilityLabel={t('სიმპტომების ძიება','Search symptoms')} style={s.input} placeholder={t('მოძებნე სიმპტომი','Search symptoms')} placeholderTextColor={C.muted} value={symptomSearch} onChangeText={setSymptomSearch}/><View style={[s.wrap,{marginTop:12}]}>{visibleSymptoms.map(([id,a,b])=><Chip key={id} label={t(a,b)} selected={entry.symptoms.includes(id)} onPress={()=>toggle(id)}/>)}{entry.symptoms.filter(x=>!symptoms.some(s=>s[0]===x)).map(x=><Chip key={x} label={x} selected onPress={()=>toggle(x)}/>)}</View>{!symptomSearch.trim()&&<Pressable accessibilityRole="button" onPress={()=>setShowAllSymptoms(!showAllSymptoms)} style={{minHeight:48,justifyContent:'center'}}><T weight="bold">{showAllSymptoms?t('ნაკლების ჩვენება','Show fewer'):t('ყველა სიმპტომის ჩვენება','See all symptoms')}</T></Pressable>}</View>
 <View style={s.section}><FieldLabel>{t('სხვა სიმპტომი','Add your own symptom')}</FieldLabel><TextInput accessibilityLabel="Custom symptom" style={s.input} placeholder={t('მაგ. თავბრუსხვევა','For example, dizziness')} placeholderTextColor={C.muted} value={custom} maxLength={60} onChangeText={v=>{setCustom(v);dirty(true);}}/><Pressable accessibilityRole="button" onPress={()=>{if(custom.trim()){change({symptoms:[...new Set([...entry.symptoms,custom.trim()])]});setCustom('');}}} style={{minHeight:48,justifyContent:'center'}}><T weight="bold">{t('+ დამატება','+ Add symptom')}</T></Pressable></View>
 <View style={s.section}><FieldLabel>{t('რას გრძნობ დღეს?','Anything else on your mind?')}</FieldLabel><TextInput accessibilityLabel="Daily notes" multiline textAlignVertical="top" style={[s.input,{minHeight:130}]} placeholder={t('მომიყევი შენს დღეზე…','A little note about your day…')} placeholderTextColor={C.muted} value={entry.notes} maxLength={2000} onChangeText={notes=>change({notes})}/><T style={[s.muted,{textAlign:'right'}]}>{entry.notes.length}/2000</T></View>
 {message?<View style={s.banner}><T accessibilityLiveRegion="polite">{message}</T></View>:null}<CTA title={busy?t('ინახება…','Saving…'):t('დღის შენახვა','Save check-in')} disabled={busy} onPress={()=>void submit()}/>
 </View>;
}

function Calendar({data,save,openLog,initialDate}:{data:Data;openLog:(date:string)=>void;initialDate:string}&Shared){
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;
 const [month,setMonth]=useState(()=>new Date(Number(initialDate.slice(0,4)),Number(initialDate.slice(5,7))-1,1)),[selected,setSelected]=useState(initialDate);
 const [editing,setEditing]=useState(false),[periodDuration,setPeriodDuration]=useState(5),[periodMessage,setPeriodMessage]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 const first=(month.getDay()+6)%7;const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const cells=Array.from({length:Math.ceil((first+count)/7)*7},(_,i)=>i-first+1);
 const selectedLog=data.logs.find(l=>l.date===selected);const c=cycleAt(data.periods,data.cycleLength,selected);
 const recorded=selected<=dateKey()?data.periods.find(p=>selected>=p.start&&selected<addDays(p.start,p.duration)):undefined;
 const periodStart=recorded?.start||selected;
 const changeDate=(key:string)=>{setSelected(key);setEditing(false);setPeriodMessage('');setConfirmDelete(false);};
 const savePeriod=async()=>{if(data.pregnancy?.active){setPeriodMessage(t('პერიოდის დასამატებლად ჯერ გამორთე ორსულობის რეჟიმი.','Turn off pregnancy mode before logging a period.'));return;}if(!validSetup(periodStart,data.cycleLength,periodDuration)||periodDuration>distance(periodStart,dateKey())+1){setPeriodMessage(t('აირჩიე წარსული დაწყება და მხოლოდ უკვე გასული სისხლდენის დღეები (1–10).','Choose a past start and only bleeding days that have already happened (1–10).'));return;}
  if(overlapsPeriod(data.periods,{start:periodStart,duration:periodDuration},recorded?.start)){setPeriodMessage(t('სისხლდენის დღეები სხვა ჩანაწერს ემთხვევა.','Bleeding days overlap another entry.'));return;}
  const periods=[...data.periods.filter(p=>p.start!==recorded?.start),{start:periodStart,duration:periodDuration}].sort((a,b)=>a.start.localeCompare(b.start));
  if(await save({...data,periods})){setEditing(false);setPeriodMessage(t('პერიოდი შენახულია ✓','Period saved ✓'));}
 };
 const deletePeriod=async()=>{if(!recorded)return;if(await save({...data,periods:data.periods.filter(p=>p.start!==recorded.start)})){setEditing(false);setConfirmDelete(false);setPeriodMessage(t('პერიოდი წაიშალა','Period removed'));}};
 return <View style={s.content}><T style={[s.muted,{fontSize:15}]}>{t('თვეების მიმოხილვა','CYCLE CALENDAR')}</T><T weight="display" style={[s.title,{marginTop:4,marginBottom:18}]}>{t('შენი კალენდარი','Your calendar')}</T>
 <View style={s.card}><View style={s.topBar}><Pressable accessibilityRole="button" accessibilityLabel={t('წინა თვე','Previous month')} style={s.round} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><Icon name="back"/></Pressable><View style={{alignItems:'center',flex:1}}><T weight="bold" style={{fontSize:21}}>{monthLabel(month,ka)}</T><T style={s.muted}>{month.getFullYear()}</T></View><Pressable accessibilityRole="button" accessibilityLabel={t('შემდეგი თვე','Next month')} style={s.round} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><Icon name="arrow"/></Pressable></View><View style={{flexDirection:'row'}}>{(ka?['ორ','სა','ოთ','ხუ','პა','შა','კვ']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map(x=><View key={x} style={[s.cell,{alignItems:'center',paddingVertical:12}]}><T style={{fontSize:12}}>{x}</T></View>)}</View>
 <View style={{flexDirection:'row',flexWrap:'wrap'}}>{cells.map((n,i)=>{if(n<1||n>count)return <View key={i} style={s.cell}/>;const key=dateKey(new Date(month.getFullYear(),month.getMonth(),n));const state=calendarState(data.periods,data.cycleLength,key,undefined,data.pregnancy?.active);const logged=data.logs.some(l=>l.date===key);return <View key={key} style={s.cell}><Pressable accessibilityRole="button" accessibilityLabel={`${key}${state?`, ${state}`:''}${logged?', logged':''}`} accessibilityState={{selected:selected===key}} onPress={()=>changeDate(key)} style={[s.day,{backgroundColor:state==='period'?C.lav:state==='fertile'?C.yellow:state==='predicted'?C.white:'#F4F2F7',borderColor:state==='predicted'?'#A78BC9':'transparent',borderStyle:state==='predicted'?'dashed':'solid'},selected===key&&{borderColor:C.ink,borderWidth:2,borderStyle:'solid'}]}><T weight={key===dateKey()?'bold':'regular'}>{n}</T>{logged&&<View style={{width:4,height:4,borderRadius:3,backgroundColor:C.ink,position:'absolute',bottom:4}}/>}</Pressable></View>;})}</View>
 <View style={[s.wrap,{marginTop:18}]}>{[[C.lav,t('ჩაწერილი პერიოდი','Recorded period'),false],[C.yellow,t('სავარაუდო ნაყოფიერი დღეები','Estimated fertile days'),false],[C.white,t('სავარაუდო პერიოდი','Predicted period'),true]].map(([color,label,dashed])=><View key={String(label)} style={s.row}><View style={{width:14,height:14,borderRadius:6,backgroundColor:String(color),borderWidth:dashed?1:0,borderColor:'#A78BC9',borderStyle:dashed?'dashed':'solid'}}/><T style={{fontSize:12}}>{label}</T></View>)}</View></View>
 <View style={[s.card,{backgroundColor:C.ink}]}><T style={{color:C.lav,marginBottom:8}}>{selected}</T><T weight="display" style={{fontSize:24,color:C.yellow}}>{recorded?t('ჩაწერილი მენსტრუაცია','Recorded period'):selected>dateKey()?t('სავარაუდო თარიღი','Estimated date'):c?t(`ციკლის დღე ${c.day}`,`Cycle day ${c.day}`):t('ციკლი არ არის ჩაწერილი','No cycle recorded')}</T><T style={{color:C.white,marginTop:8}}>{recorded?t(`დაიწყო ${recorded.start} · ${recorded.duration} დღე`,`Started ${recorded.start} · ${recorded.duration} days`):selected>dateKey()?t('ეს მხოლოდ პროგნოზია.','This is only an estimate.'):c?phases[c.phase][ka?0:1]:''}</T>{selectedLog&&<T numberOfLines={3} style={{color:C.lav,marginTop:12}}>{selectedLog.notes||t('დღიური შენახულია ✓','Check-in saved ✓')}</T>}</View>
 {selected<=dateKey()&&<><CTA title={selectedLog?t('ჩანაწერის შეცვლა','Edit check-in'):t('დღიურის დამატება','Add check-in')} onPress={()=>openLog(selected)}/><Pressable accessibilityRole="button" onPress={()=>{setEditing(!editing);setPeriodDuration(Math.min(recorded?.duration||5,distance(periodStart,dateKey())+1));setPeriodMessage('');}} style={{minHeight:52,justifyContent:'center',alignItems:'center'}}><T weight="bold">{recorded?t('პერიოდის შეცვლა','Edit recorded period'):t('+ მენსტრუაციის დაწყების ჩაწერა','+ Record period start')}</T></Pressable></>}
 {editing&&<View style={[s.card,{backgroundColor:C.lav}]}><T weight="bold">{recorded?t('სისხლდენის დღეები','Bleeding days'):t(`დაწყება: ${selected}`,`Start: ${selected}`)}</T><T style={[s.muted,{marginVertical:10}]}>{t('მონიშნე მხოლოდ ის დღეები, რომლებიც უკვე გავიდა. მოგვიანებით შეგიძლია გაზარდო.','Count only days that have already happened. You can update this later.')}</T><View style={s.wrap}>{Array.from({length:Math.min(10,distance(periodStart,dateKey())+1)},(_,i)=><Chip key={i} label={String(i+1)} selected={periodDuration===i+1} onPress={()=>setPeriodDuration(i+1)}/>)}</View><View style={{marginTop:14}}><CTA title={t('პერიოდის შენახვა','Save period')} onPress={()=>void savePeriod()}/></View>{recorded&&<Pressable accessibilityRole="button" onPress={()=>setConfirmDelete(true)} style={{minHeight:50,justifyContent:'center'}}><T style={{color:'#92384B'}}>{t('ამ პერიოდის წაშლა','Remove this period')}</T></Pressable>}{confirmDelete&&<View style={s.wrap}><Chip label={t('გაუქმება','Cancel')} selected={false} onPress={()=>setConfirmDelete(false)}/><Chip label={t('წაშლის დადასტურება','Confirm removal')} selected onPress={()=>void deletePeriod()}/></View>}</View>}
 {periodMessage?<T accessibilityLiveRegion="polite" style={[s.muted,{marginTop:12}]}>{periodMessage}</T>:null}</View>;
}

function PredictionNotice({data}:{data:Data}){
 if(data.pregnancy?.active)return <View style={s.card}><T>{data.lang==='ka'?'ორსულობის რეჟიმში პერიოდისა და ნაყოფიერი დღეების პროგნოზები შეჩერებულია.':'Period and fertile-day estimates are paused in pregnancy mode.'}</T></View>;
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;const model=forecast(data.periods,data.cycleLength,undefined,data.pregnancy?.active);
 return <View style={[s.banner,{marginTop:16}]}><T weight="bold">{model.status==='overdue'?t('პროგნოზი შეჩერებულია','Predictions paused'):model.reliability==='limited'?t('საწყისი შეფასება','Initial estimate'):model.reliability==='low'?t('ციკლები განსხვავდება','Cycles vary'):t('პროგნოზი შენს ისტორიაზეა დაფუძნებული','Estimate based on your history')}</T>
 <T style={[s.muted,{marginTop:8}]}>{model.status==='overdue'?t('სავარაუდო თარიღი გავიდა. კალენდარში ჩაწერე ახალი პერიოდი, როცა დაიწყება; მანამდე მომავალ პერიოდებსა და ნაყოფიერ დღეებს არ ვაჩვენებთ.','The estimated date has passed. Log the new period in Calendar when it starts; future period and fertile-day estimates are paused.'):model.reliability==='limited'?t('საჭიროა 3 დასრულებული ციკლი. ჯერ ვიყენებთ შენს მითითებულ ხანგრძლივობას.','We need 3 completed cycles. For now, we use your chosen cycle length.'):model.reliability==='low'?t('ერთი ზუსტი თარიღი ნაკლებად სანდოა; ნაყოფიერი დღეების პროგნოზი დამალულია.','A single date is less reliable; fertile-day estimates are hidden.'):t('მეტი ზუსტი ჩანაწერი პროგნოზის განახლებაში დაგვეხმარება.','More accurate entries help us update your estimates.')}</T>
 {model.earliest&&model.latest&&model.status==='active'&&<T style={[s.muted,{marginTop:8}]}>{t('შენი წინა ციკლების დიაპაზონი: ','Range observed in your previous cycles: ')}{model.earliest} — {model.latest}</T>}
 </View>;
}
function Insights({data,birthDate}:{data:Data;birthDate?:string}){
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;const avg=averages(data.periods,data.cycleLength);const enough=avg.completed.length>=3;const model=forecast(data.periods,data.cycleLength,undefined,data.pregnancy?.active);
 const frequency=new Map<string,number>();data.logs.forEach(l=>l.symptoms.forEach(sym=>frequency.set(sym,(frequency.get(sym)||0)+1)));
 const patterns=symptomPatterns(data.periods,data.logs);
 return <View style={s.content}><T style={[s.muted,{fontSize:15}]}>{t('შენი ჩანაწერების მიხედვით','FROM YOUR ENTRIES')}</T><T weight="display" style={[s.title,{marginTop:4}]}>{t('ციკლის ანალიტიკა','Cycle insights')}</T><View style={[s.card,{backgroundColor:'#EEE6F7',borderColor:'#E1D3F1'}]}><T weight="bold" style={{fontSize:18,marginBottom:16}}>{t('შენი ციკლი რიცხვებში','Your cycle in numbers')}</T><View style={[s.row,{alignItems:'flex-start'}]}><View style={{flex:1}}><T weight="display" style={{fontSize:43,lineHeight:51}}>{Math.round(avg.length)}</T><T style={s.muted}>{enough?t('საშუალო ციკლი · დღე','Average cycle · days'):t('მითითებული ციკლი · დღე','Cycle estimate · days')}</T></View><View style={{width:1,alignSelf:'stretch',backgroundColor:'#CDBBDD'}}/><View style={{flex:1,paddingLeft:8}}><T weight="display" style={{fontSize:43,lineHeight:51}}>{Math.round(avg.duration)}</T><T style={s.muted}>{enough?t('საშუალო სისხლდენა · დღე','Average bleeding · days'):t('ბოლო ჩანაწერი · დღე','Last period · days')}</T></View></View><T style={[s.muted,{marginTop:16}]}>{enough?t(`${avg.completed.length} დასრულებული ციკლის მიხედვით`,`Based on ${avg.completed.length} completed cycles`):t('პირადი საშუალოსთვის საჭიროა 3 დასრულებული ციკლი.','Three completed cycles are needed for a personal average.')}</T></View>
<PredictionNotice data={data}/><CycleEducation data={data} birthDate={birthDate}/> <View style={s.section}><FieldLabel>{t('შენი განმეორებადი ნიშნები','Your recurring patterns')}</FieldLabel>{patterns.length===0?<T style={s.muted}>{enough?t('ერთსა და იმავე ფაზაში 3 ციკლის განმავლობაში განმეორებული სიმპტომი ჯერ არ დაფიქსირებულა.','No symptom has repeated in the same phase across 3 cycles yet.'):t('პატერნისთვის საჭიროა მინიმუმ 3 დასრულებული ციკლი და დღიური ჩანაწერები.','Patterns need at least 3 completed cycles with check-ins.')}</T>:patterns.map((p:{symptom:string;phase:string;count:number;total:number})=><View key={`${p.symptom}-${p.phase}`} style={[s.card,{backgroundColor:C.yellow,marginBottom:10}]}><T weight="bold">{symptoms.find(s=>s[0]===p.symptom)?.[ka?1:2]||p.symptom}</T><T style={s.muted}>{phases[p.phase]?.[ka?0:1]||p.phase} · {t(`${p.count} ციკლში`,`In ${p.count} cycles`)}</T></View>)}</View><View style={s.section}><FieldLabel>{t('ციკლების ისტორია','Cycle history')}</FieldLabel>{avg.completed.length===0?<T style={s.muted}>{t('კალენდარში დაამატე წინა პერიოდების დაწყების თარიღები.','Add previous period start dates in Calendar.')}</T>:avg.completed.slice(-6).reverse().map((p:{start:string;length:number})=><View key={p.start} style={{marginBottom:16}}><View style={s.topBar}><T>{p.start}</T><T weight="bold">{p.length} {t('დღე','days')}</T></View><View style={{height:10,borderRadius:5,backgroundColor:C.silver}}><View style={{height:10,borderRadius:5,backgroundColor:C.lav,width:`${Math.min(100,p.length/45*100)}%`}}/></View>{enough&&Math.abs(p.length-avg.length)>7&&<T style={[s.muted,{marginTop:6}]}>{t('საშუალოსგან განსხვავდება 7 დღეზე მეტით.','More than 7 days from your average.')}</T>}</View>)}</View>
 <View style={s.section}><FieldLabel>{t('ხშირი სიმპტომები','Your symptom journal')}</FieldLabel>{frequency.size===0?<T style={s.muted}>{t('მონიშნე სიმპტომები დღიურში და აქ შეჯამდება.','Symptoms from your check-ins will appear here.')}</T>:[...frequency.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([sym,count])=><View key={sym} style={[s.topBar,{gap:12}]}><T style={{flex:1}}>{symptoms.find(s=>s[0]===sym)?.[ka?1:2]||sym}</T><View style={{backgroundColor:C.yellow,padding:8,borderRadius:12}}><T>{count} {t('დღე','days')}</T></View></View>)}</View>
 {enough&&model.status==='active'&&<View style={s.section}><FieldLabel>{t('შემდეგი 6 პერიოდი · პროგნოზი','Next 6 periods · estimates')}</FieldLabel>{predictions(data.periods,data.cycleLength).map((d:string)=><T key={d} style={{paddingVertical:8}}>{d}</T>)}</View>}
 <T style={s.muted}>{t('ანალიტიკა ეფუძნება შენს ჩანაწერებს და არ წარმოადგენს დიაგნოზს.','Insights summarize your entries and are not a diagnosis.')}</T></View>;
}
function Profile({data,save,birthDate,session,authEnabled,authBusy,setAuthBusy}:{session:Session|null;authEnabled:boolean;authBusy:boolean;setAuthBusy:(v:boolean)=>void}&Shared){
 const ka=data.lang==='ka';const t=(a:string,b:string)=>ka?a:b;const [confirm,setConfirm]=useState(false),[confirmExport,setConfirmExport]=useState(false),[accountMessage,setAccountMessage]=useState('');const nickname=session?.user.user_metadata?.nickname;
 return <View><View style={[s.content,{paddingBottom:0}]}><T style={[s.muted,{fontSize:15}]}>{t('პარამეტრები და ანგარიში','SETTINGS & ACCOUNT')}</T><T weight="display" style={[s.title,{marginTop:4}]}>{t('შენი პროფილი','Your profile')}</T><View style={[s.card,{backgroundColor:'#EEE6F7',borderColor:'#E1D3F1'}]}><T weight="bold" style={{fontSize:18}}>{data.name||t('ანონიმური გამოყენება','Anonymous mode')}</T><T style={[s.muted,{marginTop:6}]}>{t(`${data.periods.length} ჩაწერილი პერიოდი · ${data.logs.length} დღიური ჩანაწერი`,`${data.periods.length} periods · ${data.logs.length} check-ins`)}</T></View><T weight="bold" style={{fontSize:20,marginBottom:4}}>{t('ციკლის პარამეტრები','Cycle settings')}</T></View><Setup data={data} save={save} birthDate={birthDate} editing/>
 <View style={[s.content,{paddingTop:0}]}><FieldLabel>{t('შენახული პერიოდები','Recorded periods')}</FieldLabel>{data.periods.map(p=><T key={p.start} style={{paddingVertical:8}}>{p.start} · {p.duration} {t('დღე','days')}</T>)}
 <View style={[s.section,{marginTop:18}]}><FieldLabel>{t('ანგარიში','Account')}</FieldLabel>{session?<>{typeof nickname==='string'&&nickname.trim()?<T weight="bold">{t('ნიკნეიმი','Nickname')}: {nickname}</T>:null}<T style={s.muted}>{session.user.email}</T><CTA title={authBusy?t('გამოსვლა…','Signing out…'):t('ანგარიშიდან გამოსვლა','Sign out')} disabled={authBusy} onPress={()=>{if(!supabase)return;setAuthBusy(true);void supabase.auth.signOut({scope:'local'}).then(({error})=>{setAccountMessage(error?t('ანგარიშიდან გამოსვლა ვერ მოხერხდა. სცადე ხელახლა.','Could not sign out. Please try again.'):t('ანგარიშიდან გამოხვედი ✓','You are signed out ✓'));setAuthBusy(false)}).catch(()=>{setAccountMessage(t('კავშირი ვერ დამყარდა. სცადე ხელახლა.','Could not connect. Please try again.'));setAuthBusy(false)})}}/>{accountMessage?<View style={s.banner}><T accessibilityLiveRegion="polite">{accountMessage}</T></View>:null}</>:<T style={s.muted}>{authEnabled?t('ანგარიშის შესაქმნელად ან შესასვლელად გამოიყენე ზედა ღილაკი. ჩანაწერებისთვის საჭიროა ანგარიში.','Use the top button to sign in or create an account. An account is required for entries.'):t('ანგარიშის სერვისი დაყენებული არ არის.','Account service is not configured.')}</T>}</View>
 <View style={[s.card,{backgroundColor:C.yellow,borderColor:C.yellow}]}><View style={s.row}><Icon name="lock"/><T weight="bold">{t('ექიმთან მიმოწერა · Premium','Doctor messaging · Premium')}</T></View><T style={[s.muted,{marginTop:12}]}>{t('ეს სერვისი ჯერ არ არის ჩართული. ხელმისაწვდომი გახდება ექიმებისა და გამოწერების სერვისის ამოქმედების შემდეგ.','This service is not active yet. It will become available after doctor and subscription services launch.')}</T></View>
 <View style={[s.section,{marginTop:24}]}><FieldLabel>{t('მონაცემები და კონფიდენციალურობა','Data and privacy')}</FieldLabel><T style={s.muted}>{t('ციკლისა და დღიურის ჩანაწერები ინახება შენს დაცულ ანგარიშში და სინქრონდება აპსა და ვებსაიტთან.','Cycle and journal entries are stored in your private account and synced across the app and website.')}</T><Pressable accessibilityRole="button" onPress={()=>setConfirmExport(true)} style={{minHeight:52,justifyContent:'center'}}><T weight="bold">{t('ჩემი მონაცემების ექსპორტი','Export my data')}</T></Pressable>{confirmExport&&<View style={s.banner}><T style={{marginBottom:12}}>{t('ექსპორტში იქნება შენი ჯანმრთელობის პირადი მონაცემები. გააზიარე მხოლოდ სანდო ადგილას.','The export contains private health data. Share it only with a trusted destination.')}</T><View style={s.wrap}><Chip label={t('გაუქმება','Cancel')} selected={false} onPress={()=>setConfirmExport(false)}/><Chip label={t('გაზიარება','Share export')} selected onPress={()=>{setConfirmExport(false);void Share.share({message:JSON.stringify(data,null,2),title:'Tuta data export'}).catch(()=>setAccountMessage(t('ექსპორტი ვერ გაიხსნა.','Could not open the share sheet.')))}}/></View></View>}</View>
 <View style={{marginTop:20}}>{confirm?<View style={s.banner}><T style={{marginBottom:16}}>{t('ყველა მოწყობილობაზე ციკლისა და დღიურის ჩანაწერები წაიშლება. ეს ქმედება შეუქცევადია.','Cycle and journal entries will be deleted on all devices. This cannot be undone.')}</T><View style={s.wrap}><Chip label={t('გაუქმება','Cancel')} selected={false} onPress={()=>setConfirm(false)}/><Chip label={t('ყველაფრის წაშლა','Delete everything')} selected onPress={()=>void save({...emptyData,lang:data.lang})}/></View></View>:<Pressable accessibilityRole="button" onPress={()=>setConfirm(true)} style={{minHeight:48,justifyContent:'center'}}><T style={{color:'#92384B'}}>{t('ჩემი ჩანაწერების წაშლა','Delete my entries')}</T></Pressable>}</View></View></View>;
}

function AuthScreen({kind,lang,busy,setBusy,back,forgot,login,register}:{kind:'login'|'register'|'forgot'|'reset';lang:'ka'|'en';busy:boolean;setBusy:(v:boolean)=>void;back:()=>void;forgot:()=>void;login:()=>void;register:()=>void}){
 const ka=lang==='ka';const t=(a:string,b:string)=>ka?a:b;
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[firstName,setFirstName]=useState(''),[lastName,setLastName]=useState(''),[birthDate,setBirthDate]=useState(''),[message,setMessage]=useState('');
 const isReset=kind==='reset',isForgot=kind==='forgot';
 const title=kind==='login'?t('კეთილი დაბრუნება.','Welcome back.'):kind==='register'?t('შექმენი ანგარიში.','Create your account.'):isForgot?t('პაროლის აღდგენა.','Reset your password.'):t('ახალი პაროლი.','Choose a new password.');
 const submit=async()=>{
  if(!supabase){setMessage(t('ანგარიშის სერვისი დაყენებული არ არის.','Account service is not configured.'));return}
  const normalized=email.trim().toLowerCase();
  if(!isReset&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)){setMessage(t('შეიყვანე სწორი ელფოსტა.','Enter a valid email address.'));return}
  if(kind==='register'&&(!firstName.trim()||!lastName.trim())){setMessage(t('შეიყვანე სახელი და გვარი.','Enter your first and last name.'));return}
  if(kind==='register'&&!validBirthDate(birthDate)){setMessage(t('კალენდარში აირჩიე დაბადების სწორი თარიღი.','Choose a valid birth date from the calendar.'));return}
  if(!isForgot&&password.length<8){setMessage(t('პაროლი მინიმუმ 8 სიმბოლოს უნდა შეიცავდეს.','Password must be at least 8 characters.'));return}
  if((kind==='register'||isReset)&&password!==confirm){setMessage(t('პაროლები არ ემთხვევა ერთმანეთს.','Passwords do not match.'));return}
  setBusy(true);setMessage('');
  try{
   if(isForgot){
    const {error}=await supabase.auth.resetPasswordForEmail(normalized,{redirectTo:'com.tutahealth.app://auth-callback'});
    if(error)throw error;
    setMessage(t('თუ ანგარიში არსებობს, აღდგენის ბმულს ელფოსტაზე მიიღებ. შეამოწმე სპამიც.','If the account exists, a recovery link will arrive by email. Check spam too.'));
   }else if(isReset){
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setMessage(t('ჯერ გახსენი ელფოსტაზე მიღებული აღდგენის ბმული.','Open the recovery link from your email first.'));return}
    const {error}=await supabase.auth.updateUser({password});
    if(error)throw error;
    await supabase.auth.signOut({scope:'local'});
    setPassword('');setConfirm('');
    setMessage(t('პაროლი შეიცვალა. ახლა შეგიძლია შეხვიდე.','Password updated. You can now sign in.'));
   }else if(kind==='register'){
    const {data:{session},error}=await supabase.auth.signUp({email:normalized,password,options:{data:{first_name:firstName.trim(),last_name:lastName.trim(),name:`${firstName.trim()} ${lastName.trim()}`,date_of_birth:birthDate},emailRedirectTo:'com.tutahealth.app://auth-callback'}});
    if(error)throw error;
    setMessage(session?t('ანგარიში შეიქმნა და შესული ხარ ✓','Account created and signed in ✓'):t('ანგარიში შეიქმნა. ელფოსტაზე მოსული ბმულით დაადასტურე.','Account created. Confirm it using the email link.'));
   }else{
    const {error}=await supabase.auth.signInWithPassword({email:normalized,password});
    if(error)throw error;
   }
  }catch(error){
   const raw=error instanceof Error?error.message:'';const lower=raw.toLowerCase();
   setMessage(lower.includes('already registered')?t('ეს ელფოსტა უკვე რეგისტრირებულია.','This email is already registered.'):lower.includes('invalid login')||lower.includes('invalid credentials')?t('ელფოსტა ან პაროლი არასწორია.','Email or password is incorrect.'):t('ვერ მოხერხდა. შეამოწმე კავშირი და სცადე ხელახლა.','Could not complete this request. Check your connection and try again.'));
  }finally{setBusy(false)}
 };
 return <View style={s.content}><Pressable accessibilityRole="button" onPress={back} style={{minHeight:48,justifyContent:'center'}}><T weight="bold">‹  {t('უკან','Back')}</T></Pressable><T weight="display" style={s.title}>{title}</T><T style={[s.muted,{marginBottom:24}]}>{isForgot?t('გამოგიგზავნით ერთჯერად ბმულს ახალი პაროლის დასაყენებლად.','We’ll send a one-time link to set a new password.'):t('ციკლის ჩანაწერები შენს ანგარიშში შეინახება და ყველა მოწყობილობაზე გამოჩნდება.','Your cycle entries are saved to your account and available on all devices.')}</T>
 {(kind==='login'||kind==='register')&&<View style={[s.row,{marginBottom:24,gap:10}]}>{([['login',t('შესვლა','Sign in')],['register',t('რეგისტრაცია','Create account')]] as const).map(([mode,label])=><Pressable key={mode} accessibilityRole="tab" accessibilityState={{selected:kind===mode}} disabled={busy} onPress={()=>{setMessage('');if(mode==='login')login();else register()}} style={{flex:1,minHeight:52,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:kind===mode?C.ink:C.white,borderWidth:1,borderColor:kind===mode?C.ink:C.line}}><T weight="bold" style={{color:kind===mode?C.white:C.ink,fontSize:15}}>{label}</T></Pressable>)}</View>}
 {!isReset&&<View style={s.section}><FieldLabel>{t('ელფოსტა (მომხმარებლის სახელი)','Email (username)')}</FieldLabel><TextInput accessibilityLabel={t('ელფოსტა (მომხმარებლის სახელი)','Email (username)')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" style={s.input} value={email} onChangeText={setEmail}/></View>}
 {kind==='register'&&<View style={s.section}><FieldLabel>{t('სახელი','First name')}</FieldLabel><TextInput accessibilityLabel={t('სახელი','First name')} autoCapitalize="words" textContentType="givenName" style={s.input} value={firstName} onChangeText={setFirstName} maxLength={80}/></View>}
 {kind==='register'&&<View style={s.section}><FieldLabel>{t('გვარი','Last name')}</FieldLabel><TextInput accessibilityLabel={t('გვარი','Last name')} autoCapitalize="words" textContentType="familyName" style={s.input} value={lastName} onChangeText={setLastName} maxLength={80}/></View>}
 {kind==='register'&&<View style={s.section}><FieldLabel>{t('დაბადების თარიღი','Date of birth')}</FieldLabel><DateField label={t('დაბადების თარიღი','Date of birth')} value={birthDate} onChange={setBirthDate} ka={ka} birthDate/></View>}
 {!isForgot&&<View style={s.section}><FieldLabel>{isReset?t('ახალი პაროლი','New password'):t('პაროლი','Password')}</FieldLabel><PasswordInput label={isReset?t('ახალი პაროლი','New password'):t('პაროლი','Password')} ka={ka} newPassword={kind!=='login'} value={password} onChange={setPassword}/></View>}
 {(kind==='register'||isReset)&&<View style={s.section}><FieldLabel>{t(isReset?'გაიმეორე ახალი პაროლი':'გაიმეორე პაროლი',isReset?'Confirm new password':'Confirm password')}</FieldLabel><PasswordInput label={t(isReset?'გაიმეორე ახალი პაროლი':'გაიმეორე პაროლი',isReset?'Confirm new password':'Confirm password')} ka={ka} value={confirm} onChange={setConfirm}/></View>}
 {message?<View style={s.banner}><T accessibilityLiveRegion="polite">{message}</T></View>:null}
 <CTA title={busy?t('მუშავდება…','Please wait…'):kind==='login'?t('შესვლა','Sign in'):kind==='register'?t('ანგარიშის შექმნა','Create account'):isForgot?t('ბმულის გაგზავნა','Send recovery link'):t('პაროლის შეცვლა','Update password')} disabled={busy} onPress={()=>void submit()}/>
 {kind==='login'&&<Pressable accessibilityRole="button" disabled={busy} onPress={forgot} style={{minHeight:52,justifyContent:'center',alignItems:'center'}}><T style={s.muted}>{t('დაგავიწყდა პაროლი?','Forgot password?')}</T></Pressable>}
 {(isForgot||isReset)&&<Pressable accessibilityRole="button" disabled={busy} onPress={login} style={{minHeight:52,justifyContent:'center',alignItems:'center'}}><T style={s.muted}>{t('შესვლაზე დაბრუნება','Back to sign in')}</T></Pressable>}
 </View>;
}
