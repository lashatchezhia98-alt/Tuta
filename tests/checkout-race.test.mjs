import test from "node:test";
import assert from "node:assert/strict";
import { sourceModule } from "./source-loader.mjs";
test("web checkout discards an old account response, including A → B → A", async () => {
  const states = [],
    effects = [];
  let cursor = 0,
    account = "A",
    authChanged,
    complete,
    assigned = null;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [
        states[i],
        (v) => {
          states[i] = typeof v === "function" ? v(states[i]) : v;
        },
      ];
    },
    useRef(initial) {
      return (states[cursor++] ??= { current: initial });
    },
    useEffect(fn) {
      effects.push(fn);
    },
    useMemo: (fn) => fn(),
  };
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: account }, access_token: account } },
      }),
      onAuthStateChange(cb) {
        authChanged = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  const saved = {
    fetch: globalThis.fetch,
    window: globalThis.window,
    storage: globalThis.localStorage,
  };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.window = {
    location: {
      assign(url) {
        assigned = url;
      },
    },
  };
  globalThis.fetch = async (path) =>
    path === "/api/market/products"
      ? { ok: true, json: async () => ({ products: [] }) }
      : new Promise((resolve) => {
          complete = () =>
            resolve({
              ok: true,
              json: async () => ({
                checkoutUrl: "https://pay.flitt.com/checkout/A",
              }),
            });
        });
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  let cleanup;
  try {
    const Component = sourceModule("components/marketplace.tsx", {
      react,
      "@/lib/supabase-browser": { getSupabaseBrowserClient: () => client },
    }).default;
    const render = () => {
      cursor = 0;
      return Component({ lang: "en" });
    };
    render();
    cleanup = effects[0]();
    await tick();
    states[3] = [{ product: { id: "test", price_tetri: 499 }, quantity: 1 }];
    states[4] = "Recipient A";
    states[5] = "Address A";
    states[7] = true;
    function pay(node) {
      if (!node || typeof node !== "object") return null;
      if (node.props?.className === "market-pay-button") return node;
      return [node.props?.children].flat(Infinity).map(pay).find(Boolean);
    }
    pay(render()).props.onClick();
    await tick();
    assert.equal(typeof complete, "function");
    account = "B";
    authChanged("SIGNED_IN", { user: { id: account } });
    account = "A";
    authChanged("SIGNED_IN", { user: { id: account } });
    complete();
    await tick();
    assert.equal(assigned, null);
    assert.equal(states[4], "");
    assert.equal(states[5], "");
    assert.equal(states[8], false);
  } finally {
    cleanup?.();
    globalThis.fetch = saved.fetch;
    globalThis.window = saved.window;
    globalThis.localStorage = saved.storage;
  }
});
