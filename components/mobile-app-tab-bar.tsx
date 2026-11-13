"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Language = "ka" | "en";

const tabs = [
  {
    id: "cycle",
    href: "/app/dashboard",
    ka: "პერიოდი",
    en: "Period",
  },
  { id: "home", href: "/community", ka: "საზოგადოება", en: "Community" },
  { id: "market", href: "/market", ka: "მარკეტი", en: "Market" },
  {
    id: "profile",
    href: "/app/settings",
    ka: "პროფილი",
    en: "Profile",
  },
];

function TabIcon({ id }: { id: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    {id === "cycle" ? <path fill="currentColor" d="M15.8 2.9a9.1 9.1 0 1 0 5.3 14.2A8.1 8.1 0 0 1 15.8 2.9ZM18.5 6.5c1 1.6 2.7 3.3 2.7 4.8a2.7 2.7 0 0 1-5.4 0c0-1.5 1.7-3.2 2.7-4.8Z" />
      : id === "home" ? <path fill="currentColor" d="M11 5l1.8 4.2L17 11l-4.2 1.8L11 17l-1.8-4.2L5 11l4.2-1.8L11 5ZM4 1l.9 2.1L7 4l-2.1.9L4 7l-.9-2.1L1 4l2.1-.9L4 1ZM19 1l1.1 2.9L23 5l-2.9 1.1L19 9l-1.1-2.9L15 5l2.9-1.1L19 1ZM4 14l1 2.5L7.5 17.5l-2.5 1L4 21l-1-2.5-2.5-1 2.5-1L4 14ZM19 13l1.2 3.3L23.5 17.5l-3.3 1.2L19 22l-1.2-3.3-3.3-1.2 3.3-1.2L19 13ZM11 18l.7 1.8 1.8.7-1.8.7L11 23l-.7-1.8-1.8-.7 1.8-.7L11 18Z" />
      : <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d={id === "market"
        ? "M3 4h18l-2 6H5ZM5 10v11h14V10M9 21v-7h6v7"
        : "M4 21v-3c0-6 16-6 16 0v3M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"} />}
  </svg>;
}

const hiddenRoutes = [
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function activeTab(pathname: string) {
  if (pathname.startsWith("/community")) return "home";
  if (pathname.startsWith("/market/orders")) return "profile";
  if (pathname.startsWith("/market")) return "market";
  if (
    pathname === "/" ||
    pathname.startsWith("/app/dashboard") ||
    pathname.startsWith("/app/log") ||
    pathname.startsWith("/app/insights") ||
    pathname.startsWith("/app/calendar") ||
    pathname.startsWith("/app/history")
  )
    return "cycle";
  if (
    pathname.startsWith("/app/settings") ||
    pathname.startsWith("/app/notifications") ||
    pathname.startsWith("/app/profile")
  )
    return "profile";
  return null;
}

export default function MobileAppTabBar() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("ka");

  useEffect(() => {
    const syncLanguage = () =>
      setLanguage(localStorage.getItem("tuta-language") === "en" ? "en" : "ka");
    syncLanguage();
    const observer = new MutationObserver(syncLanguage);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    window.addEventListener("storage", syncLanguage);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  if (hiddenRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)))
    return null;

  const selected = activeTab(pathname);
  return (
    <nav
      className="mobile-app-tabbar"
      aria-label={language === "ka" ? "ძირითადი ნავიგაცია" : "Primary navigation"}
    >
      {tabs.map(({ id, href, ka, en }) => {
        const active = selected === id;
        return (
          <Link
            key={id}
            href={href}
            aria-label={language === "ka" ? ka : en}
            aria-current={active ? "page" : undefined}
            className={`mobile-app-tab${active ? " is-active" : ""}`}
          >
            <span className="mobile-app-tab-icon">
              <TabIcon id={id} />
            </span>
            {id !== "home" && <span className="mobile-app-tab-label">{language === "ka" ? ka : en}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
