import { isSameOrigin, readAdminJson } from "@/lib/admin-request";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";
import { defaultSiteFeatures, SITE_FEATURES, type SiteFeatureSettings } from "@/lib/site-feature-definitions";

export const dynamic = "force-dynamic";

function getSupabase(admin = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = admin
    ? process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}.supabase.co`;
  return createClient(normalizedUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase feature settings are not configured." }, { status: 503 });
  const { data, error } = await supabase.from("site_settings").select("features").eq("id", "global").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load shared feature settings." }, { status: 503 });
  return NextResponse.json({ features: { ...defaultSiteFeatures(), ...(data?.features || {}) } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const cookieStore = await cookies();
  const authenticated = await verifyAdminSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!authenticated) return NextResponse.json({ error: "ადმინის შესვლა ხელახლა გაიარე." }, { status: 401 });

  const supabase = getSupabase(true);
  if (!supabase) return NextResponse.json({ error: "სერვერის Supabase გასაღები ჯერ დაყენებული არ არის." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await readAdminJson(request);
  } catch {
    return NextResponse.json({ error: "მოთხოვნის მონაცემები არასწორია." }, { status: 400 });
  }
  const feature = SITE_FEATURES.find(item => item.id === body.id);
  if (!feature || typeof body.enabled !== "boolean") return NextResponse.json({ error: "ფუნქციის პარამეტრი არასწორია." }, { status: 400 });

  const { data: current, error: readError } = await supabase.from("site_settings").select("features").eq("id", "global").maybeSingle();
  if (readError) return NextResponse.json({ error: "ჯერ Supabase-ის მონაცემთა ბაზის განახლება უნდა შესრულდეს." }, { status: 503 });
  const features = { ...defaultSiteFeatures(), ...((current?.features || {}) as Partial<SiteFeatureSettings>), [feature.id]: body.enabled };
  const { error } = await supabase.from("site_settings").upsert({ id: "global", features, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "პარამეტრის შენახვა ვერ მოხერხდა." }, { status: 503 });
  return NextResponse.json({ features });
}
