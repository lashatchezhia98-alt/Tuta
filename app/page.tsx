"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUserRound,
  HeartPulse,
  LockKeyhole,
  Menu,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Lang = "ka" | "en";

const content = {
  ka: {
    about:"ჩვენ შესახებ", featuresNav:"შესაძლებლობები", library:"ბიბლიოთეკა", consultation:"ექიმთან კონსულტაცია", login:"შესვლა", signup:"რეგისტრაცია",
    badge:"შექმნილია ქალებისთვის საქართველოში", title:"უკეთ გაიგე შენი სხეული და ციკლი", subtitle:"თუთა აერთიანებს ციკლის პროგნოზს, ყოველდღიურ ჩანაწერებსა და პირად ანალიტიკას ერთ მშვიდ და უსაფრთხო სივრცეში.", start:"დაიწყე უფასოდ", anonymous:"გამოიყენე ანონიმურად", private:"პირადი და დაცული", privateText:"შენი ჯანმრთელობის მონაცემები შენ გეკუთვნის.",
    greeting:"დილა მშვიდობისა, ნინო", day:"ციკლის მე-14 დღე", phase:"ოვულაცია", next:"შემდეგი პერიოდი", nextDate:"12 სექტემბერი", fertile:"ნაყოფიერი დღეები", today:"დღეს", energy:"ენერგია", high:"მაღალი", mood:"განწყობა", calm:"მშვიდი",
    valueTitle:"ჯანმრთელობის უკეთ გასაგებად შექმნილი ინსტრუმენტები", valueText:"არა უბრალოდ კალენდარი. თუთა გეხმარება შეამჩნიო ცვლილებები და მიიღო შენს რეალურ მონაცემებზე დაფუძნებული ხედვა.",
    featureCards:[
      ["ციკლის პროგნოზი","პერიოდის, ოვულაციისა და ნაყოფიერი ფანჯრის გამოთვლა შენს მოწყობილობაზე."],
      ["დღიური ჩანაწერები","განწყობის, ენერგიის, ტკივილის, ნაკადისა და 80-ზე მეტი სიმპტომის მონიშვნა."],
      ["პირადი პატერნები","შენი ციკლების მიხედვით განმეორებადი სიმპტომებისა და ფაზების აღმოჩენა."],
    ],
    doctorsBadge:"TUTA Care", doctorsTitle:"ექიმთან საუბარი როცა შენ გჭირდება", doctorsText:"აირჩიე სპეციალისტი პროფილისა და გამოცდილების მიხედვით. დაიწყე პირადი კონსულტაცია პირდაპირ თუთადან.", chooseDoctor:"ექიმის არჩევა", available:"ხელმისაწვდომია", gynecologist:"გინეკოლოგი", endocrinologist:"ენდოკრინოლოგი", years:"წლიანი გამოცდილება",
    privacyTitle:"კონფიდენციალურობა დამატებითი ფუნქცია არ არის", privacyText:"ჩვენ არ ვყიდით ჯანმრთელობის მონაცემებს და არ ვაჩვენებთ რეკლამას. ანონიმური რეჟიმი გაძლევს საშუალებას გამოიყენო ძირითადი ფუნქციები ანგარიშის გარეშე.", privacyItems:["ანონიმური რეჟიმი","რეკლამის გარეშე","გამოთვლები მოწყობილობაზე"],
    finalTitle:"დაიწყე საკუთარი რიტმის გაცნობიერება", finalText:"პერიოდისა და ოვულაციის პროგნოზი უფასოა. ბარათის დამატება არ არის საჭირო.", finalButton:"შექმენი უფასო ანგარიში", footer:"შენი ჯანმრთელობის ცნობიერება იწყება აქ.", rights:"© 2026 თუთა. ყველა უფლება დაცულია.",
  },
  en: {
    about:"About", featuresNav:"Features", library:"Library", consultation:"Consult a doctor", login:"Sign in", signup:"Sign up",
    badge:"Made for women in Georgia", title:"Understand your body and cycle with confidence", subtitle:"TUTA brings cycle predictions, daily tracking and personal insights into one calm and secure space.", start:"Start for free", anonymous:"Use anonymously", private:"Private and secure", privateText:"Your health data belongs to you.",
    greeting:"Good morning, Nino", day:"Cycle day 14", phase:"Ovulation", next:"Next period", nextDate:"September 12", fertile:"Fertile days", today:"Today", energy:"Energy", high:"High", mood:"Mood", calm:"Calm",
    valueTitle:"Tools designed to help you understand your health", valueText:"More than a calendar. TUTA helps you notice changes and see insights based on your real data.",
    featureCards:[["Cycle predictions","Period, ovulation and fertile-window calculations happen on your device."],["Daily tracking","Log mood, energy, pain, flow and more than 80 symptoms."],["Personal patterns","Discover recurring symptoms and phases across your own cycles."]],
    doctorsBadge:"TUTA Care", doctorsTitle:"Talk to a doctor when you need one", doctorsText:"Choose a specialist by profile and experience. Start a private consultation directly from TUTA.", chooseDoctor:"Choose a doctor", available:"Available", gynecologist:"Gynecologist", endocrinologist:"Endocrinologist", years:"years of experience",
    privacyTitle:"Privacy is not an optional feature", privacyText:"We never sell health data and never show ads. Anonymous mode lets you use core features without creating an account.", privacyItems:["Anonymous mode","Always ad-free","On-device calculations"],
    finalTitle:"Start understanding your rhythm", finalText:"Period and ovulation predictions are free. No payment card required.", finalButton:"Create a free account", footer:"Your health awareness starts here.", rights:"© 2026 TUTA. All rights reserved.",
  },
};

