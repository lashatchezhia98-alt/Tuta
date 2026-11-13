"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUserRound,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSiteFeatures } from "@/lib/site-features";
import BrandMark from '@/components/brand-mark';
import HeaderActions from '@/components/header-actions';
import SiteSocialLinks from "@/components/site-social-links";
import InnerPage from "@/app/inner-page";

import { SiteCopyText } from "@/components/site-copy-provider";

type Lang = "ka" | "en";

import { homeCopy as content } from "@/lib/site-copy-defaults";

function Brand({lang,inverse=false}:{lang:Lang,inverse?:boolean}) {
  return <Link href="/" className={`flex items-center gap-2.5 ${inverse?"text-white":"text-[#1E1B2E]"}`} aria-label={lang === 'ka' ? 'თუთა მთავარი' : 'TUTA home'}><BrandMark/><strong className="text-[22px] font-black tracking-[-1px]"><SiteCopyText id="nav.brand" lang={lang}/></strong></Link>
}

function NavLinks({lang}:{lang:Lang}) {const features=useSiteFeatures();return features.market?<a href="/market"><SiteCopyText id="nav.marketShort" lang={lang}/></a>:null}

export default function Home(){
  const [lang,setLang]=useState<Lang>("ka");
  const features=useSiteFeatures();
  const consult=features.doctorConsultation;
  useEffect(()=>{if(localStorage.getItem("tuta-language")==="en")queueMicrotask(()=>setLang("en"))},[]);
  useEffect(()=>{localStorage.setItem("tuta-language",lang);document.documentElement.lang=lang},[lang]);
  const t=content[lang];
  const icons=[CalendarDays,HeartPulse,BarChart3];
  return <>
    <div className="landing-desktop">
    <main className="min-h-screen bg-[#F9F8FC] text-[#1E1B2E]">
    <header className="sticky top-0 z-50 border-b border-[#1E1B2E]/10 bg-[#F9F8FC]/95 backdrop-blur-xl"><div className="landing-header-row mx-auto flex min-h-[72px] max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8"><Brand lang={lang}/><nav className="hidden items-center gap-6 text-[13px] font-medium xl:flex"><NavLinks lang={lang}/></nav><HeaderActions lang={lang} setLang={setLang}/></div></header>

    <section className="overflow-hidden border-b border-[#1E1B2E]/10 bg-[#E3D8F1]"><div className="mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-20"><div className="max-w-[600px]"><Badge variant="outline" className="mb-6 rounded-full border-[#1E1B2E]/15 bg-white/40 px-3 py-1.5 text-[11px] font-semibold"><Sparkles className="mr-1.5 size-3.5"/><SiteCopyText id="home.badge" lang={lang}/></Badge><h1 className="text-[42px] font-semibold leading-[1.08] tracking-[-2.2px] sm:text-[52px] lg:text-[56px]"><SiteCopyText id="home.title" lang={lang}/></h1><p className="mt-6 max-w-lg text-[16px] leading-7 text-[#514B5F]"><SiteCopyText id="home.subtitle" lang={lang}/></p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-full bg-[#1E1B2E] px-6 text-white hover:bg-[#302c43]"><a href="/register"><SiteCopyText id="home.start" lang={lang}/><ArrowRight className="ml-2 size-4"/></a></Button><Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-6 hover:bg-white/40"><a href="#features"><SiteCopyText id="home.anonymous" lang={lang}/><ChevronRight className="ml-1 size-4"/></a></Button></div><div className="mt-8 flex items-center gap-3 text-[12px] text-[#625B6D]"><ShieldCheck className="size-4"/><span><strong className="font-semibold text-[#1E1B2E]"><SiteCopyText id="home.private" lang={lang}/></strong> · <SiteCopyText id="home.privateText" lang={lang}/></span></div></div>
      <div className="relative mx-auto w-full max-w-[590px]"><div className="absolute -inset-16 rounded-full bg-[#FDF0CC]/80 blur-2xl"/><Card className="relative overflow-hidden rounded-[28px] border-white/70 bg-white/90 p-0 shadow-[0_28px_80px_rgba(30,27,46,.16)]"><CardHeader className="flex-row items-center justify-between border-b border-[#1E1B2E]/8 px-6 py-5"><div><p className="text-xs text-[#6B6573]"><SiteCopyText id="home.greeting" lang={lang}/></p><CardTitle className="mt-1 text-xl font-semibold"><SiteCopyText id="home.day" lang={lang}/></CardTitle></div><Avatar><AvatarFallback className="bg-[#D8E0ED] text-xs font-semibold">NN</AvatarFallback></Avatar></CardHeader><CardContent className="grid gap-5 p-5 sm:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl bg-[#F9F8FC] p-5"><div className="relative mx-auto grid size-48 place-items-center rounded-full" style={{background:"conic-gradient(#1E1B2E 0 50%,#E3D8F1 50% 100%)"}}><div className="grid size-40 place-items-center rounded-full bg-white text-center"><div><Badge className="rounded-full bg-[#FDF0CC] text-[#1E1B2E] hover:bg-[#FDF0CC]"><SiteCopyText id="home.phase" lang={lang}/></Badge><strong className="mt-2 block text-5xl font-semibold tracking-[-2px]">14</strong><small className="text-[#77717E]">/ 28</small></div></div></div></div><div className="grid gap-3"><div className="rounded-2xl bg-[#FDF0CC] p-4"><CalendarDays className="size-4"/><small className="mt-5 block text-[#6B6573]"><SiteCopyText id="home.next" lang={lang}/></small><strong className="mt-1 block text-sm"><SiteCopyText id="home.nextDate" lang={lang}/></strong></div><div className="rounded-2xl bg-[#D8E0ED] p-4"><Sparkles className="size-4"/><small className="mt-5 block text-[#6B6573]"><SiteCopyText id="home.fertile" lang={lang}/></small><strong className="mt-1 block text-sm"><SiteCopyText id="home.today" lang={lang}/></strong></div></div></CardContent><div className="grid grid-cols-2 gap-3 border-t border-[#1E1B2E]/8 p-5"><div className="flex items-center gap-3 rounded-xl border bg-white p-3"><HeartPulse className="size-4 text-[#6A6078]"/><div><small className="block text-[10px] text-[#77717E]"><SiteCopyText id="home.energy" lang={lang}/></small><strong className="text-xs"><SiteCopyText id="home.high" lang={lang}/></strong></div></div><div className="flex items-center gap-3 rounded-xl border bg-white p-3"><CircleUserRound className="size-4 text-[#6A6078]"/><div><small className="block text-[10px] text-[#77717E]"><SiteCopyText id="home.mood" lang={lang}/></small><strong className="text-xs"><SiteCopyText id="home.calm" lang={lang}/></strong></div></div></div></Card></div></div></section>

    <section id="features" className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
      <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-end"><h2 className="max-w-xl text-4xl font-semibold leading-tight tracking-[-1.8px] sm:text-5xl"><SiteCopyText id="home.valueTitle" lang={lang}/></h2><p className="max-w-xl text-[15px] leading-7 text-[#676273] lg:justify-self-end"><SiteCopyText id="home.valueText" lang={lang}/></p></div>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {t.featureCards.map(([title],i)=>({title,i,enabled:[features.period,features.dailyLog,features.insights][i]})).filter(item=>item.enabled).map(({title,i})=>{const Icon=icons[i];const tint=i===0?"bg-[#E3D8F1]":i===1?"bg-[#FDF0CC]":"bg-[#D8E0ED]";return <Card key={title} className="group rounded-2xl border-[#1E1B2E]/10 bg-white py-0 shadow-none transition hover:-translate-y-1 hover:shadow-xl"><CardContent className="p-7"><div className={`grid size-11 place-items-center rounded-xl ${tint}`}><Icon className="size-5"/></div><h3 className="mt-14 text-xl font-semibold tracking-[-.5px]"><SiteCopyText id={`home.featureCards.${i}.0`} lang={lang}/></h3><p className="mt-3 text-[13px] leading-6 text-[#676273]"><SiteCopyText id={`home.featureCards.${i}.1`} lang={lang}/></p><Button variant="ghost" size="icon" asChild className="mt-8 rounded-full border"><a href="/register" aria-label={title}><ArrowRight className="size-4"/></a></Button></CardContent></Card>})}
      </div>
    </section>

    {consult&&<section className="bg-white py-24 lg:py-28"><div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8"><div><Badge className="rounded-full bg-[#E3D8F1] px-3 py-1 text-[#1E1B2E] hover:bg-[#E3D8F1]"><Stethoscope className="mr-1.5 size-3.5"/><SiteCopyText id="home.doctorsBadge" lang={lang}/></Badge><h2 className="mt-6 max-w-xl text-4xl font-semibold leading-tight tracking-[-1.8px] sm:text-5xl"><SiteCopyText id="home.doctorsTitle" lang={lang}/></h2><p className="mt-5 max-w-lg text-[15px] leading-7 text-[#676273]"><SiteCopyText id="home.doctorsText" lang={lang}/></p><Button asChild size="lg" className="mt-8 rounded-full bg-[#1E1B2E] px-6"><a href="/consultation"><SiteCopyText id="home.chooseDoctor" lang={lang}/><ArrowRight className="ml-2 size-4"/></a></Button></div><Card className="rounded-3xl border-[#1E1B2E]/10 bg-[#F9F8FC] shadow-none"><CardContent className="p-8"><Stethoscope className="size-8 text-[#6F687D]"/><p className="mt-5 text-xl font-semibold"><SiteCopyText id="home.availabilityTitle" lang={lang}/></p><p className="mt-3 text-base leading-7 text-[#676273]"><SiteCopyText id="home.availabilityText" lang={lang}/></p></CardContent></Card></div></section>}

    <section className="bg-[#D8E0ED] py-24"><div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:px-8"><div><div className="grid size-12 place-items-center rounded-2xl bg-white"><LockKeyhole className="size-5"/></div><h2 className="mt-7 max-w-xl text-4xl font-semibold leading-tight tracking-[-1.8px] sm:text-5xl"><SiteCopyText id="home.privacyTitle" lang={lang}/></h2></div><div className="lg:pt-20"><p className="max-w-lg text-[15px] leading-7 text-[#56515E]"><SiteCopyText id="home.privacyText" lang={lang}/></p><div className="mt-8 space-y-3">{t.privacyItems.map((item,i)=><div className="flex items-center gap-3 text-sm font-medium" key={item}><span className="grid size-6 place-items-center rounded-full bg-white"><Check className="size-3.5"/></span><SiteCopyText id={`home.privacyItems.${i}`} lang={lang}/></div>)}</div></div></div></section>

    <section className="bg-[#E3D8F1] py-24"><div className="mx-auto max-w-3xl px-5 text-center"><h2 className="text-4xl font-semibold tracking-[-1.8px] sm:text-5xl"><SiteCopyText id="home.finalTitle" lang={lang}/></h2><p className="mx-auto mt-5 max-w-xl text-[14px] leading-6 text-[#676273]"><SiteCopyText id="home.finalText" lang={lang}/></p><Button asChild size="lg" className="mt-8 rounded-full bg-[#1E1B2E] px-7"><a href="/register"><SiteCopyText id="home.finalButton" lang={lang}/><ArrowRight className="ml-2 size-4"/></a></Button></div></section>

    <footer className="bg-[#1E1B2E] py-12 text-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 lg:flex-row lg:items-center lg:px-8"><div><Brand lang={lang} inverse/><p className="mt-4 text-xs text-white/60"><SiteCopyText id="home.footer" lang={lang}/></p></div><div className="flex flex-col gap-5 lg:items-end"><div className="flex flex-wrap gap-x-7 gap-y-3 text-xs text-white/70"><a href="/community"><SiteCopyText id="home.community" lang={lang}/></a><a href="/about"><SiteCopyText id="home.about" lang={lang}/></a><a href="/blog"><SiteCopyText id="home.library" lang={lang}/></a><a href="/premium"><SiteCopyText id="home.premiumLink" lang={lang}/></a><a href="/privacy"><SiteCopyText id="home.privacyLink" lang={lang}/></a><a href="/terms"><SiteCopyText id="home.termsLink" lang={lang}/></a></div><SiteSocialLinks lang={lang}/></div></div><Separator className="mx-auto my-8 max-w-7xl bg-white/10"/><div className="mx-auto max-w-7xl px-5 text-[10px] text-white/45 lg:px-8"><SiteCopyText id="home.rights" lang={lang}/></div></footer>
    </main>
    </div>
    <div className="landing-mobile"><InnerPage kind="dashboard" /></div>
  </>
}
