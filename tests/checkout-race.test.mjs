import test from "node:test";
import assert from "node:assert/strict";
import { sourceModule } from "./source-loader.mjs";

test("Premium and Market return the unsigned Flitt checkout URL without marking an order paid", async () => {
  const flitt = sourceModule("lib/flitt.ts");
  const productId = "12345678-1234-4234-8234-123456789abc";
  const user = { id: "account", email: "do-not-share@example.com" };
  const orders = [];
  const admin = {
    from(table) {
      if (table === "market_products") {
        return { select: () => ({ in: async () => ({
          data: [{ id: productId, name: "Test product", price_tetri: 499, is_active: true }],
        }) }) };
      }
      return { insert: async (order) => { orders.push({ table, ...order }); return {}; } };
    },
  };
  const dependencies = {
    "@/lib/flitt": {
      ...flitt,
      flittEnvironment: () => ({ admin, auth: { auth: { getUser: async () => ({ data: { user } }) } } }),
    },
    "@/lib/platform-server": {
      requireUser: async () => ({ user }),
      requireFeature: async () => {},
      checked: ({ data }) => data,
      failure: (error) => { throw error; },
    },
  };
  const checkoutUrl = "https://pay.flitt.com/merchants/test/index.html?token=fixture";
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://pay.flitt.com/api/checkout/url");
    assert.equal(init.redirect, "error");
    const { request } = JSON.parse(init.body);
    assert.equal(request.signature, flitt.flittSignature(request));
    assert.equal(request.amount, 499);
    assert.equal(request.currency, "GEL");
    assert.equal(request.sender_email, undefined);
    assert.equal(request.address, undefined);
    return Response.json({ response: { checkout_url: checkoutUrl, payment_id: "12345", response_status: "success" } });
  };
  try {
    for (const [path, body] of [
      ["api/payments/flitt/checkout", { plan: "monthly" }],
      ["api/market/checkout", { recipientName: "Test Recipient", address: "Test address", items: [{ productId, quantity: 1 }] }],
    ]) {
      const route = sourceModule(`app/${path}/route.ts`, dependencies);
      const response = await route.POST(new Request(`https://tutahealth.ge/${path}`, {
        method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify(body),
      }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).checkoutUrl, checkoutUrl);
    }
    assert.deepEqual(orders.map(({ table, status, mode }) => [table, status, mode]), [
      ["premium_payments", "pending", "test"], ["market_orders", "pending", "test"],
    ]);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("checkout rejects untrusted URLs, provider errors, and a bad signature when supplied", async () => {
  const flitt = sourceModule("lib/flitt.ts");
  const savedFetch = globalThis.fetch;
  try {
    for (const response of [
      { checkout_url: "https://pay.flitt.com.attacker.test/checkout" },
      { checkout_url: "https://pay.flitt.com:444/checkout" },
      { checkout_url: "https://username@pay.flitt.com/checkout" },
      { checkout_url: "http://pay.flitt.com/checkout" },
      { checkout_url: "not a URL" },
      { checkout_url: "https://pay.flitt.com/checkout", signature: "0".repeat(40) },
      { checkout_url: "https://pay.flitt.com/checkout", response_status: "failure" },
    ]) {
      globalThis.fetch = async () => Response.json({ response: { response_status: "success", ...response } });
      assert.equal(await flitt.createFlittCheckout({}), null);
    }
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test("a sandbox-signed callback cannot approve a payment Flitt still reports as created", async () => {
  const flitt = sourceModule("lib/flitt.ts");
  const order = {
    order_id: "tuta-12345678-1234-4234-8234-123456789abc",
    merchant_id: flitt.FLITT_TEST_MERCHANT_ID,
    currency: "GEL",
    amount: "499",
    payment_id: "12345",
    response_status: "success",
  };
  const payload = { ...order, order_status: "approved" };
  const provider = { ...order, order_status: "created" };
  const route = sourceModule("app/api/payments/flitt/callback/route.ts", {
    "@/lib/flitt": {
      ...flitt,
      flittEnvironment: () => ({ admin: { rpc: () => assert.fail("Unconfirmed payment cannot be applied") } }),
    },
  });
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://pay.flitt.com/api/status/order_id");
    const { request } = JSON.parse(init.body);
    assert.equal(request.order_id, order.order_id);
    assert.equal(request.signature, flitt.flittSignature(request));
    return Response.json({ response: { ...provider, signature: flitt.flittSignature(provider) } });
  };
  try {
    const response = await route.POST(new Request("https://tutahealth.ge/api/payments/flitt/callback", {
      method: "POST",
      body: JSON.stringify({ ...payload, signature: flitt.flittSignature(payload) }),
    }));
    assert.equal(response.status, 409);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

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
