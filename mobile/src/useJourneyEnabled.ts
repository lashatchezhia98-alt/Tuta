import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Visibility is shared with the web admin; never send health records here.
export function useFeatureEnabled(feature:string,active = true) {
  const [status,setStatus] = useState<'loading'|'enabled'|'disabled'|'error'>('loading');
  const [attempt,setAttempt] = useState(0);
  useEffect(()=>{
    if (!active) return;
    let alive = true;
    let controller: AbortController | undefined;
    const load = async () => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(()=>current.abort(),10000);
      try {
        const root = process.env.EXPO_PUBLIC_TUTA_API_URL?.trim().replace(/\/$/,'') || 'https://tutahealth.ge';
        const response = await fetch(`${root}/api/site-features`,{signal:current.signal});
        if (!response.ok) throw new Error('Feature settings unavailable');
        const body = await response.json();
        if (alive && current === controller) setStatus(body.features?.[feature] === true ? 'enabled' : 'disabled');
      } catch {
        if (alive && current === controller) setStatus('error');
      } finally { clearTimeout(timeout); }
    };
    void load();
    const subscription = AppState.addEventListener('change',state=>{if(state==='active')void load()});
    return ()=>{alive=false;controller?.abort();subscription.remove()};
  },[active,attempt,feature]);
  return {status,retry:()=>setAttempt(value=>value+1)};
}
export function useJourneyEnabled(active=true){return useFeatureEnabled('journey',active)}
