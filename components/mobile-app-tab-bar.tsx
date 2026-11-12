"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, LayoutGrid, Store, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type Language = "ka" | "en";

const tabs = [
  { id: "home", href: "/", icon: House, ka: "მთავარი", en: "Home" },
  {
    id: "cycle",
    href: "/app/dashboard",
    icon: CalendarDays,
    ka: "პერიოდი",
    en: "Period",
  },
  {
    id: "services",
    href: "/app/features",
    icon: LayoutGrid,
    ka: "სერვისები",
    en: "Services",
  },
  { id: "market", href: "/market", icon: Store, ka: "მარკეტი", en: "Market" },
  {
    id: "profile",
    href: "/app/settings",
    icon: UserRound,
    ka: "პროფილი",
    en: "Profile",
  },
];

const hiddenRoutes = [
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

function activeTab(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/community")) return "home";
  if (pathname.startsWith("/market")) return "market";
  if (
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
    pathname.startsWith("/market/orders")
  )
    return "profile";
  return "services";
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
      {tabs.map(({ id, href, icon: Icon, ka, en }) => {
        const active = selected === id;
        return (
          <Link
            key={id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`mobile-app-tab${active ? " is-active" : ""}`}
          >
            <span className="mobile-app-tab-icon">
              <Icon aria-hidden="true" />
            </span>
            <span className="mobile-app-tab-label">{language === "ka" ? ka : en}</span>
          </Link>
        );
      })}
    </nav>
  );
}
