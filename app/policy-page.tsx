"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import HeaderActions from "@/components/header-actions";
import ChangePassword from "@/components/change-password";

import { SiteCopyText } from "@/components/site-copy-provider";

type Lang = "ka" | "en";
type Kind = "privacy" | "terms";

import { policyCopy as copy } from "@/lib/site-copy-defaults";

export function PolicyPage({ kind }: { kind: Kind }) {
  const [lang, setLang] = useState<Lang>("ka");
  useEffect(() => {
    if (localStorage.getItem("tuta-language") === "en")
      queueMicrotask(() => setLang("en"));
  }, []);
  const change = (next: Lang) => {
    setLang(next);
    localStorage.setItem("tuta-language", next);
    document.documentElement.lang = next;
  };
  const text = copy[kind][lang];
  return (
    <main className="min-h-screen bg-[#F9F8FC] px-5 py-6 text-[#1E1B2E] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inner-logo">
            <BrandMark />
            <strong><SiteCopyText id="nav.brand" lang={lang}/></strong>
          </Link>
          <HeaderActions lang={lang} setLang={change} />
        </header>
        <p className="mt-6">
          <Link href={kind === "privacy" ? "/terms" : "/privacy"}>
            {kind === "privacy"
              ? lang === "ka"
                ? "წესები და პირობები"
                : "Terms of use"
              : lang === "ka"
                ? "კონფიდენციალურობა"
                : "Privacy"}
          </Link>
        </p>
        <div className="mt-12 rounded-[30px] bg-[#E3D8F1] p-7 sm:mt-16 sm:p-10">
          <p className="text-xs font-semibold tracking-[.18em]">TUTA</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
            <SiteCopyText id={`policy.${kind}.title`} lang={lang}/>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7"><SiteCopyText id={`policy.${kind}.intro`} lang={lang}/></p>
        </div>
        {kind === "privacy" && <ChangePassword lang={lang}/>}
        <div className="mt-6 grid gap-4">
          {text.sections.map(([heading], index) => (
            <section
              key={heading}
              className="rounded-3xl border border-[#1E1B2E]/10 bg-white p-6 sm:p-8"
            >
              <h2 className="text-xl font-semibold leading-snug"><SiteCopyText id={`policy.${kind}.sections.${index}.0`} lang={lang}/></h2>
              <p className="mt-3 text-base leading-7 text-[#514B5F]"><SiteCopyText id={`policy.${kind}.sections.${index}.1`} lang={lang}/></p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
