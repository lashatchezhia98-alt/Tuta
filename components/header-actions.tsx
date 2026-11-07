"use client";
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSiteFeatures } from '@/lib/site-features';

export default function HeaderActions({lang,setLang}:{lang:'ka'|'en';setLang:(lang:'ka'|'en')=>void}) {
  const ka=lang==='ka';
  const features=useSiteFeatures();
  return <div className="header-actions">
    <a className="header-sign-in" href="/login">{ka?'შესვლა':'Sign in'}</a>
    <Sheet>
      <SheetTrigger asChild><button className="header-burger" aria-label={ka?'მენიუს გახსნა':'Open menu'}><Menu size={22}/></button></SheetTrigger>
      <SheetContent className="bg-[#F9F8FC] p-6 overflow-y-auto">
        <SheetHeader><SheetTitle>{ka?'მენიუ':'Menu'}</SheetTitle></SheetHeader>
        <nav className="burger-links" aria-label={ka?'მთავარი მენიუ':'Main menu'}>
          <a href="/app/features">{ka?'ყველა ფუნქცია':'All features'}</a>
          {features.community&&<a href="/community">{ka?'მთავარი':'Home'}</a>}
          <a href="/about">{ka?'ჩვენ შესახებ':'About'}</a>
          {features.library&&<a href="/blog">{ka?'ბლოგები':'Library'}</a>}
          {features.period&&<a href="/app/dashboard">{ka?'პერიოდი':'Period'}</a>}
          {features.premium&&<a href="/premium">{ka?'პრემიუმი':'Premium'}</a>}
          {features.doctorConsultation&&<a href="/consultation">{ka?'ექიმთან კონსულტაცია':'Consult a doctor'}</a>}
          <a href="/register">{ka?'რეგისტრაცია':'Register'}</a>
        </nav>
        <div className="burger-language"><span>{ka?'ენა':'Language'}</span><button onClick={()=>setLang(ka?'en':'ka')} lang={ka?'en':'ka'}>{ka?'English':'ქართული'}</button></div>
      </SheetContent>
    </Sheet>
  </div>;
}
