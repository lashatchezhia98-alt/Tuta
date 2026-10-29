import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: cors });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(request: Request) {
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") || "")?.[1];
  if (!token) return reply({ error: "Sign in is required." }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!url || !key || !cloudName || !apiKey || !apiSecret) {
    return reply({ error: "Community photo uploads are not configured." }, 503);
  }

  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await auth.auth.getUser(token);
  if (error || !user || user.is_anonymous) return reply({ error: "Sign in is required." }, 401);

  const anonymous = (await request.json().catch(() => ({})))?.anonymous === true;
  const publicId = `tuta-community/${anonymous ? "anon" : user.id}/${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  return reply({ cloudName, apiKey, publicId, timestamp, signature });
}
