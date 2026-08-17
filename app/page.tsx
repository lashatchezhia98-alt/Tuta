"use client";

import { useEffect, useState } from "react";

type Language = "ka" | "en";

const copy = {
  ka: {
    nav: ["თუთას შესახებ", "შესაძლებლობები", "როგორ მუშაობს", "ბიბლიოთეკა"],
    signIn: "შესვლა", signUp: "რეგისტრაცია",
    eyebrow: "შენი სხეული. შენი რიტმი.",
    heroTitle: <>გაიგე შენი ციკლი.<br /><span>იცხოვრე უფრო გაცნობიერებულად.</span></>,
    heroText: "პირადი სივრცე ციკლის, სიმპტომებისა და ყოველდღიური ცვლილებების გასაგებად — ზუსტად, მშვიდად და შენს ენაზე.",
    start: "დაიწყე უფასოდ", anonymous: "გამოიყენე ანონიმურად", noCard: "ბარათი არ არის საჭირო",
    trusted: ["მონაცემები შენ გეკუთვნის", "რეკლამის გარეშე", "გამოთვლები მოწყობილობაზე"],
    greeting: "დილა მშვიდობისა, ნინო", cycleDay: "ციკლის მე-14 დღე", phase: "ოვულაციის ფაზა", next: "შემდეგი პერიოდი", nextDate: "12 სექტემბერი", fertile: "ნაყოფიერი ფანჯარა", fertileValue: "კიდევ 2 დღე", energy: "ენერგია", energyValue: "მაღალი",
    introLabel: "რატომ თუთა", introTitle: <>ჯანმრთელობაზე ზრუნვა იწყება<br /><span>საკუთარი სხეულის გაგებით.</span></>, introText: "ციკლი მხოლოდ კალენდარში მონიშნული დღეები არ არის. ის გავლენას ახდენს ენერგიაზე, ძილზე, განწყობასა და ყოველდღიურ კეთილდღეობაზე. თუთა ამ ცვლილებებს ერთ გასაგებ სურათად აერთიანებს.",
    featuresLabel: "ძირითადი შესაძლებლობები", featuresTitle: "ყველაფერი მნიშვნელოვანი — ერთ ადგილას.",
    features: [
      ["01", "ზუსტი პროგნოზები", "პერიოდის, ოვულაციისა და ნაყოფიერი დღეების პროგნოზი შენი რეალური ციკლის მიხედვით."],
      ["02", "დღიური ჩანაწერები", "განწყობა, ენერგია, ტკივილი, ნაკადი და 80-ზე მეტი სიმპტომი რამდენიმე წამში."],
      ["03", "პირადი პატერნები", "აღმოაჩინე განმეორებადი ცვლილებები და გაიგე, რა არის ტიპური კონკრეტულად შენთვის."],
    ],
    productLabel: "ყოველდღიური მხარდაჭერა", productTitle: <>ნაკლები ვარაუდი.<br />მეტი სიცხადე.</>, productText: "მოკლე ყოველდღიური ჩანაწერები დროთა განმავლობაში გაძლევს რეალურ სურათს. თუთა გაჩვენებს მხოლოდ იმ ინფორმაციას, რომელიც დღეს გჭირდება.",
    steps: [["01", "მონიშნე, როგორ გრძნობ თავს"], ["02", "მიიღე ფაზაზე მორგებული ხედვა"], ["03", "დააკვირდი ცვლილებებს დროში"]],
    logTitle: "დღევანდელი ჩანაწერი", feeling: "როგორ გრძნობ თავს?", mood: "კარგად", symptoms: "სიმპტომები", symptomItems: ["ენერგიული", "მსუბუქი შებერილობა"], save: "ჩანაწერის შენახვა",
    privacyLabel: "Privacy by design", privacyTitle: "პირადი ინფორმაცია პირადი უნდა დარჩეს.", privacyText: "თუთა არ ყიდის ჯანმრთელობის მონაცემებს, არ აჩვენებს რეკლამას და გაძლევს სრულ კონტროლს შენს ისტორიაზე.", privacyPoints: ["ანონიმური რეჟიმი", "დაცული შენახვა", "სრული კონტროლი"],
    ctaTitle: <>შენი სხეულის გაგება<br />დღესვე დაიწყე.</>, ctaText: "პერიოდისა და ოვულაციის პროგნოზი ყოველთვის უფასოა.", ctaButton: "შექმენი უფასო ანგარიში", ctaAnon: "ან გააგრძელე ანონიმურად",
    footerText: "შენი ჯანმრთელობის ცნობიერება იწყება აქ.", product: "პროდუქტი", resources: "რესურსები", company: "კომპანია", footerLinks: ["შესაძლებლობები", "Premium", "კალკულატორები", "ჯანმრთელობის ბიბლიოთეკა", "ხშირი კითხვები", "ჩვენს შესახებ", "კონფიდენციალურობა", "კონტაქტი"], rights: "© 2026 TUTA. ყველა უფლება დაცულია.", made: "შექმნილია საქართველოში",
  },
  en: {
    nav: ["About TUTA", "Features", "How it works", "Library"], signIn: "Sign in", signUp: "Sign up",
    eyebrow: "Your body. Your rhythm.", heroTitle: <>Understand your cycle.<br /><span>Live with more awareness.</span></>, heroText: "A private space to understand your cycle, symptoms and everyday changes — accurately, calmly and in your language.", start: "Start for free", anonymous: "Use anonymously", noCard: "No payment card required",
    trusted: ["Your data belongs to you", "Always ad-free", "On-device calculations"],
    greeting: "Good morning, Nino", cycleDay: "Cycle day 14", phase: "Ovulation phase", next: "Next period", nextDate: "September 12", fertile: "Fertile window", fertileValue: "2 days remaining", energy: "Energy", energyValue: "High",
    introLabel: "Why TUTA", introTitle: <>Better health starts with<br /><span>understanding your body.</span></>, introText: "Your cycle is more than dates on a calendar. It shapes your energy, sleep, mood and daily wellbeing. TUTA brings those changes together into one clear picture.",
    featuresLabel: "Core features", featuresTitle: "Everything that matters, in one place.",
    features: [["01", "Accurate predictions", "Period, ovulation and fertile-day predictions based on your real cycle."], ["02", "Daily tracking", "Mood, energy, pain, flow and more than 80 symptoms logged in seconds."], ["03", "Personal patterns", "See recurring changes and learn what is typical specifically for you."]],
    productLabel: "Daily support", productTitle: <>Less guessing.<br />More clarity.</>, productText: "Short daily logs build a meaningful picture over time. TUTA shows you only the information that matters today.", steps: [["01", "Log how you feel"], ["02", "Get phase-specific context"], ["03", "See changes over time"]],
    logTitle: "Today's log", feeling: "How are you feeling?", mood: "Good", symptoms: "Symptoms", symptomItems: ["Energetic", "Mild bloating"], save: "Save today's log",
    privacyLabel: "Privacy by design", privacyTitle: "Private information should stay private.", privacyText: "TUTA never sells health data, never shows ads and gives you full control over your history.", privacyPoints: ["Anonymous mode", "Protected storage", "Full control"],
    ctaTitle: <>Start understanding<br />your body today.</>, ctaText: "Period and ovulation predictions are always free.", ctaButton: "Create a free account", ctaAnon: "Or continue anonymously",
    footerText: "Your health awareness starts here.", product: "Product", resources: "Resources", company: "Company", footerLinks: ["Features", "Premium", "Calculators", "Health library", "FAQ", "About us", "Privacy", "Contact"], rights: "© 2026 TUTA. All rights reserved.", made: "Made in Georgia",
  },
};

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <a href="#top" className={`logo ${inverse ? "logo-inverse" : ""}`} aria-label="TUTA home"><span className="logo-mark" aria-hidden="true" /><strong>TUTA</strong></a>;
}

