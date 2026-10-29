"use client";

import {useEffect,useState} from "react";
import Link from "next/link";

type Lang="ka"|"en";
type Kind="privacy"|"terms";

const copy={
 privacy:{
  ka:{title:"კონფიდენციალურობა",intro:"შენი პირადი ინფორმაცია დაცულია. აქ მოკლედ აღწერილია, როგორ მუშაობს თუთას ამჟამინდელი ვერსია.",sections:[
   ["ანგარიში და ჯანმრთელობის მონაცემები","ანგარიშის, პერიოდისა და დღიურის მონაცემები დაცულ ბაზაში ინახება. წვდომა შეზღუდულია შენი ანგარიშით. ჩანაწერები აპსა და ვებსაიტს შორის სინქრონდება და საზოგადოების პოსტებში ავტომატურად არ ჩანს."],
   ["რას ხედავენ სხვები","მთავარ გვერდზე პოსტებსა და კომენტარებს მხოლოდ შესული მომხმარებლები ხედავენ. ანონიმური პოსტის ავტორის სახელი სხვებს არ ეჩვენებათ. თუ ფოტოს დაამატებ, ის Cloudinary-ზე აიტვირთება. გამოაქვეყნე მხოლოდ ის, რისი გაზიარებაც გსურს."],
   ["შენი კონტროლი","საკუთარი პოსტის შეცვლა ან წაშლა შეგიძლია. მობილურ აპში შესაძლებელია ჯანმრთელობის ჩანაწერების ექსპორტი ან წაშლა. ძველი ჩანაწერები მოწყობილობიდან მხოლოდ ანგარიშში წარმატებით გადატანის შემდეგ წაიშლება."],
  ]},
  en:{title:"Privacy",intro:"Your personal information is protected. This page explains how the current version of Tuta works.",sections:[
   ["Account and health data","Your account, period and journal data are stored in a protected database. Access is restricted to your account. Entries sync between the app and website and do not appear automatically in community posts."],
   ["What others can see","Only signed-in members can see posts and comments on Home. Anonymous posts do not show the author’s name to others. If you add a photo, it is uploaded to Cloudinary. Share only what you want others to see."],
   ["Your control","You can edit or delete your own post. The mobile app lets you export or delete your health entries. Older device records are removed only after a successful account import."],
  ]},
 },
 terms:{
  ka:{title:"წესები და პირობები",intro:"ეს წესები აღწერს თუთას ამჟამად ხელმისაწვდომ ფუნქციებს.",sections:[
   ["რას აკეთებს თუთა","თუთა გაძლევს პერიოდის სავარაუდო პროგნოზს, კალენდარს, დღიურს და მომხმარებელთა მთავარ გვერდს. პროგნოზი შეფასებაა და არა დიაგნოზი ან კონტრაცეფციის მეთოდი."],
   ["საზოგადოების წესები","პოსტი მაქსიმუმ 200 სიტყვას და ერთ ფოტოს შეიძლება შეიცავდეს. არ გამოაქვეყნო სხვისი პირადი მონაცემები, შეურაცხმყოფელი ტექსტი ან სპამი. შეგიძლია შეცვალო ან წაშალო საკუთარი პოსტი და დაარეპორტო დარღვევა."],
   ["ანგარიში და ფასიანი სერვისები","პოსტების სანახავად და პირადი ჩანაწერების სინქრონიზაციისთვის ანგარიში საჭიროა. ექიმთან ჩატი, ვიზიტის დაჯავშნა და გამოწერა ჯერ არ მუშაობს; ამ ვერსიაში მათ საფასურს არ ჩამოგაჭრით."],
  ]},
  en:{title:"Terms of use",intro:"These terms describe the features currently available in Tuta.",sections:[
   ["What Tuta does","Tuta offers estimated period predictions, a calendar, a journal and a member Home feed. Predictions are estimates, not a diagnosis or a method of contraception."],
   ["Community rules","A post may contain up to 200 words and one photo. Do not post another person’s private information, abuse or spam. You can edit or delete your own post and report violations."],
   ["Account and paid services","An account is required to view posts and sync personal entries. Doctor chat, appointment booking and subscriptions are not active yet; you will not be charged for them in this version."],
  ]},
 },
} as const;

export function PolicyPage({kind}:{kind:Kind}){
 const [lang,setLang]=useState<Lang>("ka");
 useEffect(()=>{if(localStorage.getItem("tuta-language")==="en")queueMicrotask(()=>setLang("en"))},[]);
 const change=()=>{const next=lang==="ka"?"en":"ka";setLang(next);localStorage.setItem("tuta-language",next);document.documentElement.lang=next};
 const text=copy[kind][lang];
 return <main className="min-h-screen bg-[#F9F8FC] px-5 py-6 text-[#1E1B2E] sm:px-8 sm:py-10"><div className="mx-auto max-w-3xl"><header className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="text-2xl font-black">{lang==="ka"?"თუთა":"TUTA"}</Link><div className="flex items-center gap-4"><Link href={kind==="privacy"?"/terms":"/privacy"} className="text-sm underline underline-offset-4">{kind==="privacy"?(lang==="ka"?"წესები და პირობები":"Terms of use"):(lang==="ka"?"კონფიდენციალურობა":"Privacy")}</Link><button type="button" onClick={change} className="min-h-11 min-w-11 rounded-full border border-[#1E1B2E]/20 text-sm font-semibold" aria-label={lang==="ka"?"Change language to English":"შეცვალე ენა ქართულზე"}>{lang==="ka"?"EN":"KA"}</button></div></header><div className="mt-12 rounded-[30px] bg-[#E3D8F1] p-7 sm:mt-16 sm:p-10"><p className="text-xs font-semibold tracking-[.18em]">TUTA</p><h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">{text.title}</h1><p className="mt-5 max-w-xl text-base leading-7">{text.intro}</p></div><div className="mt-6 grid gap-4">{text.sections.map(([heading,body])=><section key={heading} className="rounded-3xl border border-[#1E1B2E]/10 bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold leading-snug">{heading}</h2><p className="mt-3 text-base leading-7 text-[#514B5F]">{body}</p></section>)}</div></div></main>;
}
