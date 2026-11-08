"use client";
import Link from 'next/link';
import BrandMark from '@/components/brand-mark';
import HeaderActions from '@/components/header-actions';
import { useEffect, useState } from 'react';
import { extraPages } from '@/lib/page-directory';
import { featureForRoute, useSiteFeatures } from '@/lib/site-features';
import GuidedJourney from './guided-journey';
import PregnancyWorkspace from './pregnancy-workspace';
import PartnerWorkspace from './partner-workspace';

const existing = [
  ['/community','მთავარი','Home'], ['/app/dashboard','პერიოდი','Period'],
  ['/app/log','დღიური','Journal'], ['/app/insights','ანალიზი','Insights'],
  ['/app/report','ექიმისთვის ანგარიში','Doctor report'], ['/blog','ბლოგები','Library'],
  ['/consultation','ექიმები, ჩატი და ჯავშნები','Doctors, chat & bookings'],
  ['/premium','პრემიუმი','Premium'], ['/app/settings','პარამეტრები','Settings'],
  ['/tools/period-calculator','პერიოდის კალკულატორი','Period calculator'],
  ['/tools/ovulation-calculator','ოვულაციის კალკულატორი','Ovulation calculator'],
  ['/about','ჩვენ შესახებ','About'], ['/privacy','კონფიდენციალურობა','Privacy'],
  ['/terms','წესები და პირობები','Terms'],
] as const;
export default function FeatureDirectory({slug}:{slug?:string}) {
  const [lang,setLang]=useState<'ka'|'en'>('ka');
  const features=useSiteFeatures();
  useEffect(()=>{const timer=setTimeout(()=>{if(localStorage.getItem('tuta-language')==='en')setLang('en')},0);return()=>clearTimeout(timer)},[]);
  const ka=lang==='ka'; const page=extraPages.find(p=>p.slug===slug);
  if(page && page.slug!=='partners' && !features[page.slug]) return <main className="inner-container" style={{padding:32}}><h1>{ka?'ფუნქცია დროებით გამორთულია':'Feature temporarily disabled'}</h1><Link href="/app/features">{ka?'ყველა ფუნქცია':'All features'}</Link></main>;
  return <div className="inner-container" style={{padding:'24px 16px 80px'}}>
    <header style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:32}}>
      <Link href="/" className="inner-logo"><BrandMark/>{ka?'თუთა':'TUTA'}</Link>
      <HeaderActions lang={lang} setLang={next=>{setLang(next);localStorage.setItem('tuta-language',next);document.documentElement.lang=next}}/>
    </header>
    <nav aria-label={ka?'ნავიგაცია':'Navigation'} style={{marginBottom:24}}><Link href="/app/features">{ka?'ყველა ფუნქცია':'All features'}</Link></nav>
    {page ? <main><h1>{ka?page.ka:page.en}</h1><p>{ka?page.description:page.english}</p>{page.slug==='journey'?<GuidedJourney lang={lang}/>:page.slug==='pregnancy'?<PregnancyWorkspace lang={lang}/>:page.slug==='partners'?<PartnerWorkspace lang={lang}/>:<section className="workspace-card" style={{marginTop:24,padding:24}}><h2>{ka?'მიმდინარე მდგომარეობა':'Current availability'}</h2><p>{ka?page.status:page.englishStatus}</p><Link href={page.link}>{ka?page.action:page.englishAction} →</Link></section>}</main> : <main>
      <h1>{ka?'ყველა ფუნქცია':'All features'}</h1><p>{ka?'აირჩიე შენი სივრცე. მოსამზადებელი ფუნქციები ცალკეა მონიშნული.':'Choose your space. Features still in preparation are clearly marked.'}</p>
      <div className="feature-directory-grid">{existing.filter(([url])=>{const id=featureForRoute(url);return !id||features[id]}).map(([url,a,b])=><Link className="workspace-card directory-link" key={url} href={url}>{ka?a:b}<span aria-hidden>↗</span></Link>)}</div>
      <div className="feature-directory-grid">{extraPages.filter(p=>['journey','pregnancy','partners'].includes(p.slug)&&features[p.slug]).map(p=><Link className="workspace-card directory-link" key={p.slug} href={'/app/'+p.slug}>{ka?p.ka:p.en} ↗</Link>)}</div>
      <h2>{ka?'მომზადების ეტაპზე':'In preparation'}</h2><div className="feature-directory-grid">{extraPages.filter(p=>!['journey','pregnancy','partners'].includes(p.slug)&&features[p.slug]).map(p=><Link className="workspace-card directory-link" key={p.slug} href={'/app/'+p.slug}>{ka?p.ka:p.en}<span aria-hidden>↗</span></Link>)}</div>
    </main>}
  </div>;
}
