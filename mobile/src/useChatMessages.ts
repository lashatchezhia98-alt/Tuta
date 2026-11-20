import { useCallback, useEffect, useRef, useState } from "react";
import { pruneChatPage } from "./chat-retention.mjs";
export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
};
export type ChatResponse = { messages: ChatMessage[]; serverNow: string; typing?: boolean };
export type ConfirmReceipts = (ids: string[], visible: boolean) => Promise<unknown>;
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
    const poll = setInterval(() => void refresh(), 2500);
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

export function useChatReceipts(scope: string, userId: string | undefined, messages: ChatMessage[], visible: boolean, confirm: ConfirmReceipts) {
  const sent = useRef("");
  const pending = useRef("");
  useEffect(() => {
    if (!scope || !userId) return;
    const ids = messages.filter(message => message.sender_id !== userId && !(visible ? message.read_at : message.delivered_at)).map(message => message.id);
    if (!ids.length) { sent.current = ""; return; }
    const key = JSON.stringify([scope, userId, visible, ids]);
    if (key === sent.current || key === pending.current) return;
    pending.current = key;
    void confirm(ids, visible).then(() => {
      if (pending.current === key) sent.current = key;
    }).catch(() => {
      // Retry on the next successful poll; don't invent a receipt on failure.
    }).finally(() => { if (pending.current === key) pending.current = ""; });
  }, [scope, userId, messages, visible, confirm]);
}
