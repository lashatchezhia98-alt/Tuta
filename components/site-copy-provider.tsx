"use client";

import { createContext, useContext, useEffect, useState, type Context, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { emptyCopy, getCopyText, validateCopy, type CopyLanguage, type CopyOverrides } from "@/lib/site-copy";

type CopyState = { copy: CopyOverrides; preview: CopyLanguage | null };
const initial: CopyState = { copy: emptyCopy(), preview: null };
let context: Context<CopyState> | undefined;
function copyContext() {
  return context ??= createContext(initial);
}

export function SiteCopyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial);
  const pathname = usePathname();
  useEffect(() => {
    const origin = window.location.origin;
    const preview = new URLSearchParams(window.location.search).get("copyPreview");
    if (window.parent !== window && (preview === "ka" || preview === "en")) {
      const receive = (event: MessageEvent) => {
        if (event.origin !== origin || event.source !== window.parent || event.data?.type !== "tuta:copy-preview:values" || event.data.lang !== preview) return;
        setState({ copy: validateCopy(event.data.copy, false), preview });
      };
      const select = (event: MouseEvent) => {
        if (!(event.target instanceof Element)) return;
        const field = event.target.closest<HTMLElement>("[data-site-copy]")?.dataset.siteCopy;
        const control = event.target.closest("a,button,input,textarea,select");
        if (field || (control && !control.closest(".header-burger,[role=dialog] button[data-state]"))) {
          event.preventDefault();
          event.stopPropagation();
          if (field) window.parent.postMessage({ type: "tuta:copy-preview:select", id: field }, origin);
        }
      };
      window.addEventListener("message", receive);
      document.addEventListener("click", select, true);
      window.parent.postMessage({ type: "tuta:copy-preview:ready" }, origin);
      return () => {
        window.removeEventListener("message", receive);
        document.removeEventListener("click", select, true);
      };
    }
    if (pathname.startsWith("/admin")) return;
    const controller = new AbortController();
    const refresh = () => {
      void fetch("/api/website-copy", { cache: "no-store", signal: controller.signal })
        .then(async response => {
          if (response.ok) {
            const body = await response.json();
            if (!controller.signal.aborted) setState({ copy: validateCopy(body.copy, false), preview: null });
          }
        }).catch(() => {});
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [pathname]);
  const CopyContext = copyContext();
  return <CopyContext.Provider value={state}>{children}</CopyContext.Provider>;
}

export function useSiteCopyText(id: string, lang: CopyLanguage) {
  const { copy, preview } = useContext(copyContext());
  return getCopyText(copy, id, preview ?? lang);
}

export function SiteCopyText({ id, lang }: { id: string; lang: CopyLanguage }) {
  const { copy, preview } = useContext(copyContext());
  const value = getCopyText(copy, id, preview ?? lang);
  return preview ? <span className="site-copy-preview-text" data-site-copy={id} lang={preview}>{value}</span> : value;
}
