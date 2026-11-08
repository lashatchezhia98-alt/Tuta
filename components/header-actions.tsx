"use client";
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSiteFeatures } from '@/lib/site-features';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function HeaderActions({lang,setLang}:{lang:'ka'|'en';setLang:(lang:'ka'|'en')=>void}) {
  const ka=lang==='ka';
  const features=useSiteFeatures();
  const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{let alive=true,observed=false;try{const client=getSupabaseBrowserClient();const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{observed=true;if(alive)setSignedIn(Boolean(session&&!session.user.is_anonymous))});void client.auth.getSession().then(({data:{session}})=>{if(alive&&!observed)setSignedIn(Boolean(session&&!session.user.is_anonymous))}).catch(()=>{});return()=>{alive=false;subscription.unsubscribe()}}catch{return()=>{alive=false}}},[]);
  return <div className="header-actions">
    <a className="header-sign-in" href={signedIn?'/app/settings':'/login'}>{signedIn?(ka?'ჩემი ანგარიში':'My account'):(ka?'შესვლა':'Sign in')}</a>
    {!signedIn&&<a className="header-register" href="/register">{ka?'რეგისტრაცია':'Register'}</a>}
    <Sheet>
      <SheetTrigger asChild><button className="header-burger" aria-label={ka?'მენიუს გახსნა':'Open menu'}><Menu size={22}/></button></SheetTrigger>
      <SheetContent className="bg-[#F9F8FC] p-6 overflow-y-auto">
        <SheetHeader><SheetTitle>{ka?'მენიუ':'Menu'}</SheetTitle></SheetHeader>
        <nav className="burger-links" aria-label={ka?'მთავარი მენიუ':'Main menu'}>
          <a href="/app/features">{ka?'ყველა ფუნქცია':'All features'}</a>
          {features.community&&<a href="/community">{ka?'მთავარი':'Home'}</a>}
          <a href="/about">{ka?'ჩვენ შესახებ':'About'}</a>
          {features.library&&<a href="/blog">{ka?'ბლოგები':'Library'}</a>}
          {features.market&&<a href="/market">{ka?'მარკეტი / მაღაზია':'Market / shop'}</a>}
          {features.period&&<a href="/app/dashboard">{ka?'პერიოდი':'Period'}</a>}
          {features.premium&&<a href="/premium">{ka?'პრემიუმი':'Premium'}</a>}
          {features.doctorConsultation&&<a href="/consultation">{ka?'ექიმთან კონსულტაცია':'Consult a doctor'}</a>}
          <a href="/market/orders">{ka?'ჩემი შეკვეთები':'My orders'}</a>
          {signedIn&&<a href="/app/settings">{ka?'ანგარიში და გამოსვლა':'Account & sign out'}</a>}
        </nav>
        <div className="burger-language"><span>{ka?'ენა':'Language'}</span><button onClick={()=>setLang(ka?'en':'ka')} lang={ka?'en':'ka'}>{ka?'English':'ქართული'}</button></div>
      </SheetContent>
    </Sheet>
  </div>;
}
