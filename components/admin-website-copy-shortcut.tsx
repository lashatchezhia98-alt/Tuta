"use client";

import { usePathname } from "next/navigation";
import { PencilLine } from "lucide-react";
import { useEffect, useState } from "react";
import InlineWebsiteCopy from "./inline-website-copy";

type Language = "ka" | "en";

const hiddenRoutes = ["/admin"];

export default function AdminWebsiteCopyShortcut() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("ka");
  const [authorizedPath, setAuthorizedPath] = useState<string | null>(null);

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

  useEffect(() => {
    const hidden = hiddenRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    if (hidden) return;

    const controller = new AbortController();
    void fetch("/api/admin/website-copy-access", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (
          data &&
          typeof data === "object" &&
          "authorized" in data &&
          data.authorized === true
        ) {
          setAuthorizedPath(pathname);
        }
      })
      .catch(() => {
        // A missing/expired admin session simply keeps the shortcut hidden.
      });

    return () => controller.abort();
  }, [pathname]);

  const hidden = hiddenRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (hidden || authorizedPath !== pathname) return null;

  return <InlineWebsiteCopy key={pathname} language={language} icon={<PencilLine aria-hidden="true" size={18} strokeWidth={2} />} />;
}
