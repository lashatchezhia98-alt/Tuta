import { isSameOrigin, readAdminJson } from "@/lib/admin-request";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/platform-server";
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
  const authenticated = await getAdminIdentity();
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

  // Compare-and-swap avoids overwriting another administrator's concurrent edit.
  for (let attempt=0;attempt<5;attempt++) {
    const {data:current,error:readError}=await supabase.from("site_settings").select("features").eq("id","global").maybeSingle();
    if(readError||!current)return NextResponse.json({error:"პარამეტრები ვერ ჩაიტვირთა."},{status:503});
    const features={...defaultSiteFeatures(),...(current.features as Partial<SiteFeatureSettings>),[feature.id]:body.enabled};
    const {data:saved,error}=await supabase.from("site_settings").update({features,updated_at:new Date().toISOString()}).eq("id","global").filter("features","eq",JSON.stringify(current.features)).select("features").maybeSingle();
    if(error)return NextResponse.json({error:"პარამეტრის შენახვა ვერ მოხერხდა."},{status:503});
    if(saved)return NextResponse.json({features:saved.features});
  }
  return NextResponse.json({error:"პარამეტრები პარალელურად შეიცვალა. სცადე ხელახლა."},{status:409});
}
