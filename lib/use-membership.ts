"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "./supabase-browser";

type RenewalState = "active" | "disabled" | "starting" | "stopping" | null;
type MembershipState = {
  status: "loading" | "active" | "locked" | "error";
  expiresAt: string | null;
  paidUntil: string | null;
  purchaseBlocked: boolean;
  renewalState: RenewalState;
  canResume: boolean;
};
const empty = { expiresAt:null, paidUntil:null, purchaseBlocked:false, renewalState:null, canResume:false } as const;

export function useMembership(){
  const [state,setState]=useState<MembershipState>({status:"loading",...empty});
  const sequence=useRef(0);
  const refresh=useCallback(async()=>{
    const current=++sequence.current;
    try{
      const {data:{session}}=await getSupabaseBrowserClient().auth.getSession();
      if(current!==sequence.current)return;
      if(!session||session.user.is_anonymous){setState({status:"locked",...empty});return}
      const response=await fetch("/api/payments/flitt/status",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
      const body=await response.json();
      if(!response.ok)throw Error();
      if(current===sequence.current)setState({status:body.active?"active":"locked",expiresAt:body.expiresAt||null,
        paidUntil:body.paidUntil||null,purchaseBlocked:body.purchaseBlocked===true,renewalState:body.renewalState||null,canResume:body.canResume===true});
    }catch{if(current===sequence.current)setState({status:"error",...empty})}
  },[]);
  useEffect(()=>{
    let timer=window.setTimeout(()=>void refresh(),0);
    const onFocus=()=>void refresh();
    const interval=window.setInterval(onFocus,60000);
    window.addEventListener("focus",onFocus);
    let unsubscribe=()=>{};
    try{const {data:{subscription}}=getSupabaseBrowserClient().auth.onAuthStateChange((event)=>{if(event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED")return;sequence.current++;setState({status:"loading",...empty});clearTimeout(timer);timer=window.setTimeout(()=>void refresh(),0)});unsubscribe=()=>subscription.unsubscribe()}catch{/* Refresh reports configuration errors. */}
    return()=>{sequence.current++;clearTimeout(timer);clearInterval(interval);window.removeEventListener("focus",onFocus);unsubscribe()};
  },[refresh]);
  return {...state,active:state.status==="active",refresh};
}
