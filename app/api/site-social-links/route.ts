import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { EMPTY_SOCIAL_LINKS, parseSocialLinks } from "@/lib/site-social-links";

export const dynamic = "force-dynamic";

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}.supabase.co`;
  return createClient(normalizedUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const supabase = publicSupabase();
  if (!supabase) return NextResponse.json({ links: EMPTY_SOCIAL_LINKS }, { headers: { "Cache-Control": "no-store" } });
  const { data, error } = await supabase.from("site_settings").select("features").eq("id", "global").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load social links." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const { links } = parseSocialLinks(data?.features && typeof data.features === "object" ? (data.features as Record<string, unknown>).socialLinks : null);
  return NextResponse.json({ links }, { headers: { "Cache-Control": "no-store" } });
}