export default function Home() {
  const [lang, setLang] = useState<Language>("ka");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (localStorage.getItem("tuta-language") === "en") setLang("en"); }, []);
  useEffect(() => { localStorage.setItem("tuta-language", lang); document.documentElement.lang = lang; }, [lang]);
  const t = copy[lang];

  return (
    <main id="top">
      <header className="header"><div className="container nav"><Logo /><nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Main navigation"><a href="#about">{t.nav[0]}</a><a href="#features">{t.nav[1]}</a><a href="#how">{t.nav[2]}</a><a href="/blog">{t.nav[3]}</a><button className="lang" onClick={() => setLang(lang === "ka" ? "en" : "ka")} aria-label={lang === "ka" ? "Switch to English" : "ქართულზე გადართვა"}>{lang === "ka" ? "EN" : "KA"}</button><a className="sign-in" href="/login">{t.signIn}</a><a className="btn btn-primary btn-small" href="/register">{t.signUp}</a></nav><button className={`hamburger ${menuOpen ? "active" : ""}`} aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><i /><i /></button></div></header>

      <section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="overline"><i />{t.eyebrow}</div><h1>{t.heroTitle}</h1><p>{t.heroText}</p><div className="hero-actions"><a className="btn btn-primary" href="/register">{t.start}<b>→</b></a><a className="secondary-link" href="/app/dashboard">{t.anonymous}<b>↗</b></a></div><small>{t.noCard}</small></div>
        <div className="product-preview"><div className="preview-glow" /><div className="app-window"><div className="app-top"><Logo /><div className="app-user">NN</div></div><div className="app-greeting"><p>{t.greeting}</p><strong>{t.cycleDay}</strong></div><div className="cycle-panel"><div className="cycle-dial"><div><small>{t.phase}</small><strong>14</strong><span>/ 28</span></div></div><div className="cycle-stats"><div><small>{t.next}</small><strong>{t.nextDate}</strong></div><div><small>{t.fertile}</small><strong>{t.fertileValue}</strong></div></div></div><div className="mini-stat-row"><div><span className="stat-icon pulse" /><p><small>{t.energy}</small><strong>{t.energyValue}</strong></p></div><div className="week-days"><span>11</span><span>12</span><span>13</span><span className="today">14</span><span>15</span></div></div></div><div className="status-card"><span>✓</span><div><small>{t.trusted[0]}</small><strong>Private by default</strong></div></div></div>
      </div></section>

      <section className="trust"><div className="container">{t.trusted.map((item, index) => <div key={item}><span>{index === 0 ? "01" : index === 1 ? "02" : "03"}</span><p>{item}</p></div>)}</div></section>

      <section className="intro container" id="about"><div className="section-label">{t.introLabel}</div><div className="intro-content"><h2>{t.introTitle}</h2><div><p>{t.introText}</p><a className="inline-link" href="/about">{lang === "ka" ? "გაიგე მეტი" : "Learn more"}<span>→</span></a></div></div></section>

      <section className="features" id="features"><div className="container"><div className="section-head"><div className="section-label">{t.featuresLabel}</div><h2>{t.featuresTitle}</h2></div><div className="feature-grid">{t.features.map(([num, title, text], index) => <article key={num}><div className={`feature-symbol symbol-${index + 1}`} aria-hidden="true"><span /></div><small>{num}</small><h3>{title}</h3><p>{text}</p><a href="/register" aria-label={title}>→</a></article>)}</div></div></section>

      <section className="product" id="how"><div className="container product-grid"><div className="log-stage"><div className="log-card"><div className="log-head"><strong>{t.logTitle}</strong><span>14 / 08</span></div><p>{t.feeling}</p><div className="mood-scale"><button>1</button><button>2</button><button className="selected">3</button><button>4</button><button>5</button></div><div className="log-field"><small>{t.mood}</small><strong>{lang === "ka" ? "მშვიდად" : "Calm"}</strong></div><div className="log-field"><small>{t.symptoms}</small><div className="tags"><span>{t.symptomItems[0]}</span><span>{t.symptomItems[1]}</span></div></div><button className="save-log">{t.save}</button></div></div><div className="product-copy"><div className="section-label light">{t.productLabel}</div><h2>{t.productTitle}</h2><p>{t.productText}</p><ol>{t.steps.map(([num, text]) => <li key={num}><span>{num}</span>{text}</li>)}</ol></div></div></section>

      <section className="privacy"><div className="container privacy-grid"><div><div className="section-label">{t.privacyLabel}</div><h2>{t.privacyTitle}</h2></div><div><p>{t.privacyText}</p><ul>{t.privacyPoints.map((point) => <li key={point}><i>✓</i>{point}</li>)}</ul></div></div></section>

      <section className="final-cta"><div className="container"><div className="cta-orbit" aria-hidden="true"><i /></div><div className="cta-copy"><h2>{t.ctaTitle}</h2><p>{t.ctaText}</p><a className="btn btn-primary" href="/register">{t.ctaButton}<b>→</b></a><a className="secondary-link" href="/app/dashboard">{t.ctaAnon}</a></div></div></section>

      <footer><div className="container footer-grid"><div className="footer-brand"><Logo inverse /><p>{t.footerText}</p></div><div><h3>{t.product}</h3><a href="#features">{t.footerLinks[0]}</a><a href="/premium">{t.footerLinks[1]}</a><a href="/tools/period-calculator">{t.footerLinks[2]}</a></div><div><h3>{t.resources}</h3><a href="/blog">{t.footerLinks[3]}</a><a href="#">{t.footerLinks[4]}</a><a href="/about">{t.footerLinks[5]}</a></div><div><h3>{t.company}</h3><a href="#">{t.footerLinks[6]}</a><a href="#">{t.footerLinks[7]}</a></div></div><div className="container footer-bottom"><span>{t.rights}</span><span>{t.made}</span></div></footer>
    </main>
  );
}
