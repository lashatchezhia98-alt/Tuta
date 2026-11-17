"use client";
import { BookOpen, ChevronRight, FileText, Globe, Grid2X2, LockKeyhole, Menu, Moon, Sparkles, Stethoscope, Store, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSiteFeatures } from '@/lib/site-features';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

import { SiteCopyText } from "@/components/site-copy-provider";
import { burgerLanguage, burgerMenuGroups } from "@/mobile/src/burger-menu";

const icons = { book: BookOpen, services: Grid2X2, care: Stethoscope,
  spark: Sparkles, periodMoon: Moon, communityStars: Sparkles, market: Store,
  profile: UserRound, report: FileText, moon: Moon, lock: LockKeyhole, terms: FileText };

export default function HeaderActions({lang,setLang}:{lang:'ka'|'en';setLang:(lang:'ka'|'en')=>void}) {
  const ka=lang==='ka';
  const pathname=usePathname();
  const features=useSiteFeatures();
  const language=burgerLanguage[lang];
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
      <SheetContent className="tuta-menu-sheet" showCloseButton={false}>
        <SheetHeader className="tuta-menu-header">
          <SheetTitle><SiteCopyText id="nav.menu" lang={lang}/></SheetTitle>
          <SheetDescription className="sr-only">{ka ? "თუთას გვერდები და ენა" : "Tuta pages and language"}</SheetDescription>
          <SheetClose asChild><button type="button" className="header-burger" aria-label={ka ? "მენიუს დახურვა" : "Close menu"}><X size={22}/></button></SheetClose>
        </SheetHeader>
        <nav aria-label={ka?'მთავარი მენიუ':'Main menu'}>
          {burgerMenuGroups(features, signedIn).map(group => (
            <section className="tuta-menu-group" key={group.id} aria-labelledby={`tuta-menu-${group.id}`}>
              <h2 id={`tuta-menu-${group.id}`}>{group.label[lang]}</h2>
              <ul>
                {group.entries.map(entry => {
                  const Icon = icons[entry.icon as keyof typeof icons] || Sparkles;
                  return <li key={entry.tab}>
                    <SheetClose asChild>
                      <Link className="tuta-menu-row" href={entry.href} aria-current={pathname === entry.href ? "page" : undefined}>
                        <span className="tuta-menu-icon" data-icon={entry.icon}><Icon size={19} aria-hidden="true"/></span>
                        <span className="tuta-menu-label">{entry.copy ? <SiteCopyText id={entry.copy} lang={lang}/> : entry.label[lang]}</span>
                        <ChevronRight className="tuta-menu-arrow" size={16} aria-hidden="true"/>
                      </Link>
                    </SheetClose>
                  </li>;
                })}
              </ul>
            </section>
          ))}
        </nav>
        <SheetClose asChild>
          <button type="button" className="tuta-menu-row tuta-menu-language" onClick={()=>setLang(language.code)}>
            <span className="tuta-menu-icon"><Globe size={19} aria-hidden="true"/></span>
            <strong className="tuta-menu-label"><SiteCopyText id="nav.language" lang={lang}/></strong>
            <span lang={language.code}>{language.next}</span>
          </button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  </div>;
}
