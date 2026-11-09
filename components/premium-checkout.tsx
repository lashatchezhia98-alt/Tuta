"use client";
import { SiteCopyText } from "@/components/site-copy-provider";


import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useMembership } from "@/lib/use-membership";

type Lang = "ka" | "en";
type Plan = "monthly" | "yearly";

export default function PremiumCheckout({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [notice, setNotice] = useState("");
  const {active,expiresAt,refresh,status}=useMembership();

  const refreshMembership = useCallback(async (showMessage = true) => {
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) {
        if (showMessage) setNotice(ka ? "სტატუსის სანახავად შედი შენს ანგარიშში." : "Sign in to check your membership.");
        return;
      }
      const response = await fetch("/api/payments/flitt/status", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const data = await response.json() as { active?: boolean; expiresAt?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Status check failed.");
      await refresh();
      if (showMessage) setNotice(data.active
        ? (ka ? "Premium გააქტიურებულია ✓" : "Premium is active ✓")
        : (ka ? "გადახდა ჯერ არ დადასტურებულა. ცოტა ხანში ხელახლა შეამოწმე." : "Payment is not confirmed yet. Check again shortly."));
    } catch {
      if (showMessage) setNotice(ka ? "სტატუსის შემოწმება ვერ მოხერხდა. სცადე ხელახლა." : "Could not check status. Please try again.");
    }
  }, [ka,refresh]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("payment") === "returned") {
      const timer = window.setTimeout(() => void refreshMembership(true), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [refreshMembership]);

  async function startCheckout() {
    setBusy(true);
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) {
        setNotice(ka ? "Premium-ის სატესტოდ შესვლა ან რეგისტრაციაა საჭირო." : "Sign in or create an account to test Premium checkout.");
        return;
      }
      const response = await fetch("/api/payments/flitt/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Checkout could not start.");
      window.location.assign(data.checkoutUrl);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : ka ? "გადახდის დაწყება ვერ მოხერხდა." : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  const dateText = expiresAt
    ? new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", { dateStyle: "long" }).format(new Date(expiresAt))
    : "";

  return <section className="inner-container premium-checkout">
    <div className="premium-checkout-card">
      <div className="premium-checkout-copy">
        <span className="inner-kicker"><SiteCopyText id="premium.testMode" lang={lang}/></span>
        <h2><SiteCopyText id="premium.heading" lang={lang}/></h2>
        <p><SiteCopyText id="premium.instructions" lang={lang}/></p>
        <div className="premium-plan-options" role="group" aria-label={ka ? "Premium პაკეტის არჩევა" : "Choose a Premium plan"}>
          <button type="button" className={plan === "monthly" ? "selected" : ""} aria-pressed={plan === "monthly"} onClick={() => setPlan("monthly")}>
            <strong>4.99 ₾</strong><span><SiteCopyText id="premium.monthly" lang={lang}/></span>
          </button>
          <button type="button" className={plan === "yearly" ? "selected" : ""} aria-pressed={plan === "yearly"} onClick={() => setPlan("yearly")}>
            <strong>49.90 ₾</strong><span><SiteCopyText id="premium.yearly" lang={lang}/></span><em><SiteCopyText id="premium.annualOffer" lang={lang}/></em>
          </button>
        </div>
        <div className="premium-price"><strong>{plan === "yearly" ? "49.90 ₾" : "4.99 ₾"}</strong><span>{plan === "yearly" ? (ka ? "/ წელი · ერთჯერადი სატესტო გადახდა" : "/ year · one-time test payment") : (ka ? "/ 30 დღე · ერთჯერადი სატესტო გადახდა" : "/ 30 days · one-time test payment")}</span></div>
        <button className="premium-pay-button" type="button" disabled={busy} onClick={() => void startCheckout()}>
          {busy ? (ka ? "მზადდება…" : "Preparing…") : (<SiteCopyText id="premium.pay" lang={lang}/>)}
        </button>
        <button className="premium-status-button" type="button" onClick={() => void refreshMembership()}>
          <SiteCopyText id="premium.status" lang={lang}/>
        </button>
        {active && <p className="premium-active" role="status">{ka ? `Premium აქტიურია ${dateText}-მდე.` : `Premium is active until ${dateText}.`}</p>}
        {notice && <p className="premium-notice" role="status">{notice}</p>}
        {status==='error'&&<p role="alert">{ka?'წევრობის სტატუსი ვერ შემოწმდა. სცადე განახლება.':'Could not check membership. Retry.'}</p>}
        {!active&&<p><a href="/login">{ka?'შესვლა':'Sign in'}</a> · <a href="/register">{ka?'ანგარიშის შექმნა':'Create account'}</a></p>}
      </div>
      <aside className="premium-test-note">
        <strong><SiteCopyText id="premium.sandbox" lang={lang}/></strong>
        <p><SiteCopyText id="premium.sandboxNote" lang={lang}/></p>
        <a href="https://docs.flitt.com/api/testing/" target="_blank" rel="noreferrer"><SiteCopyText id="premium.testCards" lang={lang}/></a>
      </aside>
    </div>
    <section className="workspace-card premium-benefits"><h2>{ka?'უფასო და Premium':'Free & Premium'}</h2><div className="workspace-grid"><article><h3>{ka?'უფასო':'Free'}</h3><ul>{(ka?['პერიოდის კალენდარი და სავარაუდო პროგნოზები','დღიური და სიმპტომების აღრიცხვა','ციკლების ისტორია და ძირითადი შეჯამება','საზოგადოება, ბლოგები და მარკეტის დათვალიერება']:['Period calendar and estimated predictions','Daily journal and symptom logging','Cycle history and basic summaries','Community, articles and browsing the market']).map(item=><li key={item}>{item}</li>)}</ul></article><article><h3>Premium</h3><ul>{(ka?['უფასო პაკეტის ყველა ფუნქცია','განმეორებადი სიმპტომების ანალიზი','ექიმისთვის ანგარიშის მომზადება','ორსულობის დამატებითი თვალყურის დევნება','თანხმობით გაზიარება პარტნიორთან','ხელმისაწვდომ ექიმთან ჩატი და ვიზიტის დაჯავშნა']:['Everything in Free','Repeating symptom analysis','Doctor-ready reports','Additional pregnancy tracking','Consent-based partner sharing','Chat and booking with available doctors']).map(item=><li key={item}>{item}</li>)}</ul><p>{ka?'ექიმების ხელმისაწვდომობა ცალკე მოწმდება; გადახდა ჯერ მხოლოდ სატესტოა.':'Doctor availability is checked separately; payments remain test-only.'}</p></article></div></section>
  </section>;
}