function Brand({lang,inverse=false}:{lang:Lang,inverse?:boolean}) {
  return <a href="/" className={`flex items-center gap-2.5 ${inverse?"text-white":"text-[#1E1B2E]"}`} aria-label="TUTA home"><span className={`relative grid size-8 place-items-center overflow-hidden rounded-full ${inverse?"bg-[#FDF0CC] text-[#1E1B2E]":"bg-[#1E1B2E] text-white"}`}><Moon className="size-[18px] fill-current" /></span><strong className="text-[22px] font-black tracking-[-1px]">{lang==="ka"?"თუთა":"TUTA"}</strong></a>
}

function NavLinks({lang,consult}:{lang:Lang,consult:boolean}) {const t=content[lang];return <><a href="/about">{t.about}</a><a href="#features">{t.featuresNav}</a><a href="/blog">{t.library}</a>{consult&&<a href="/consultation">{t.consultation}</a>}</>}

export default function Home(){
  const [lang,setLang]=useState<Lang>("ka");
  const [consult,setConsult]=useState(true);
  useEffect(()=>{if(localStorage.getItem("tuta-language")==="en")setLang("en");setConsult(localStorage.getItem("tuta-doctor-consultation")!=="false")},[]);
  useEffect(()=>{localStorage.setItem("tuta-language",lang);document.documentElement.lang=lang},[lang]);
  const t=content[lang];
  const icons=[CalendarDays,HeartPulse,BarChart3];
  return <main className="min-h-screen bg-[#F9F8FC] text-[#1E1B2E]">
    <header className="sticky top-0 z-50 border-b border-[#1E1B2E]/10 bg-[#F9F8FC]/95 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8"><Brand lang={lang}/><nav className="hidden items-center gap-7 text-[13px] font-medium lg:flex"><NavLinks lang={lang} consult={consult}/><button onClick={()=>setLang(lang==="ka"?"en":"ka")} className="grid size-10 place-items-center rounded-full border border-[#1E1B2E]/15 text-[11px] font-bold">{lang==="ka"?"EN":"KA"}</button><a href="/login">{t.login}</a><Button asChild className="rounded-full bg-[#1E1B2E] px-5 text-white hover:bg-[#302c43]"><a href="/register">{t.signup}</a></Button></nav><div className="flex items-center gap-2 lg:hidden"><button onClick={()=>setLang(lang==="ka"?"en":"ka")} className="grid size-10 place-items-center rounded-full border text-[11px] font-bold">{lang==="ka"?"EN":"KA"}</button><Sheet><SheetTrigger asChild><Button variant="outline" size="icon" className="rounded-full"><Menu className="size-4"/></Button></SheetTrigger><SheetContent className="bg-[#F9F8FC] p-6"><SheetHeader><SheetTitle><Brand lang={lang}/></SheetTitle></SheetHeader><nav className="mt-10 flex flex-col gap-5 text-base"><NavLinks lang={lang} consult={consult}/><Separator/><a href="/login">{t.login}</a><Button asChild className="rounded-full bg-[#1E1B2E]"><a href="/register">{t.signup}</a></Button></nav></SheetContent></Sheet></div></div></header>

    <section className="overflow-hidden border-b border-[#1E1B2E]/10 bg-[#E3D8F1]"><div className="mx-auto grid min-h-[680px] max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-20"><div className="max-w-[600px]"><Badge variant="outline" className="mb-6 rounded-full border-[#1E1B2E]/15 bg-white/40 px-3 py-1.5 text-[11px] font-semibold"><Sparkles className="mr-1.5 size-3.5"/>{t.badge}</Badge><h1 className="text-[42px] font-semibold leading-[1.08] tracking-[-2.2px] sm:text-[52px] lg:text-[56px]">{t.title}</h1><p className="mt-6 max-w-lg text-[16px] leading-7 text-[#514B5F]">{t.subtitle}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="h-12 rounded-full bg-[#1E1B2E] px-6 text-white hover:bg-[#302c43]"><a href="/register">{t.start}<ArrowRight className="ml-2 size-4"/></a></Button><Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-6 hover:bg-white/40"><a href="/app/dashboard">{t.anonymous}<ChevronRight className="ml-1 size-4"/></a></Button></div><div className="mt-8 flex items-center gap-3 text-[12px] text-[#625B6D]"><ShieldCheck className="size-4"/><span><strong className="font-semibold text-[#1E1B2E]">{t.private}</strong> · {t.privateText}</span></div></div>
      <div className="relative mx-auto w-full max-w-[590px]"><div className="absolute -inset-16 rounded-full bg-[#FDF0CC]/80 blur-2xl"/><Card className="relative overflow-hidden rounded-[28px] border-white/70 bg-white/90 p-0 shadow-[0_28px_80px_rgba(30,27,46,.16)]"><CardHeader className="flex-row items-center justify-between border-b border-[#1E1B2E]/8 px-6 py-5"><div><p className="text-xs text-[#6B6573]">{t.greeting}</p><CardTitle className="mt-1 text-xl font-semibold">{t.day}</CardTitle></div><Avatar><AvatarFallback className="bg-[#D8E0ED] text-xs font-semibold">NN</AvatarFallback></Avatar></CardHeader><CardContent className="grid gap-5 p-5 sm:grid-cols-[1.1fr_.9fr]"><div className="rounded-2xl bg-[#F9F8FC] p-5"><div className="relative mx-auto grid size-48 place-items-center rounded-full" style={{background:"conic-gradient(#1E1B2E 0 50%,#E3D8F1 50% 100%)"}}><div className="grid size-40 place-items-center rounded-full bg-white text-center"><div><Badge className="rounded-full bg-[#FDF0CC] text-[#1E1B2E] hover:bg-[#FDF0CC]">{t.phase}</Badge><strong className="mt-2 block text-5xl font-semibold tracking-[-2px]">14</strong><small className="text-[#77717E]">/ 28</small></div></div></div></div><div className="grid gap-3"><div className="rounded-2xl bg-[#FDF0CC] p-4"><CalendarDays className="size-4"/><small className="mt-5 block text-[#6B6573]">{t.next}</small><strong className="mt-1 block text-sm">{t.nextDate}</strong></div><div className="rounded-2xl bg-[#D8E0ED] p-4"><Sparkles className="size-4"/><small className="mt-5 block text-[#6B6573]">{t.fertile}</small><strong className="mt-1 block text-sm">{t.today}</strong></div></div></CardContent><div className="grid grid-cols-2 gap-3 border-t border-[#1E1B2E]/8 p-5"><div className="flex items-center gap-3 rounded-xl border bg-white p-3"><HeartPulse className="size-4 text-[#6A6078]"/><div><small className="block text-[10px] text-[#77717E]">{t.energy}</small><strong className="text-xs">{t.high}</strong></div></div><div className="flex items-center gap-3 rounded-xl border bg-white p-3"><CircleUserRound className="size-4 text-[#6A6078]"/><div><small className="block text-[10px] text-[#77717E]">{t.mood}</small><strong className="text-xs">{t.calm}</strong></div></div></div></Card></div></div></section>

    <section id="features" className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32"><div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-end"><h2 className="max-w-xl text-4xl font-semibold leading-tight tracking-[-1.8px] sm:text-5xl">{t.valueTitle}</h2><p className="max-w-xl text-[15px] leading-7 text-[#676273] lg:justify-self-end">{t.valueText}</p></div><div className="mt-14 grid gap-4 md:grid-cols-3">{t.featureCards.map(([title,text],i)=>{const Icon=icons[i];return <Card key={title} className="group rounded-2xl border-[#1E1B2E]/10 bg-white py-0 shadow-none transition hover:-translate-y-1 hover:shadow-xl"><CardContent className="p-7"><div className={`grid size-11 place-items-center rounded-xl ${i===0?"bg-[#E3D8F1]":i===1?"bg-[#FDF0CC]":"bg-[#D8E0ED]"}`}><Icon className="size-5"/></div><h3 className="mt-14 text-xl font-semibold tracking-[-.5px]">{title}</h3><p className="mt-3 text-[13px] leading-6 text-[#676273]">{text}</p><Button variant="ghost" size="icon" asChild className="mt-8 rounded-full border"><a href="/register" aria-label={title}><ArrowRight className="size-4"/></a></Button></CardContent></Card>})}</div></section>

    {consult&&<section className="bg-white py-24 lg:py-28"><div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8"><div><Badge className="rounded-full bg-[#E3D8F1] px-3 py-1 text-[#1E1B2E] hover:bg-[#E3D8F1]"><Stethoscope className="mr-1.5 size-3.5"/>{t.doctorsBadge}</Badge><h2 className="mt-6 max-w-xl text-4xl font-semibold leading-tight tracking-[-1.8px] sm:text-5xl">{t.doctorsTitle}</h2><p className="mt-5 max-w-lg text-[15px] leading-7 text-[#676273]">{t.doctorsText}</p><Button asChild size="lg" className="mt-8 rounded-full bg-[#1E1B2E] px-6"><a href="/consultation">{t.chooseDoctor}<ArrowRight className="ml-2 size-4"/></a></Button></div><Card className="rounded-3xl border-[#1E1B2E]/10 bg-[#F9F8FC] p-2 shadow-none"><CardContent className="space-y-2 p-2">{[["ამ","დოქტ. ანა მაისურაძე","Dr. Ana Maisuradze",t.gynecologist,"12"],["მკ","დოქტ. მარიამ კახიძე","Dr. Mariam Kakhidze",t.endocrinologist,"9"]].map((d,i)=><div key={d[0]} className="flex items-center gap-4 rounded-2xl border border-[#1E1B2E]/8 bg-white p-4"><Avatar className="size-12"><AvatarFallback className={i?"bg-[#FDF0CC]":"bg-[#D8E0ED]"}>{d[0]}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-sm">{lang==="ka"?d[1]:d[2]}</strong><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700">{t.available}</Badge></div><p className="mt-1 text-[11px] text-[#77717E]">{d[3]} · {d[4]} {t.years}</p></div><Button variant="ghost" size="icon" asChild className="rounded-full"><a href="/consultation"><MessageCircle className="size-4"/></a></Button></div>)}</CardContent></Card></div></section>}

    <section className="bg-[#D8E0ED] py-24"><div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:px-8"><div><div className="grid size-12 place-items-center rounded-2xl bg-white"><LockKeyhole className="size-5"/></div><h2 className="mt-7 max-w-xl text-4xl font-semibold leading-tight tracking-[-1.8px] sm:text-5xl">{t.privacyTitle}</h2></div><div className="lg:pt-20"><p className="max-w-lg text-[15px] leading-7 text-[#56515E]">{t.privacyText}</p><div className="mt-8 space-y-3">{t.privacyItems.map(item=><div className="flex items-center gap-3 text-sm font-medium" key={item}><span className="grid size-6 place-items-center rounded-full bg-white"><Check className="size-3.5"/></span>{item}</div>)}</div></div></div></section>

    <section className="bg-[#E3D8F1] py-24"><div className="mx-auto max-w-3xl px-5 text-center"><h2 className="text-4xl font-semibold tracking-[-1.8px] sm:text-5xl">{t.finalTitle}</h2><p className="mx-auto mt-5 max-w-xl text-[14px] leading-6 text-[#676273]">{t.finalText}</p><Button asChild size="lg" className="mt-8 rounded-full bg-[#1E1B2E] px-7"><a href="/register">{t.finalButton}<ArrowRight className="ml-2 size-4"/></a></Button></div></section>

    <footer className="bg-[#1E1B2E] py-12 text-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 lg:flex-row lg:items-center lg:px-8"><div><Brand lang={lang} inverse/><p className="mt-4 text-xs text-white/60">{t.footer}</p></div><div className="flex flex-wrap gap-x-7 gap-y-3 text-xs text-white/70"><a href="/about">{t.about}</a><a href="/blog">{t.library}</a><a href="/premium">Premium</a><a href="/admin">Admin</a></div></div><Separator className="mx-auto my-8 max-w-7xl bg-white/10"/><div className="mx-auto max-w-7xl px-5 text-[10px] text-white/45 lg:px-8">{t.rights}</div></footer>
  </main>
}
