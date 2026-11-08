import { useEffect, useState } from "react";

export function useMembership(token: string | undefined, root = "") {
  const [state, setState] = useState<{
    token: string;
    active: boolean | null;
    error: boolean;
  }>({ token: "", active: null, error: false });
  useEffect(() => {
    if (!token) return;
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      const current = controller;
      return fetch(`${root}/api/payments/flitt/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: current.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw Error();
          const body = await response.json();
          if (!current.signal.aborted)
            setState({
              token,
              active:
                body.active === true &&
                Boolean(
                  body.expiresAt && Date.parse(body.expiresAt) > Date.now(),
                ),
              error: false,
            });
        })
        .catch(() => {
          if (!current.signal.aborted)
            setState({ token, active: null, error: true });
        });
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [token, root]);
  return state.token === token ? state : { active: null, error: false };
}
