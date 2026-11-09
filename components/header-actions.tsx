"use client";
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSiteFeatures } from '@/lib/site-features';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

import { SiteCopyText } from "@/components/site-copy-provider";

export default function HeaderActions({lang,setLang}:{lang:'ka'|'en';setLang:(lang:'ka'|'en')=>void}) {
  const ka=lang==='ka';
  const features=useSiteFeatures();
  const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{let alive=true,observed=false;try{const client=getSupabaseBrowserClient();const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{observed=true;if(alive)setSignedIn(Boolean(session&&!session.user.is_anonymous))});void client.auth.getSession().then(({data:{session}})=>{if(alive&&!observed)setSignedIn(Boolean(session&&!session.user.is_anonymous))}).catch(()=>{});return()=>{alive=false;subscription.unsubscribe()}}catch{return()=>{alive=false}}},[]);
  return <div className="header-actions">
    <a className="header-sign-in" href={signedIn?'/app/settings':'/login'}><SiteCopyText id={signedIn?'nav.account':'nav.signIn'} lang={lang}/></a>
    {!signedIn&&<a className="header-register" href="/register"><SiteCopyText id="nav.register" lang={lang}/></a>}
    <Sheet>
      <SheetTrigger asChild><button className="header-burger" aria-label={ka?'მენიუს გახსნა':'Open menu'}><Menu size={22}/></button></SheetTrigger>
      <SheetContent className="bg-[#F9F8FC] p-6 overflow-y-auto">
        <SheetHeader><SheetTitle><SiteCopyText id="nav.menu" lang={lang}/></SheetTitle></SheetHeader>
        <nav className="burger-links" aria-label={ka?'მთავარი მენიუ':'Main menu'}>
          <a href="/app/features"><SiteCopyText id="nav.features" lang={lang}/></a>
          {features.community&&<a href="/community"><SiteCopyText id="nav.community" lang={lang}/></a>}
          <a href="/about"><SiteCopyText id="nav.about" lang={lang}/></a>
          {features.library&&<a href="/blog"><SiteCopyText id="nav.library" lang={lang}/></a>}
          {features.market&&<a href="/market"><SiteCopyText id="nav.market" lang={lang}/></a>}
          {features.period&&<a href="/app/dashboard"><SiteCopyText id="nav.period" lang={lang}/></a>}
          {features.premium&&<a href="/premium"><SiteCopyText id="nav.premium" lang={lang}/></a>}
          {features.doctorConsultation&&<a href="/consultation"><SiteCopyText id="nav.care" lang={lang}/></a>}
          <a href="/market/orders"><SiteCopyText id="nav.orders" lang={lang}/></a>
          {signedIn&&<a href="/app/settings"><SiteCopyText id="nav.signOut" lang={lang}/></a>}
        </nav>
        <div className="burger-language"><span><SiteCopyText id="nav.language" lang={lang}/></span><button onClick={()=>setLang(ka?'en':'ka')} lang={ka?'en':'ka'}>{ka?'English':'ქართული'}</button></div>
      </SheetContent>
    </Sheet>
  </div>;
}
