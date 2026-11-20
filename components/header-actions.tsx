"use client";
import { Bell, BookOpen, ChevronRight, FileText, Globe, Grid2X2, LockKeyhole, LogOut, Menu, Moon, Sparkles, Stethoscope, Store, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSiteFeatures } from '@/lib/site-features';
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { Session } from "@supabase/supabase-js";

import { SiteCopyText } from "@/components/site-copy-provider";
import { burgerLanguage, burgerMenuGroups } from "@/mobile/src/burger-menu";
import { activityBadgeText } from "@/mobile/src/activity.mjs";
import { useActivityCount } from "@/lib/use-activity-count";

const icons = { book: BookOpen, services: Grid2X2, care: Stethoscope,
  spark: Sparkles, periodMoon: Moon, communityStars: Sparkles, market: Store,
  profile: UserRound, report: FileText, moon: Moon, lock: LockKeyhole, terms: FileText };
const desktopLinks = [
  ["/app/dashboard", "nav.period", "period"],
  ["/community", null, "community"],
  ["/app/features", "nav.services", null],
  ["/market", "nav.market", "market"],
  ["/app/settings", "nav.profile", null],
] as const;

export default function HeaderActions({lang,setLang}:{lang:'ka'|'en';setLang:(lang:'ka'|'en')=>void}) {
  const ka=lang==='ka';
  const pathname=usePathname();
  const features=useSiteFeatures();
  const language=burgerLanguage[lang];
  const [owner,setOwner]=useState<string | null>(null);
  const signedIn=Boolean(owner);
  const unread=useActivityCount(owner, pathname);
  const [doctorAccount,setDoctorAccount]=useState(false);
  const authSequence=useRef(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  useEffect(()=>{
    let alive=true, observed=false;
    const apply=async(session:Session|null)=>{
      const turn=++authSequence.current;
      const member=session && !session.user.is_anonymous ? session.user.id : null;
      if(alive){setOwner(member);setDoctorAccount(false)}
      if(!member||!session)return;
      try {
        const response=await fetch("/api/care?role=1",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
        const value=await response.json();
        if(alive&&turn===authSequence.current)setDoctorAccount(Boolean(response.ok&&value.isDoctor));
      } catch { if(alive&&turn===authSequence.current)setDoctorAccount(false); }
    };
    try {
      const client=getSupabaseBrowserClient();
      const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{observed=true;void apply(session)});
      void client.auth.getSession().then(({data:{session}})=>{if(alive&&!observed)void apply(session)}).catch(()=>{});
      return()=>{alive=false;authSequence.current++;subscription.unsubscribe()};
    } catch { return()=>{alive=false;authSequence.current++}; }
  },[]);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      // Full navigation drops private state immediately, even if already on "/".
      window.location.replace("/");
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }
  return <div className="header-actions">
    {signedIn && <nav className="desktop-member-nav" aria-label={ka ? "მთავარი ნავიგაცია" : "Main navigation"}>
      {(doctorAccount ? [["/community", null, "community"], ["/consultation/doctor", null, null], ["/app/settings", "nav.profile", null]] as const : desktopLinks).filter(([, , feature]) => !feature || features[feature]).map(([href, copy]) => {
        const active = href === "/app/dashboard"
          ? ["/app/dashboard", "/app/log", "/app/insights", "/app/reminders", "/app/report"].includes(pathname)
          : pathname === href || pathname.startsWith(href + "/");
        return <Link key={href} href={href} aria-current={active ? "page" : undefined}>
          {copy ? <SiteCopyText id={copy} lang={lang}/> : href === "/consultation/doctor" ? (ka ? "ექიმის კაბინეტი" : "Doctor workspace") : (ka ? "საზოგადოება" : "Community")}
        </Link>;
      })}
    </nav>}
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
    {signedIn && <Link className="header-activity" href="/app/activity" aria-label={ka ? `შეტყობინებები${unread ? `, ${unread} წაუკითხავი` : ""}` : `Notifications${unread ? `, ${unread} unread` : ""}`}>
      <Bell size={23} aria-hidden="true"/>{unread > 0 && <span className="activity-badge" aria-hidden="true">{activityBadgeText(unread)}</span>}
    </Link>}
    <Sheet>
      <SheetTrigger asChild><button className="header-burger" aria-label={ka?'მენიუს გახსნა':'Open menu'}><Menu size={22}/></button></SheetTrigger>
      <SheetContent className="tuta-menu-sheet" showCloseButton={false}>
        <SheetHeader className="tuta-menu-header">
          <SheetTitle><SiteCopyText id="nav.menu" lang={lang}/></SheetTitle>
          <SheetDescription className="sr-only">{ka ? "თუთას გვერდები და ენა" : "Tuta pages and language"}</SheetDescription>
          <SheetClose asChild><button type="button" className="header-burger" aria-label={ka ? "მენიუს დახურვა" : "Close menu"}><X size={22}/></button></SheetClose>
        </SheetHeader>
        <nav aria-label={ka?'მთავარი მენიუ':'Main menu'}>
          {burgerMenuGroups(features, signedIn, doctorAccount).map(group => (
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
        {signedIn && <div className="tuta-menu-sign-out">
          <button type="button" className="tuta-menu-row" onClick={() => void signOut()} disabled={signingOut}>
            <span className="tuta-menu-icon"><LogOut size={19} aria-hidden="true"/></span>
            <strong className="tuta-menu-label">{signingOut ? (ka ? "ანგარიშიდან გამოსვლა…" : "Signing out…") : <SiteCopyText id="settings.signOut" lang={lang}/>}</strong>
          </button>
          {signOutError && <p role="alert">{ka ? "გამოსვლა ვერ მოხერხდა. სცადე ხელახლა." : "Could not sign out. Try again."}</p>}
        </div>}
      </SheetContent>
    </Sheet>
  </div>;
}
