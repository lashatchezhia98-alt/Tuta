"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { activityReadEvent } from "@/mobile/src/activity.mjs";

export function useActivityCount(owner: string | null, pathname: string) {
  const [snapshot, setSnapshot] = useState<{ owner: string; count: number }>();
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    let sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const { count, error } = await getSupabaseBrowserClient().from("activity_notifications")
          .select("id", { count: "exact", head: true }).eq("user_id", owner!)
          .is("read_at", null).abortSignal(controller.signal);
        if (!error && !controller.signal.aborted && request === sequence) setSnapshot({ owner: owner!, count: count ?? 0 });
      } catch {
        // Keep the last confirmed count while offline.
      }
    }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(activityReadEvent, refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(activityReadEvent, refresh);
    };
  }, [owner, pathname]);
  return snapshot?.owner === owner ? snapshot.count : 0;
}
