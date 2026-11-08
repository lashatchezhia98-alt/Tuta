import {useEffect,useState} from 'react';

export function useMembership(token:string|undefined,root='') {
  const [state,setState]=useState<{token:string;active:boolean|null;error:boolean}>({token:'',active:null,error:false});
  useEffect(()=>{
    if(!token)return;
    const controller=new AbortController();
    void fetch(`${root}/api/payments/flitt/status`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok)throw Error();const body=await response.json();
      if(!controller.signal.aborted)setState({token,active:body.active===true,error:false});
    }).catch(()=>{if(!controller.signal.aborted)setState({token,active:null,error:true})});
    return()=>controller.abort();
  },[token,root]);
  return state.token===token?state:{active:null,error:false};
}
