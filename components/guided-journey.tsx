"use client";
import Link from 'next/link';
import { useHealthState } from '@/app/use-health-state';
import { trackingJourney } from '../mobile/src/cycle-guidance.mjs';

export default function GuidedJourney({lang}:{lang:'ka'|'en'}) {
  const health = useHealthState();
  const ka = lang === 'ka';
  if (!health.loaded) return <p role="status">{ka ? 'იტვირთება…' : 'Loading…'}</p>;
  if (!health.session) return <p>{ka ? 'შედი ანგარიშში შენი გზამკვლევის სანახავად.' : 'Sign in to see your journey.'} <Link href="/login">{ka ? 'შესვლა / რეგისტრაცია' : 'Sign in / register'}</Link></p>;
  if (health.error) return <p role="alert">{ka ? 'ჩანაწერები ვერ ჩაიტვირთა. განაახლე გვერდი.' : 'Could not load your entries. Reload this page.'}</p>;
  const steps = trackingJourney(health.data, lang);
  const links: Record<string,string> = {period:'/app/dashboard',log:'/app/log',insights:'/app/insights'};
  return <div className="feature-directory-grid">{steps.map(step => <section className="workspace-card" key={step.id}>
    <p>{step.done ? (ka ? '✓ შესრულებულია' : '✓ Completed') : (ka ? 'შემდეგი ნაბიჯი' : 'Next step')}</p>
    <h2>{step.title}</h2><p>{step.detail}</p>
    <Link href={links[step.action]}>{ka ? 'გახსნა' : 'Open'} →</Link>
  </section>)}</div>;
}
