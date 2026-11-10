import React,{useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,TextProps,View} from 'react-native';
import {dateKey,monthLabel} from './cycle.mjs';
import {Icon} from './Art';
import {SafeAreaView} from 'react-native-safe-area-context';
export const C={ink:'#1E1B2E',lav:'#E3D8F1',yellow:'#FDF0CC',silver:'#D8E0ED',bg:'#F9F8FC',muted:'#6F687D',line:'#E6E2EC',white:'#FFFFFF'};
export function T({children,style,weight='regular',...rest}:TextProps&{weight?:'regular'|'bold'|'display'}){
 const georgian=/[\u10A0-\u10FF\u1C90-\u1CBF]/.test(React.Children.toArray(children).filter(x=>typeof x==='string').join(''));
 return <Text {...rest} style={[{fontFamily:weight==='display'&&!georgian?'Display':weight!=='regular'?'BodyBold':'Body',fontSize:16,color:C.ink},style]}>{children}</Text>;
}
export function CTA({title,onPress,disabled=false,light=false}:{title:string;onPress:()=>void;disabled?:boolean;light?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.cta,light&&{backgroundColor:C.yellow},(disabled||pressed)&&{opacity:.6}]}><T weight="bold" style={{color:light?C.ink:C.white,fontSize:18,flex:1}}>{title}</T><Icon name="arrow" color={light?C.ink:C.white}/></Pressable>;
}
export function Chip({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[s.chip,selected&&{backgroundColor:'#EEE6F7',borderColor:'#8F76B0'}]}><T weight={selected?'bold':'regular'} style={{fontSize:15}}>{selected?'✓ ':''}{label}</T></Pressable>}
export function FieldLabel({children}:{children:React.ReactNode}){return <T weight="bold" style={{marginBottom:12,fontSize:18}}>{children}</T>}
export function DateField({value,onChange,ka,label,birthDate=false,minDate,maxDate}:{value:string;onChange:(v:string)=>void;ka:boolean;label:string;birthDate?:boolean;minDate?:string;maxDate?:string}){
 const [open,setOpen]=useState(false);
 const [month,setMonth]=useState(()=>new Date());
 const [picker,setPicker]=useState<'days'|'months'|'years'>('days');
 const close=()=>setOpen(false);
 const year=month.getFullYear(), index=month.getMonth();
 const upper=maxDate||dateKey();
 const offset=(new Date(year,index,1).getDay()+6)%7;
 const count=new Date(year,index+1,0).getDate();
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>{
    setMonth(value?new Date(value+'T12:00:00'):birthDate?new Date(new Date().getFullYear()-25,0,1):new Date());
    setPicker('days');
    setOpen(true);
  }} style={[s.input,s.row]}>
    <T style={{flex:1}}>{value||(ka?'აირჩიე თარიღი':'Choose a date')}</T>
    <Icon name="calendar"/>
  </Pressable>
  <Modal visible={open} animationType="slide" onRequestClose={close}>
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView key={picker} contentContainerStyle={[s.content,{width:'100%',maxWidth:450,alignSelf:'center'}]} keyboardShouldPersistTaps="handled">
        <FieldLabel>{label}</FieldLabel>
        <View style={s.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={ka?'წინა თვე':'Previous month'} style={s.round} onPress={()=>{setMonth(new Date(year,index-1,1));setPicker('days')}}>
            <Icon name="back"/>
          </Pressable>
          <T weight="bold" style={{flex:1,textAlign:'center'}}>{monthLabel(month,ka)} {year}</T>
          <Pressable accessibilityRole="button" accessibilityLabel={ka?'შემდეგი თვე':'Next month'} style={s.round} onPress={()=>{setMonth(new Date(year,index+1,1));setPicker('days')}}>
            <Icon name="arrow"/>
          </Pressable>
        </View>
        {birthDate && <View style={[s.wrap,{marginBottom:12}]}>
          <Chip label={ka?'წლის არჩევა':'Choose year'} selected={picker==='years'} onPress={()=>setPicker('years')}/>
          <Chip label={ka?'თვის არჩევა':'Choose month'} selected={picker==='months'} onPress={()=>setPicker('months')}/>
        </View>}
        {picker==='years' ? <View style={s.wrap}>
          {Array.from({length:121},(_,i)=>new Date().getFullYear()-i).map(y=><Chip key={y} label={String(y)} selected={y===year} onPress={()=>{setMonth(new Date(y,index,1));setPicker('months')}}/>)}
        </View> : picker==='months' ? <View style={s.wrap}>
          {Array.from({length:12},(_,i)=>i).map(i=><Chip key={i} label={monthLabel(new Date(year,i,1),ka)} selected={i===index} onPress={()=>{setMonth(new Date(year,i,1));setPicker('days')}}/>)}
        </View> : <>
          <View style={{flexDirection:'row'}}>
            {(ka?['ორ','სა','ოთ','ხუ','პა','შა','კვ']:['M','T','W','T','F','S','S']).map((d,i)=><View key={i} style={[s.cell,{alignItems:'center'}]}><T style={{fontSize:12}}>{d}</T></View>)}
          </View>
          <View style={{flexDirection:'row',flexWrap:'wrap'}}>
            {Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
              const n=i-offset+1;
              if(n<1||n>count) return <View key={i} style={s.cell}/>;
              const key=dateKey(new Date(year,index,n));
              const disabled=key>upper||Boolean(minDate&&key<minDate);
              return <View key={key} style={s.cell}>
                <Pressable accessibilityRole="button" accessibilityLabel={key} accessibilityState={{selected:key===value,disabled}} disabled={disabled} onPress={()=>{onChange(key);close()}} style={[s.day,{backgroundColor:key===value?C.lav:'#F0EDF5',opacity:disabled?.3:1}]}>
                  <T>{n}</T>
                </Pressable>
              </View>;
            })}
          </View>
        </>}
      </ScrollView>
      <View style={{width:'100%',maxWidth:450,alignSelf:'center',padding:14}}>
        <CTA title={ka?'დახურვა':'Close'} light onPress={close}/>
      </View>
    </SafeAreaView>
  </Modal>
 </>;
}
export function Scale({label,value,onChange}:{label:string;value:number;onChange:(n:number)=>void}){return <View style={s.section}><FieldLabel>{label}</FieldLabel><View style={s.row}>{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityLabel={`${label}: ${n}`} accessibilityRole="button" accessibilityState={{selected:n===value}} onPress={()=>onChange(n)} style={[s.score,n===value&&{backgroundColor:C.lav,borderColor:'#8F76B0',borderWidth:1}]}><T weight="display" style={{fontSize:26}}>{n}</T></Pressable>)}</View></View>}
export const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#EAE6EF'},frame:{flex:1,width:'100%',maxWidth:520,alignSelf:'center',backgroundColor:C.bg},
 header:{paddingHorizontal:14,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,backgroundColor:C.bg},
 logo:{fontSize:30,letterSpacing:-1.1},round:{width:46,height:46,flexShrink:0,borderRadius:23,backgroundColor:C.white,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
 content:{padding:14,paddingBottom:24},title:{fontSize:31,marginBottom:20},
 section:{marginBottom:14,padding:18,borderRadius:22,backgroundColor:C.white,borderWidth:1,borderColor:'#ECE9F0'},row:{flexDirection:'row',gap:8,alignItems:'center'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
 input:{minHeight:54,borderWidth:1,borderColor:'#DDD8E5',borderRadius:14,padding:14,fontSize:16,fontFamily:'Body',color:C.ink,backgroundColor:C.white},
 cta:{minHeight:58,borderRadius:18,backgroundColor:C.ink,paddingHorizontal:20,paddingVertical:15,flexDirection:'row',alignItems:'center',gap:12},
 chip:{minHeight:46,maxWidth:'100%',borderRadius:14,borderWidth:1,borderColor:C.line,paddingHorizontal:12,paddingVertical:10,justifyContent:'center',backgroundColor:C.white},
 score:{flex:1,minHeight:58,borderRadius:15,backgroundColor:'#F2F0F6',alignItems:'center',justifyContent:'center'},
 card:{backgroundColor:C.white,borderRadius:22,padding:18,marginBottom:14,borderWidth:1,borderColor:'#ECE9F0'},muted:{color:C.muted,fontSize:14,lineHeight:22},
 nav:{flexDirection:'row',backgroundColor:C.white,borderTopWidth:1,borderColor:C.line,paddingTop:9,paddingHorizontal:6},
 navItem:{flex:1,minWidth:0,paddingHorizontal:2,paddingBottom:4,alignItems:'center',minHeight:56,gap:4},navIcon:{width:42,maxWidth:'100%',height:34,borderRadius:18,alignItems:'center',justifyContent:'center'},
 banner:{backgroundColor:C.yellow,padding:16,borderRadius:18,marginBottom:18},
 topBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:16},
 cell:{width:'14.2857%',paddingHorizontal:1,paddingVertical:2},day:{minHeight:46,borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'transparent'},
 error:{color:'#92384B',lineHeight:22,marginBottom:16},
});
