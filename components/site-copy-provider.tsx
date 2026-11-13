"use client";

import { createContext, useContext, useEffect, useState, type Context, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { emptyCopy, getCopyText, type CopyLanguage, type CopyOverrides } from "@/lib/site-copy";
import { copyFromPublishedRows, emptyTextStyles, mergePublishedContent, normalizeTextStyle, validateWebsiteCopy, type WebsiteTextStyles } from "@/lib/website-content";

type CopyState = { copy: CopyOverrides; styles: WebsiteTextStyles; preview: CopyLanguage | null; loadError: boolean };
const initial: CopyState = { copy: emptyCopy(), styles: emptyTextStyles(), preview: null, loadError: false };
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
        const styles = event.data.styles && typeof event.data.styles === "object" ? event.data.styles : emptyTextStyles();
        setState({ copy: validateWebsiteCopy(event.data.copy), styles, preview, loadError: false });
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
      void fetch("/api/site-content", { cache: "no-store", signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error("content_unavailable");
          const body = await response.json();
          const rows = Array.isArray(body.records) ? body.records : [];
          const structured = copyFromPublishedRows(rows);
          const content = mergePublishedContent(validateWebsiteCopy(body.legacyCopy), structured.copy, emptyTextStyles(), structured.styles);
          if (!controller.signal.aborted) setState({ copy: content.copy, styles: content.styles, preview: null, loadError: false });
        }).catch(() => { if (!controller.signal.aborted) setState(current => ({ ...current, loadError: true })); });
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("tuta:website-copy-saved", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("tuta:website-copy-saved", refresh); };
  }, [pathname]);
  const CopyContext = copyContext();
  return <CopyContext.Provider value={state}>{state.loadError && !state.preview && !pathname.startsWith("/admin") && <div className="site-content-load-error" role="status">{typeof document !== "undefined" && document.documentElement.lang.startsWith("en") ? "Some website text could not be refreshed. Showing the built-in text." : "საიტის ზოგი ტექსტი ვერ განახლდა. ნაჩვენებია ჩაშენებული ტექსტი."}</div>}{children}</CopyContext.Provider>;
}

export function useSiteCopyText(id: string, lang: CopyLanguage) {
  const { copy, preview } = useContext(copyContext());
  return getCopyText(copy, id, preview ?? lang);
}

export function SiteCopyText({ id, lang }: { id: string; lang: CopyLanguage }) {
  const { copy, styles, preview } = useContext(copyContext());
  const activeLanguage = preview ?? lang;
  const value = getCopyText(copy, id, activeLanguage);
  const style = normalizeTextStyle(styles[activeLanguage]?.[id]);
  const styleProps: CSSProperties = style ? { fontSize: `${style.fontSize}px`, color: style.color } : {};
  return <span className={preview ? "site-copy-preview-text" : undefined} data-site-copy={id} lang={activeLanguage} style={styleProps}>{value}</span>;
}
