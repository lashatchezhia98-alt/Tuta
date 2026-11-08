import { useCallback, useEffect, useRef, useState } from "react";
import { pruneChatPage } from "./chat-retention.mjs";
export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type ChatResponse = { messages: ChatMessage[]; serverNow: string };
type Page = ChatResponse & { receivedAt: number; scope: string };
// Memory only: no localStorage, AsyncStorage, export, or offline chat archive.
export function useChatMessages(
  scope: string,
  load: () => Promise<ChatResponse>,
) {
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!scope) return;
    const turn = ++sequence.current;
    setLoading(true);
    try {
      const response = await load();
      if (turn !== sequence.current) return;
      setPage(
        pruneChatPage(
          { ...response, receivedAt: performance.now(), scope },
          performance.now(),
        ),
      );
      setError("");
    } catch (e) {
      if (turn === sequence.current)
        setError(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      if (turn === sequence.current) setLoading(false);
    }
  }, [scope, load]);
  useEffect(() => {
    const requests = sequence;
    const initial = setTimeout(() => {
      setPage(null);
      setError("");
      void refresh();
    }, 0);
    const expiry = setInterval(
      () => setPage((current) => pruneChatPage(current, performance.now())),
      1000,
    );
    const poll = setInterval(() => void refresh(), 15000);
    return () => {
      requests.current++;
      clearTimeout(initial);
      clearInterval(expiry);
      clearInterval(poll);
    };
  }, [refresh]);
  const current: Page | null = page?.scope === scope ? page : null;
  return {
    data: current,
    messages: current?.messages || [],
    error,
    loading,
    refresh,
  };
}
