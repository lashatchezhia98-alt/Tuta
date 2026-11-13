import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Icon } from './Art';
import { cycleEducation, cycleSources, trackingJourney } from './cycle-guidance.mjs';
import { C, T, s, CTA } from './ui';
import type { Data, Tab } from './types';
import { useJourneyEnabled } from './useJourneyEnabled';

export function CycleEducation({data,birthDate}:{data:Data;birthDate?:string}) {
  const [expanded, setExpanded] = useState(false);
  const content = cycleEducation(data.periods, birthDate, data.lang);
  return <View style={[s.card, {paddingVertical: 6}]}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={() => setExpanded(value => !value)} style={[s.topBar, {minHeight: 44, gap: 12}]}>
      <T weight="bold" style={{flex: 1}}>{data.lang === 'ka' ? 'საცნობარო ინფორმაცია' : 'Reference information'}</T>
      <View style={{transform: [{rotate: expanded ? '-90deg' : '90deg'}]}}><Icon name="arrow" size={18} /></View>
    </Pressable>
    {expanded ? <View style={{paddingBottom: 10}}>
    <T weight="bold" style={{fontSize:18}}>{content.heading}</T><T style={[s.muted,{marginTop:10}]}>{content.summary}</T>
    {content.paragraphs.map(text=><T key={text} style={[s.muted,{marginTop:12}]}>{text}</T>)}
    <View style={s.wrap}>{cycleSources.map(source=><Pressable key={source.label} accessibilityRole="link" accessibilityLabel={source.label} onPress={()=>void Linking.openURL(source.url).catch(()=>{})} style={{minHeight:44,justifyContent:'center',paddingRight:16}}><T style={{textDecorationLine:'underline'}}>{source.label} ↗</T></Pressable>)}</View>
    </View> : null}
  </View>;
}

export function GuidedJourney({data,onNavigate}:{data:Data;onNavigate:(tab:Tab)=>void}) {
  const ka = data.lang === 'ka';
  const {status,retry} = useJourneyEnabled();
  if(status!=='enabled')return <View style={s.content}><T>{status==='loading'?(ka?'იტვირთება…':'Loading…'):status==='disabled'?(ka?'გზამკვლევი დროებით გამორთულია.':'The journey is temporarily disabled.'):(ka?'პარამეტრები ვერ ჩაიტვირთა.':'Could not load settings.')}</T>{status==='error'&&<CTA title={ka?'ხელახლა ცდა':'Retry'} onPress={retry}/>}</View>;
  const steps = trackingJourney(data, data.lang);
  const routes:Record<string,Tab>={period:'calendar',log:'log',insights:'insights'};
  return <View style={s.content}><T weight="display" style={s.title}>{ka?'პირადი გზამკვლევი':'Guided journey'}</T>
    {steps.map(step=><View style={[s.card,{backgroundColor:step.done?C.yellow:C.white}]} key={step.id}><T>{step.done?(ka?'✓ შესრულებულია':'✓ Completed'):(ka?'შემდეგი ნაბიჯი':'Next step')}</T><T weight="bold" style={{fontSize:18,marginVertical:10}}>{step.title}</T><T style={s.muted}>{step.detail}</T><CTA title={ka?'გახსნა':'Open'} onPress={()=>onNavigate(routes[step.action])}/></View>)}
  </View>;
}
