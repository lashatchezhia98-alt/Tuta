import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  destinations,
  mainTabs,
  primaryTab,
  pageAllowed,
  visibleDestinations,
} from "../src/navigation.mjs";
import {
  cleanCart,
  changeCart,
  project,
  unproject,
} from "../src/market-model.mjs";
import { sourceModule } from "../../tests/source-loader.mjs";

test("empty status strings never become raw text children of native Views", () => {
  for (const path of [
    "../src/ServiceScreens.tsx",
    "../src/MarketScreens.tsx",
    "../src/HealthFeatureScreens.tsx",
    "../App.tsx",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\{(?:error|message|notice|thread)\s*&&/, path);
  }
});

test("all app destinations have one logical home and only five primary tabs", () => {
  assert.equal(mainTabs.length, 5);
  assert.equal(
    new Set(destinations.map((p) => p.id)).size,
    destinations.length,
  );
  for (const p of destinations) {
    assert.ok(p.ka && p.en && p.icon);
    assert.ok(mainTabs.some((tab) => tab[0] === primaryTab(p.id)));
  }
  for (const id of ["calendar", "log", "insights"])
    assert.equal(primaryTab(id), "cycle");
  for (const id of [
    "care",
    "blog",
    "pregnancy",
    "partners",
    "report",
    "journey",
  ])
    assert.equal(primaryTab(id), "services");
  assert.equal(primaryTab("orders"), "profile");
  assert.equal(primaryTab("cart"), "market");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  for (const id of destinations.map((p) => p.id))
    assert.ok(
      app.includes('"' + id + '"') || app.includes("'" + id + "'"),
      `Missing page ${id}`,
    );
});
test("disabled services hide entry points but never hide cancellation/consent/history", () => {
  assert.equal(pageAllowed("market", {}), false);
  assert.equal(pageAllowed("log", {}), false);
  for (const id of ["care", "partners", "pregnancy", "orders"])
    assert.equal(pageAllowed(id, {}), true);
  assert.deepEqual(visibleDestinations("cycle", {}), []);
  assert.deepEqual(
    visibleDestinations("cycle", { dailyLog: true }).map((p) => p.id),
    ["log"],
  );
  const supported = new Set(destinations.map((p) => p.feature).filter(Boolean));
  for (const key of [
    "community",
    "period",
    "dailyLog",
    "insights",
    "library",
    "premium",
    "doctorConsultation",
    "doctorReport",
    "market",
    "journey",
    "pregnancy",
    "partners",
    "notifications",
    "symptom-checker",
    "account-deletion",
  ])
    assert.ok(supported.has(key));
});
test("cart persistence drops private fields, clamps duplicates and limits 20 product types", () => {
  const rows = cleanCart([
    { id: "one", quantity: 19, address: "private", latitude: 40 },
    { id: "one", quantity: 10 },
    { id: "bad", quantity: -1 },
  ]);
  assert.deepEqual(rows, [{ id: "one", quantity: 20 }]);
  assert.deepEqual(changeCart(rows, "one", 1), rows);
  assert.deepEqual(changeCart(rows, "one", -20), []);
  const full = cleanCart(
    Array.from({ length: 25 }, (_, i) => ({ id: String(i), quantity: 1 })),
  );
  assert.equal(full.length, 20);
  assert.equal(changeCart(full, "new", 1).length, 20);
  assert.deepEqual(cleanCart(null), []);
  assert.deepEqual(cleanCart([{ id: "x", quantity: 1.5 }]), []);
});
test("map pin uses tapped coordinates and project/unproject round trips", () => {
  for (const [latitude, longitude] of [
    [41.7151, 44.8271],
    [0, 0],
    [-33.86, 151.2],
  ]) {
    const p = project(latitude, longitude),
      result = unproject(p.x, p.y);
    assert.ok(Math.abs(result.latitude - latitude) < 0.00001);
    assert.ok(Math.abs(result.longitude - longitude) < 0.00001);
  }
  const code = readFileSync(
    new URL("../src/MarketScreens.tsx", import.meta.url),
    "utf8",
  );
  assert.match(code, /useState<Pin \| null>\(null\)/);
  assert.match(code, /latitude: pin\?\.latitude \?\? null/);
});
test("mobile private API rechecks account identity after a late response", async () => {
  let owner = "A",
    calls = 0;
  const pending = {};
  pending.promise = new Promise((resolve) => (pending.resolve = resolve));
  const previous = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    await pending.promise;
    return { ok: true, json: async () => ({ orders: ["private"] }) };
  };
  const { api } = sourceModule("mobile/src/api.ts", {
    "./supabase": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: {
              session: { user: { id: owner }, access_token: "test-only" },
            },
          }),
        },
      },
    },
  });
  try {
    const load = api("/api/market/orders", { userId: "A" });
    await new Promise((resolve) => setImmediate(resolve));
    owner = "B";
    pending.resolve();
    await assert.rejects(load, /Account changed/);
    await assert.rejects(
      api("/api/market/orders", { userId: "A" }),
      /Account changed/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
  }
});
test("checkout URLs cannot open non-HTTPS destinations or unrelated sites", () => {
  const { checkoutDestination } = sourceModule("mobile/src/api.ts", {
    "./supabase": { supabase: null },
  });
  assert.equal(
    checkoutDestination("https://pay.flitt.com/checkout/123"),
    "https://pay.flitt.com/checkout/123",
  );
  for (const value of [
    "http://pay.flitt.com/checkout",
    "javascript:alert(1)",
    "https://pay.flitt.com.evil.test/x",
    "https://evil.test",
    null,
  ])
    assert.throws(() => checkoutDestination(value));
});
test("private pages reset by account key and health writes reject stale account epochs", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(app, /key=\{session\?\.user.id \|\| ["']guest["']\}/);
  assert.match(
    app,
    /generation !== epoch.current \|\| activeUser.current !== userId/,
  );
  const info = readFileSync(
    new URL("../src/MenuPages.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(!info.includes("Premium is in development"));
  assert.ok(info.includes("Test") || info.includes("test-only"));
});
