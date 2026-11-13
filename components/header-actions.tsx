"use client";
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSiteFeatures } from '@/lib/site-features';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

import { SiteCopyText } from "@/components/site-copy-provider";

export default function HeaderActions({lang,setLang}:{lang:'ka'|'en';setLang:(lang:'ka'|'en')=>void}) {
  const ka=lang==='ka';
  const pathname=usePathname();
  const features=useSiteFeatures();
  const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{let alive=true,observed=false;try{const client=getSupabaseBrowserClient();const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{observed=true;if(alive)setSignedIn(Boolean(session&&!session.user.is_anonymous))});void client.auth.getSession().then(({data:{session}})=>{if(alive&&!observed)setSignedIn(Boolean(session&&!session.user.is_anonymous))}).catch(()=>{});return()=>{alive=false;subscription.unsubscribe()}}catch{return()=>{alive=false}}},[]);
  return <div className="header-actions">
    {!signedIn&&<>
      <div className="header-auth-links">
        <Link className="header-sign-in" href="/login"><SiteCopyText id="nav.signIn" lang={lang}/></Link>
        <Link className="header-register" href="/register"><SiteCopyText id="nav.register" lang={lang}/></Link>
      </div>
      <Sheet>
        <SheetTrigger asChild><button className="header-mobile-auth-trigger">{ka?'ავტორიზაცია':'Sign in / Sign up'}</button></SheetTrigger>
        <SheetContent side="bottom" className="mobile-auth-sheet bg-[#F9F8FC] p-6">
          <SheetHeader className="mobile-auth-sheet-header">
            <SheetTitle>{ka?'ავტორიზაცია':'Sign in or create an account'}</SheetTitle>
            <SheetDescription>{ka?'აირჩიე, როგორ გინდა გააგრძელო.':'Choose how you would like to continue.'}</SheetDescription>
          </SheetHeader>
          <div className="mobile-auth-options">
            <SheetClose asChild><Link className="mobile-auth-option mobile-auth-option-primary" href="/login"><SiteCopyText id="nav.signIn" lang={lang}/></Link></SheetClose>
            <SheetClose asChild><Link className="mobile-auth-option" href="/register"><SiteCopyText id="nav.register" lang={lang}/></Link></SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>}
    <Sheet>
      <SheetTrigger asChild><button className="header-burger" aria-label={ka?'მენიუს გახსნა':'Open menu'}><Menu size={22}/></button></SheetTrigger>
      <SheetContent className="bg-[#F9F8FC] p-6 overflow-y-auto">
        <SheetHeader><SheetTitle><SiteCopyText id="nav.menu" lang={lang}/></SheetTitle></SheetHeader>
        <nav className="burger-links" aria-label={ka?'მთავარი მენიუ':'Main menu'}>
          {pathname!=="/app/features"&&<SheetClose asChild><Link href="/app/features"><SiteCopyText id="nav.services" lang={lang}/></Link></SheetClose>}
          {features.community&&<Link href="/community"><SiteCopyText id="nav.community" lang={lang}/></Link>}
          <Link href="/about"><SiteCopyText id="nav.about" lang={lang}/></Link>
          {pathname!=="/privacy"&&<SheetClose asChild><Link href="/privacy"><SiteCopyText id="policy.privacy.title" lang={lang}/></Link></SheetClose>}
          {features.library&&<Link href="/blog"><SiteCopyText id="nav.library" lang={lang}/></Link>}
          {features.market&&<Link href="/market"><SiteCopyText id="nav.market" lang={lang}/></Link>}
          {features.period&&<Link href="/app/dashboard"><SiteCopyText id="nav.period" lang={lang}/></Link>}
          {features.premium&&<Link href="/premium"><SiteCopyText id="nav.premium" lang={lang}/></Link>}
          {features.doctorConsultation&&<Link href="/consultation"><SiteCopyText id="nav.care" lang={lang}/></Link>}
          <Link href="/market/orders"><SiteCopyText id="nav.orders" lang={lang}/></Link>
          {signedIn&&pathname!=="/app/settings"&&<SheetClose asChild><Link href="/app/settings"><SiteCopyText id="nav.profile" lang={lang}/></Link></SheetClose>}
        </nav>
        <div className="burger-language"><span><SiteCopyText id="nav.language" lang={lang}/></span><button onClick={()=>setLang(ka?'en':'ka')} lang={ka?'en':'ka'}>{ka?'English':'ქართული'}</button></div>
      </SheetContent>
    </Sheet>
  </div>;
}
