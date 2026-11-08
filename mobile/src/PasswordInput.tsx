import {useState} from 'react';
import {Pressable,StyleSheet,TextInput,View} from 'react-native';
import Svg,{Path,Circle} from 'react-native-svg';
import {C,s} from './ui';

export default function PasswordInput({label,value,onChange,ka,newPassword=true}:{
  label:string;value:string;onChange:(value:string)=>void;ka:boolean;newPassword?:boolean;
}){
  const [visible,setVisible]=useState(false);
  const action=ka?(visible?'პაროლის დამალვა':'პაროლის გამოჩენა'):(visible?'Hide password':'Show password');
  return <View style={styles.field}>
    <TextInput accessibilityLabel={label} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false} textContentType={newPassword?'newPassword':'password'} autoComplete={newPassword?'new-password':'current-password'} placeholder="••••••••" placeholderTextColor={C.muted} style={[s.input,styles.input]} value={value} onChangeText={onChange}/>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${action}`} accessibilityState={{selected:visible}} onPress={()=>setVisible(current=>!current)} style={({pressed})=>[styles.toggle,pressed&&{backgroundColor:C.lav}]}>
      <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
        <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="none" stroke={C.ink} strokeWidth={1.7}/>
        <Circle cx={12} cy={12} r={3} fill="none" stroke={C.ink} strokeWidth={1.7}/>
        {visible&&<Path d="m3 3 18 18" fill="none" stroke={C.ink} strokeWidth={1.7} strokeLinecap="round"/>}
      </Svg>
    </Pressable>
  </View>;
}
const styles=StyleSheet.create({
  field:{position:'relative',width:'100%'},
  input:{width:'100%',paddingRight:58},
  toggle:{position:'absolute',right:5,top:5,width:44,height:44,borderRadius:9,alignItems:'center',justifyContent:'center'},
});
