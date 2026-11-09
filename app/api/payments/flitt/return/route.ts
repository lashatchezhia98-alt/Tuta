import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { paymentReturnLink, validPaymentOrder } from "@/mobile/src/payment-return.mjs";

export const dynamic = "force-dynamic";

// A browser return is navigation only. It never changes payment status.
function respond(request: Request) {
  const incoming = new URL(request.url);
  const kind = incoming.searchParams.get("type") === "market" ? "market" : "premium";
  const order = incoming.searchParams.get("order");
  const app = incoming.searchParams.get("client") === "app";
  const web = new URL(kind === "market" ? "/market/orders" : "/premium", incoming.origin);
  web.searchParams.set("payment", "returned");
  if (kind === "market" && order && validPaymentOrder(kind, order)) {
    web.searchParams.set("order", order);
  }
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  if (!app) return NextResponse.redirect(web, { status: 303, headers });
  if (request.method === "POST") {
    const target = new URL(incoming.pathname, incoming.origin);
    target.searchParams.set("client", "app");
    target.searchParams.set("type", kind);
    if (order && validPaymentOrder(kind, order)) target.searchParams.set("order", order);
    return NextResponse.redirect(target, { status: 303, headers });
  }

  // Only fixed paths and validated UUIDs can reach the HTML or the deep link.
  const link = paymentReturnLink(kind, order);
  const website = (web.pathname + web.search).replaceAll("&", "&amp;");
  const nonce = randomBytes(16).toString("base64");
  return new Response(`<!doctype html>
<html lang="ka">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>თუთა · გადახდიდან დაბრუნება</title>
<style>
  *{box-sizing:border-box}body{margin:0;padding:24px;background:#f9f8fc;color:#1e1b2e;font:16px/1.65 system-ui,sans-serif}
  main{max-width:440px;margin:12vh auto 0;padding:28px;border:1px solid #e3d8f1;border-radius:20px;background:white}
  h1{font-size:24px;line-height:1.4;margin:12px 0}a{display:block;padding:12px;margin-top:12px;text-align:center;border-radius:10px;color:#1e1b2e}
  a.primary{background:#1e1b2e;color:white;font-weight:700;text-decoration:none}
</style>
<main>
  <strong>თუთა · Tuta</strong>
  <h1>გადახდიდან დაბრუნება</h1>
  <p>გადახდის სტატუსი თუთაში შეამოწმე.</p>
  <a id="open-tuta" class="primary" href="${link}">თუთაში დაბრუნება <span lang="en">/ Open Tuta</span></a>
  <a href="${website}">გაგრძელება ვებსაიტზე <span lang="en">/ Continue on the website</span></a>
</main>
<script nonce="${nonce}">window.location.href=document.getElementById("open-tuta").href;</script>
</html>`, {
    headers: {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const GET = respond;
export const POST = respond;
