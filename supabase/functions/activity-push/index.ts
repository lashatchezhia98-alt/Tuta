import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { dispatch } from "./worker.mjs";

async function sameSecret(expected: string, provided: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([expected, provided].map(async (value) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))),
  ));
  return left.reduce((difference, byte, index) => difference | (byte ^ right[index]), 0) === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const secret = Deno.env.get("ACTIVITY_PUSH_WORKER_SECRET");
  const supplied = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!secret || secret.length < 32 || !supplied || supplied.length > 512 || !await sameSecret(secret, supplied))
    return new Response(null, { status: 401 });
  const accessToken = Deno.env.get("ACTIVITY_EXPO_ACCESS_TOKEN");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!accessToken || !key || !url) return new Response(null, { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const count = await dispatch({
      accessToken,
      async rpc(name: string, args?: Record<string, unknown>) {
        const { data, error } = await client.rpc(name, args);
        if (error) throw Error("Push storage unavailable");
        return data;
      },
    });
    return Response.json({ processed: count }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 503 });
  }
});
