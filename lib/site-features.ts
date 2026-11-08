"use client";

import { useEffect, useSyncExternalStore } from "react";
import { defaultSiteFeatures, type SiteFeatureId, type SiteFeatureSettings } from "@/lib/site-feature-definitions";

export { SITE_FEATURES, featureForRoute } from "@/lib/site-feature-definitions";
export type { SiteFeatureId, SiteFeatureSettings } from "@/lib/site-feature-definitions";

const closedSettings = () => Object.fromEntries(Object.keys(defaultSiteFeatures()).map(key=>[key,false])) as SiteFeatureSettings;
const initialSettings=closedSettings();
let cachedSettings: SiteFeatureSettings = initialSettings;
let loaded = false;
let status:'loading'|'ready'|'error'='loading';
let pending: Promise<void> | undefined;
let settingsRevision=0;
const CHANGE_EVENT = "tuta-site-features-changed";

async function loadSiteFeatures() {
  if (pending) return pending;
  const revision=settingsRevision;
  pending = fetch("/api/site-features", { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("Feature settings are unavailable.");
      const body = await response.json() as { features?: Partial<SiteFeatureSettings> };
      if(revision!==settingsRevision)return;
      cachedSettings = { ...defaultSiteFeatures(), ...body.features };
      loaded = true;
      status='ready';
      window.dispatchEvent(new Event(CHANGE_EVENT));
    })
    .catch(() => {
      if(revision!==settingsRevision)return;
      // Do not expose disabled sections when the settings request fails.
      loaded = false;
      status='error';
      window.dispatchEvent(new Event(CHANGE_EVENT));
    })
    .finally(() => { pending = undefined; });
  return pending;
}

const subscribe=(refresh:()=>void)=>{window.addEventListener(CHANGE_EVENT,refresh);return()=>window.removeEventListener(CHANGE_EVENT,refresh)};
let monitorUsers=0,stopMonitor:(()=>void)|undefined;
function monitor(){
  if(++monitorUsers===1){
    const reload=()=>{if(document.visibilityState==='visible')void loadSiteFeatures()};
    const timer=window.setInterval(reload,15000);
    window.addEventListener('focus',reload);window.addEventListener('storage',reload);
    if(!loaded)void loadSiteFeatures();
    stopMonitor=()=>{window.clearInterval(timer);window.removeEventListener('focus',reload);window.removeEventListener('storage',reload)};
  }
  return()=>{if(--monitorUsers===0){stopMonitor?.();stopMonitor=undefined}};
}
export function useSiteFeatures() {
  const features=useSyncExternalStore(subscribe,()=>cachedSettings,()=>initialSettings);
  useEffect(monitor,[]);
  return features;
}

export function useSiteFeaturesStatus(){
  return useSyncExternalStore(subscribe,()=>status,()=>'loading' as const);
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
  settingsRevision++;
  cachedSettings = { ...defaultSiteFeatures(), ...body.features };
  loaded = true;
  status='ready';
  window.dispatchEvent(new Event(CHANGE_EVENT));
  try{localStorage.setItem('tuta-features-updated',String(Date.now()))}catch{/* Other tabs refresh periodically. */}
}
