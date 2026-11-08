"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "./supabase-browser";

export function useMembership(){
  const [state,setState]=useState<{status:"loading"|"active"|"locked"|"error";expiresAt:string|null}>({status:"loading",expiresAt:null});
  const sequence=useRef(0);
  const refresh=useCallback(async()=>{
    const current=++sequence.current;
    try{
      const {data:{session}}=await getSupabaseBrowserClient().auth.getSession();
      if(current!==sequence.current)return;
      if(!session||session.user.is_anonymous){setState({status:"locked",expiresAt:null});return}
      const response=await fetch("/api/payments/flitt/status",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw Error();
      if(current===sequence.current)setState({status:body.active?"active":"locked",expiresAt:body.expiresAt||null});
    }catch{if(current===sequence.current)setState({status:"error",expiresAt:null})}
  },[]);
  useEffect(()=>{
    let timer=window.setTimeout(()=>void refresh(),0);
    const onFocus=()=>void refresh();
    const interval=window.setInterval(onFocus,60000);
    window.addEventListener("focus",onFocus);
    let unsubscribe=()=>{};
    try{const {data:{subscription}}=getSupabaseBrowserClient().auth.onAuthStateChange((event)=>{if(event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED")return;sequence.current++;setState({status:"loading",expiresAt:null});clearTimeout(timer);timer=window.setTimeout(()=>void refresh(),0)});unsubscribe=()=>subscription.unsubscribe()}catch{/* Refresh reports configuration errors. */}
    return()=>{sequence.current++;clearTimeout(timer);clearInterval(interval);window.removeEventListener("focus",onFocus);unsubscribe()};
  },[refresh]);
  return {...state,active:state.status==="active",refresh};
}
