"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Lang = "ka" | "en";
type Plan = "monthly" | "yearly";

export default function PremiumCheckout({ lang }: { lang: Lang }) {
  const ka = lang === "ka";
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

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
      setActive(Boolean(data.active));
      setExpiresAt(data.expiresAt || null);
      if (showMessage) setNotice(data.active
        ? (ka ? "Premium გააქტიურებულია ✓" : "Premium is active ✓")
        : (ka ? "გადახდა ჯერ არ დადასტურებულა. ცოტა ხანში ხელახლა შეამოწმე." : "Payment is not confirmed yet. Check again shortly."));
    } catch {
      if (showMessage) setNotice(ka ? "სტატუსის შემოწმება ვერ მოხერხდა. სცადე ხელახლა." : "Could not check status. Please try again.");
    }
  }, [ka]);

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
        <span className="inner-kicker">{ka ? "მხოლოდ სატესტო რეჟიმი" : "TEST MODE ONLY"}</span>
        <h2>{ka ? "TUTA Premium" : "TUTA Premium"}</h2>
        <p>{ka ? "აირჩიე პაკეტი. სატესტო გადახდის წარმატებით დასრულებისას Premium ავტომატურად გააქტიურდება." : "Choose a plan. Premium activates after a successful test payment."}</p>
        <div className="premium-plan-options" role="group" aria-label={ka ? "Premium პაკეტის არჩევა" : "Choose a Premium plan"}>
          <button type="button" className={plan === "monthly" ? "selected" : ""} aria-pressed={plan === "monthly"} onClick={() => setPlan("monthly")}>
            <strong>4.99 ₾</strong><span>{ka ? "თვეში · 30 დღე" : "monthly · 30 days"}</span>
          </button>
          <button type="button" className={plan === "yearly" ? "selected" : ""} aria-pressed={plan === "yearly"} onClick={() => setPlan("yearly")}>
            <strong>49.90 ₾</strong><span>{ka ? "წელიწადში · 2 თვე უფასოდ" : "yearly · 2 months free"}</span><em>{ka ? "წლიური შეთავაზება" : "Annual offer"}</em>
          </button>
        </div>
        <div className="premium-price"><strong>{plan === "yearly" ? "49.90 ₾" : "4.99 ₾"}</strong><span>{plan === "yearly" ? (ka ? "/ წელი · ერთჯერადი სატესტო გადახდა" : "/ year · one-time test payment") : (ka ? "/ 30 დღე · ერთჯერადი სატესტო გადახდა" : "/ 30 days · one-time test payment")}</span></div>
        <button className="premium-pay-button" type="button" disabled={busy} onClick={() => void startCheckout()}>
          {busy ? (ka ? "მზადდება…" : "Preparing…") : (ka ? "სატესტო გადახდა" : "Test payment")}
        </button>
        <button className="premium-status-button" type="button" onClick={() => void refreshMembership()}>
          {ka ? "გადახდის სტატუსის შემოწმება" : "Check payment status"}
        </button>
        {active && <p className="premium-active" role="status">{ka ? `Premium აქტიურია ${dateText}-მდე.` : `Premium is active until ${dateText}.`}</p>}
        {notice && <p className="premium-notice" role="status">{notice}</p>}
      </div>
      <aside className="premium-test-note">
        <strong>{ka ? "სატესტო გარემო" : "Sandbox environment"}</strong>
        <p>{ka ? "რეალური თანხა არ ჩამოგეჭრება. გადახდის გვერდზე გამოიყენე Flitt-ის სატესტო ბარათი. ყოველთვიური პაკეტი 30 დღეს, წლიური კი 1 წელს ააქტიურებს." : "No real charge is made. Use a Flitt test card on hosted checkout. Monthly access lasts 30 days; annual access lasts one year."}</p>
        <a href="https://docs.flitt.com/api/testing/" target="_blank" rel="noreferrer">{ka ? "სატესტო ბარათები" : "Test cards"}</a>
      </aside>
    </div>
  </section>;
}
