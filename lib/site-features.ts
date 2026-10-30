"use client";

import { useEffect, useState } from "react";
import { defaultSiteFeatures, type SiteFeatureId, type SiteFeatureSettings } from "@/lib/site-feature-definitions";

export { SITE_FEATURES, featureForRoute } from "@/lib/site-feature-definitions";
export type { SiteFeatureId, SiteFeatureSettings } from "@/lib/site-feature-definitions";

let cachedSettings: SiteFeatureSettings = defaultSiteFeatures();
let loaded = false;
let pending: Promise<void> | undefined;
const CHANGE_EVENT = "tuta-site-features-changed";

async function loadSiteFeatures() {
  if (pending) return pending;
  pending = fetch("/api/site-features", { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("Feature settings are unavailable.");
      const body = await response.json() as { features?: Partial<SiteFeatureSettings> };
      cachedSettings = { ...defaultSiteFeatures(), ...body.features };
      loaded = true;
      window.dispatchEvent(new Event(CHANGE_EVENT));
    })
    .catch(() => {
      loaded = true;
      window.dispatchEvent(new Event(CHANGE_EVENT));
    })
    .finally(() => { pending = undefined; });
  return pending;
}

export function useSiteFeatures() {
  const [features, setFeatures] = useState(cachedSettings);
  useEffect(() => {
    const refresh = () => setFeatures(cachedSettings);
    window.addEventListener(CHANGE_EVENT, refresh);
    if (!loaded) void loadSiteFeatures();
    return () => window.removeEventListener(CHANGE_EVENT, refresh);
  }, []);
  return features;
}

export async function setSiteFeature(id: SiteFeatureId, enabled: boolean) {
  const response = await fetch("/api/site-features", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, enabled }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "Could not save feature settings.");
  }
  const body = await response.json() as { features: Partial<SiteFeatureSettings> };
  cachedSettings = { ...defaultSiteFeatures(), ...body.features };
  loaded = true;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
