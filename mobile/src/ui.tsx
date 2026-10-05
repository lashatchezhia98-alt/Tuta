import React,{useState} from 'react';
import {Modal,Pressable,StyleSheet,Text,TextProps,View} from 'react-native';
import {dateKey,monthLabel} from './cycle.mjs';
import {Icon} from './Art';
export const C={ink:'#1E1B2E',lav:'#E3D8F1',yellow:'#FDF0CC',silver:'#D8E0ED',bg:'#F9F8FC',muted:'#6F687D',line:'#E6E2EC',white:'#FFFFFF'};
export function T({children,style,weight='regular',...rest}:TextProps&{weight?:'regular'|'bold'|'display'}){
 const georgian=/[\u10A0-\u10FF\u1C90-\u1CBF]/.test(React.Children.toArray(children).filter(x=>typeof x==='string').join(''));
 return <Text {...rest} style={[{fontFamily:weight==='display'&&!georgian?'Display':weight!=='regular'?'BodyBold':'Body',fontSize:16,color:C.ink},style]}>{children}</Text>;
}
export function CTA({title,onPress,disabled=false,light=false}:{title:string;onPress:()=>void;disabled?:boolean;light?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.cta,light&&{backgroundColor:C.yellow},(disabled||pressed)&&{opacity:.6}]}><T weight="bold" style={{color:light?C.ink:C.white,fontSize:18,flex:1}}>{title}</T><Icon name="arrow" color={light?C.ink:C.white}/></Pressable>;
}
export function Chip({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[s.chip,selected&&{backgroundColor:C.lav,borderColor:'#B8A1D3'}]}><T style={{fontSize:15}}>{selected?'✓ ':''}{label}</T></Pressable>}
export function FieldLabel({children}:{children:React.ReactNode}){return <T weight="bold" style={{marginBottom:12,fontSize:18}}>{children}</T>}
export function DateField({value,onChange,ka,label}:{value:string;onChange:(v:string)=>void;ka:boolean;label:string}){
 const [open,setOpen]=useState(false),[month,setMonth]=useState(()=>new Date());
 const today=dateKey();const first=new Date(month.getFullYear(),month.getMonth(),1);const offset=(first.getDay()+6)%7;const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 return <><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>{setMonth(value?new Date(value+'T12:00:00'):new Date());setOpen(true);}} style={[s.input,s.row,{justifyContent:'space-between'}]}><T>{value|| (ka?'აირჩიე თარიღი':'Choose a date')}</T><Icon name="calendar"/></Pressable>
 <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><View style={{flex:1,backgroundColor:'#1E1B2E88',justifyContent:'center',padding:16}}><View style={{backgroundColor:C.bg,borderRadius:28,padding:16,width:'100%',maxWidth:450,alignSelf:'center'}}><FieldLabel>{label}</FieldLabel><View style={s.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" style={s.round} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><Icon name="back"/></Pressable><T weight="bold" style={{fontSize:14}}>{`${monthLabel(month,ka)} ${month.getFullYear()}`}</T><Pressable accessibilityRole="button" accessibilityLabel="Next month" style={s.round} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><Icon name="arrow"/></Pressable></View><View style={s.wrap}>{(ka?['ორ','სა','ოთ','ხუ','პა','შა','კვ']:['M','T','W','T','F','S','S']).map((d,i)=><View key={i} style={{width:'11.9%',alignItems:'center'}}><T style={{fontSize:12}}>{d}</T></View>)}</View><View style={{flexDirection:'row',flexWrap:'wrap',marginVertical:12}}>{Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{const n=i-offset+1;const key=dateKey(new Date(month.getFullYear(),month.getMonth(),n));return <View key={i} style={s.cell}>{n>0&&n<=count?<Pressable accessibilityRole="button" accessibilityLabel={key} disabled={key>today} onPress={()=>{onChange(key);setOpen(false);}} style={[s.day,{backgroundColor:key===value?C.lav:'#F0EDF5',opacity:key>today?.3:1}]}><T>{n}</T></Pressable>:null}</View>;})}</View><CTA title={ka?'დახურვა':'Close'} light onPress={()=>setOpen(false)}/></View></View></Modal></>;
}
export function Scale({label,value,onChange}:{label:string;value:number;onChange:(n:number)=>void}){return <View style={s.section}><FieldLabel>{label}</FieldLabel><View style={s.row}>{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityLabel={`${label}: ${n}`} accessibilityRole="button" accessibilityState={{selected:n===value}} onPress={()=>onChange(n)} style={[s.score,n===value&&{backgroundColor:C.lav}]}><T weight="display" style={{fontSize:26}}>{n}</T></Pressable>)}</View></View>}
export const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#EEECF2'},frame:{flex:1,width:'100%',maxWidth:520,alignSelf:'center',backgroundColor:C.bg},
 header:{paddingHorizontal:24,paddingTop:16,paddingBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 logo:{fontSize:32,letterSpacing:-1.4},round:{width:48,height:48,borderRadius:24,backgroundColor:'#FFFFFF88',alignItems:'center',justifyContent:'center'},
 content:{padding:24,paddingBottom:32},title:{fontSize:36,lineHeight:44,letterSpacing:-1,marginBottom:24},
 section:{marginBottom:28},row:{flexDirection:'row',gap:8,alignItems:'center'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
 input:{minHeight:54,borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,fontSize:16,fontFamily:'Body',color:C.ink,backgroundColor:C.white},
 cta:{minHeight:60,borderRadius:32,backgroundColor:C.ink,paddingHorizontal:24,paddingVertical:16,flexDirection:'row',alignItems:'center',gap:12},
 chip:{minHeight:48,borderRadius:16,borderWidth:1,borderColor:C.line,paddingHorizontal:15,paddingVertical:12,justifyContent:'center'},
 score:{flex:1,minHeight:60,borderRadius:18,backgroundColor:'#F0EDF5',alignItems:'center',justifyContent:'center'},
 card:{backgroundColor:C.white,borderRadius:24,padding:20,marginBottom:16},muted:{color:C.muted,fontSize:14,lineHeight:22},
 nav:{flexDirection:'row',backgroundColor:C.bg,borderTopWidth:1,borderColor:C.line,paddingTop:10,paddingHorizontal:8},
 navItem:{flex:1,alignItems:'center',minHeight:62,gap:4},navIcon:{width:48,height:32,borderRadius:20,alignItems:'center',justifyContent:'center'},
 banner:{backgroundColor:C.yellow,padding:14,borderRadius:16,marginBottom:20},
 topBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
 cell:{width:'14.2857%',padding:3},day:{minHeight:46,borderRadius:14,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'transparent'},
 error:{color:'#92384B',lineHeight:22,marginBottom:16},
});
