"use client";
import { SiteCopyText } from "@/components/site-copy-provider";


import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useMembership } from "@/lib/use-membership";

type Lang = "ka" | "en";
type Plan = "monthly" | "yearly";

export default function PremiumCheckout({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [autoRenew, setAutoRenew] = useState(false);
  const [notice, setNotice] = useState("");
  const {active,expiresAt,paidUntil,purchaseBlocked,renewalState,canResume,refresh,status}=useMembership();
  const epoch = useRef(0);
  const working = useRef(false);
  const account = useRef<string | null>(null);

  useEffect(() => {
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
        const id = session?.user.id ?? null;
        if (id !== account.current) {
          account.current = id;
          epoch.current++;
          setAutoRenew(false);
          setNotice("");
        }
      });
      return () => { epoch.current++; subscription.unsubscribe(); };
    } catch { /* Status reports configuration failures. */ }
  }, []);

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
    if (working.current || purchaseBlocked) return;
    working.current = true;
    const current = epoch.current;
    setBusy(true);
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (current !== epoch.current) return;
      if (!session?.access_token) {
        setNotice(ka ? "Premium-ის სატესტოდ შესვლა ან რეგისტრაციაა საჭირო." : "Sign in or create an account to test Premium checkout.");
        return;
      }
      const response = await fetch("/api/payments/flitt/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan, autoRenew }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (current !== epoch.current) return;
      if (!response.ok || !data.checkoutUrl) {
        if (response.status === 409) void refresh();
        throw new Error(data.error || "Checkout could not start.");
      }
      window.location.assign(data.checkoutUrl);
    } catch (cause) {
      if (current === epoch.current) setNotice(cause instanceof Error ? cause.message : ka ? "გადახდის დაწყება ვერ მოხერხდა." : "Could not start checkout.");
    } finally {
      setBusy(false);
      working.current = false;
    }
  }

  async function changeRenewal(enabled: boolean) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setNotice("");
    const current = epoch.current;
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session || current !== epoch.current) return;
      const response = await fetch("/api/payments/flitt/status", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json() as { renewalState?: string; error?: string };
      if (current !== epoch.current) return;
      if (!response.ok || data.renewalState !== (enabled ? "active" : "disabled")) throw new Error(data.error || "Flitt did not confirm the change.");
      setNotice(enabled ? (ka ? "ავტომატური განახლება ჩაირთო." : "Automatic renewal is on.") : (ka ? "ავტომატური განახლება გაითიშა. გადახდილი პერიოდი ძალაში რჩება." : "Automatic renewal is off. Your paid access remains available."));
    } catch (cause) {
      if (current === epoch.current) setNotice(cause instanceof Error ? cause.message : ka ? "ცვლილება ვერ დადასტურდა." : "Could not confirm the change.");
    } finally {
      if (current === epoch.current) await refresh();
      working.current = false;
      setBusy(false);
    }
  }

  const dateText = expiresAt
    ? new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", { dateStyle: "long" }).format(new Date(expiresAt))
    : "";
  const paidDate = paidUntil ? new Intl.DateTimeFormat(ka ? "ka-GE" : "en-GB", { dateStyle: "long" }).format(new Date(paidUntil)) : "";
  const renewalPending = renewalState === "starting" || renewalState === "stopping";

  return <section className="inner-container premium-checkout">
    <div className="premium-checkout-card">
      <div className="premium-checkout-copy">
        <span className="inner-kicker"><SiteCopyText id="premium.testMode" lang={lang}/></span>
        <h2><SiteCopyText id="premium.heading" lang={lang}/></h2>
        <p><SiteCopyText id="premium.instructions" lang={lang}/></p>
        {!purchaseBlocked && <><div className="premium-plan-options" role="group" aria-label={ka ? "Premium პაკეტის არჩევა" : "Choose a Premium plan"}>
          <button type="button" className={plan === "monthly" ? "selected" : ""} aria-pressed={plan === "monthly"} onClick={() => setPlan("monthly")}>
            <strong>4.99 ₾</strong><span><SiteCopyText id="premium.monthly" lang={lang}/></span>
          </button>
          <button type="button" className={plan === "yearly" ? "selected" : ""} aria-pressed={plan === "yearly"} onClick={() => setPlan("yearly")}>
            <strong>49.90 ₾</strong><span><SiteCopyText id="premium.yearly" lang={lang}/></span><em><SiteCopyText id="premium.annualOffer" lang={lang}/></em>
          </button>
        </div>
        <div className="premium-price"><strong>{plan === "yearly" ? "49.90 ₾" : "4.99 ₾"}</strong><span>{plan === "yearly" ? (ka ? "/ წელი" : "/ year") : (ka ? "/ 30 დღე" : "/ 30 days")}</span></div>
        <label className="premium-status-button"><input type="checkbox" checked={autoRenew} disabled={busy} onChange={e => setAutoRenew(e.target.checked)}/> {ka ? "ამ სატესტო გამოწერის ავტომატური განახლება" : "Automatically renew this test subscription"}</label>
        {autoRenew && <p>{ka ? "იგივე საფასური პერიოდულად განმეორდება სატესტო რეჟიმში, თუ განახლებას არ გამორთავ." : "The same test payment repeats each period unless you turn off renewal."}</p>}
        <button className="premium-pay-button" type="button" disabled={busy || status === "loading" || status === "error"} onClick={() => void startCheckout()}>
          {busy ? (ka ? "მზადდება…" : "Preparing…") : (<SiteCopyText id="premium.pay" lang={lang}/>)}
        </button></>}
        {purchaseBlocked && <p className="premium-active">{paidDate && paidUntil && Date.parse(paidUntil) > Date.now()
          ? (ka ? `ეს პერიოდი უკვე გადახდილია (${paidDate}-მდე).` : `This period is already paid (until ${paidDate}).`)
          : (ka ? "ახალი შეძენა დაბლოკილია, სანამ ავტომატური განახლება მოქმედებს ან მოწმდება." : "A new purchase is blocked while automatic renewal is active or being checked.")}</p>}
        {renewalState && <section aria-label={ka ? "ავტომატური განახლება" : "Automatic renewal"}>
          <p>{renewalPending ? (ka ? "განახლების ცვლილება მოწმდება." : "Renewal change is being verified.")
            : renewalState === "active" ? (ka ? "ავტომატური განახლება ჩართულია." : "Automatic renewal is on.")
            : (ka ? "ავტომატური განახლება გამორთულია." : "Automatic renewal is off.")}</p>
          {(renewalState !== "disabled" || canResume) && <button className="premium-status-button" type="button" disabled={busy} onClick={() => void changeRenewal(renewalState === "disabled" || renewalState === "starting")}>
            {renewalPending ? (ka ? "ცვლილების ხელახლა შემოწმება" : "Retry the change") : renewalState === "active" ? (ka ? "ავტომატური განახლების გათიშვა" : "Turn off automatic renewal") : (ka ? "ავტომატური განახლების ჩართვა" : "Turn on automatic renewal")}
          </button>}
        </section>}
        {purchaseBlocked && !renewalState && <p>{ka ? "ერთჯერადი გადახდა არ განახლდება. ავტომატური განახლების არჩევას ვადის გასვლის შემდეგ, ახალი გამოწერისას შეძლებ." : "One-time payments do not renew. Choose automatic renewal when you subscribe again after expiry."}</p>}
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
  </section>;
}
