import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api } from "./api";
// Unmount/account-key cleanup invalidates every pending private response.
export function useResource<T>(path: string, userId?: string, poll = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const turn = ++sequence.current;
    setLoading(true);
    try {
      const value = await api<T>(path, { userId });
      if (turn === sequence.current) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (turn === sequence.current)
        setError(e instanceof Error ? e.message : "Connection unavailable");
    } finally {
      if (turn === sequence.current) setLoading(false);
    }
  }, [path, userId]);
  useEffect(() => {
    setData(null);
    void refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const timer = poll
      ? setInterval(() => {
          if (AppState.currentState === "active") void refresh();
        }, poll)
      : undefined;
    return () => {
      sequence.current++;
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [refresh, poll]);
  return { data, error, loading, refresh };
}
