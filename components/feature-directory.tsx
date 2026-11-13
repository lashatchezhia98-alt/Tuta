"use client";
import { SiteCopyText } from "@/components/site-copy-provider";

import Link from 'next/link';
import BrandMark from '@/components/brand-mark';
import HeaderActions from '@/components/header-actions';
import { useEffect, useState } from 'react';
import { extraPages } from '@/lib/page-directory';
import { featureForRoute, useSiteFeatures, useSiteFeaturesStatus } from '@/lib/site-features';
import { serviceCopyKey, serviceGroups } from '@/lib/service-directory';
import { ChevronRight, LockKeyhole } from 'lucide-react';
import GuidedJourney from './guided-journey';
import PregnancyWorkspace from './pregnancy-workspace';
import PartnerWorkspace from './partner-workspace';

export default function FeatureDirectory({slug}:{slug?:string}) {
  const [lang,setLang]=useState<'ka'|'en'>('ka');
  const features=useSiteFeatures();
  const status=useSiteFeaturesStatus();
  useEffect(()=>{const timer=setTimeout(()=>{if(localStorage.getItem('tuta-language')==='en')setLang('en')},0);return()=>clearTimeout(timer)},[]);
  const ka=lang==='ka'; const page=extraPages.find(p=>p.slug===slug);
  if(page && page.slug!=='partners' && !features[page.slug]) return <main className="inner-container" style={{padding:32}}><h1>{ka?'ფუნქცია დროებით გამორთულია':'Feature temporarily disabled'}</h1><Link href="/app/features"><SiteCopyText id="directory.title" lang={lang}/></Link></main>;
  return <div className="inner-container" style={{padding:'24px 16px 80px'}}>
    <header style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:32}}>
      <Link href="/" className="inner-logo"><BrandMark/>{ka?'თუთა':'TUTA'}</Link>
      <HeaderActions lang={lang} setLang={next=>{setLang(next);localStorage.setItem('tuta-language',next);document.documentElement.lang=next}}/>
    </header>
    {page && <nav aria-label={ka?'ნავიგაცია':'Navigation'} style={{marginBottom:24}}><Link href="/app/features">← <SiteCopyText id="directory.servicesTitle" lang={lang}/></Link></nav>}
    {page ? <main><h1><SiteCopyText id={`extra.${page.slug}.title`} lang={lang}/></h1><p><SiteCopyText id={`extra.${page.slug}.intro`} lang={lang}/></p>{page.slug==='journey'?<GuidedJourney lang={lang}/>:page.slug==='pregnancy'?<PregnancyWorkspace lang={lang}/>:page.slug==='partners'?<PartnerWorkspace lang={lang}/>:<section className="workspace-card" style={{marginTop:24,padding:24}}><h2>{ka?'მიმდინარე მდგომარეობა':'Current availability'}</h2><p>{ka?page.status:page.englishStatus}</p><Link href={page.link}>{ka?page.action:page.englishAction} →</Link></section>}</main> : <main className="service-directory">
      <h1><SiteCopyText id="directory.servicesTitle" lang={lang}/></h1><p><SiteCopyText id="directory.intro" lang={lang}/></p>
      {status !== "ready" && <p role="status">{status === "loading"
        ? (ka ? "სერვისები იტვირთება…" : "Loading services…")
        : (ka ? "სერვისების სრული სია ვერ ჩაიტვირთა." : "Could not load all services.")}</p>}
      <div className="service-directory-groups">
        {serviceGroups.map(group => {
          const items = group.items.filter(([href]) => {
            const feature = featureForRoute(href);
            return !feature || features[feature];
          });
          if (!items.length) return null;
          const heading = `service-group-${group.id}`;
          return <section className="service-directory-group" key={group.id} aria-labelledby={heading}>
            <h2 id={heading}><SiteCopyText id={`directory.group.${group.id}`} lang={lang}/></h2>
            <ul className="service-directory-list">
              {items.map(([href, , , , , access]) => {
                const key = serviceCopyKey(href);
                return <li key={href}><Link href={href} className="service-directory-link">
                  <span className="service-directory-copy">
                    <strong><SiteCopyText id={key} lang={lang}/></strong>
                    <small><SiteCopyText id={`${key}.detail`} lang={lang}/></small>
                    {access === "premium" && <span className="service-directory-badge"><LockKeyhole size={12} aria-hidden="true"/><SiteCopyText id="nav.premium" lang={lang}/></span>}
                  </span>
                  <ChevronRight size={18} aria-hidden="true"/>
                </Link></li>;
              })}
            </ul>
          </section>;
        })}
      </div>
    </main>}
  </div>;
}
