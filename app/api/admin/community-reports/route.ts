import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, verifyAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}.supabase.co`;
  return createClient(normalizedUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function isAdmin() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "ადმინის სესია არასწორია ან ვადაგასულია." }, { status: 401 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "სერვერის Supabase გასაღები ჯერ დაყენებული არ არის." }, { status: 503 });

  const { data: reports, error } = await supabase.from("community_reports")
    .select("id,post_id,reason,created_at").order("created_at", { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: "საჩივრები ვერ ჩაიტვირთა. შეამოწმე საზოგადოების მიგრაცია." }, { status: 503 });
  const postIds = [...new Set((reports || []).map(report => report.post_id))];
  if (!postIds.length) return NextResponse.json({ reports: [] }, { headers: { "Cache-Control": "no-store" } });

  const { data: posts, error: postError } = await supabase.from("community_posts")
    .select("id,display_name,is_anonymous,topic,body,created_at").in("id", postIds);
  if (postError) return NextResponse.json({ error: "პოსტების დეტალები ვერ ჩაიტვირთა." }, { status: 503 });
  const byId = new Map((posts || []).map(post => [post.id, post]));
  const result = (reports || []).flatMap(report => {
    const post = byId.get(report.post_id);
    return post ? [{ id: report.id, reason: report.reason, created_at: report.created_at, post }] : [];
  });
  return NextResponse.json({ reports: result }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "ადმინის სესია არასწორია ან ვადაგასულია." }, { status: 401 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "სერვერის Supabase გასაღები ჯერ დაყენებული არ არის." }, { status: 503 });

  let body: { action?: string; reportId?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "მოთხოვნის მონაცემები არასწორია." }, { status: 400 }); }
  if (!body.reportId || !/^[0-9a-f-]{36}$/i.test(body.reportId) || !["dismiss", "remove_post"].includes(body.action || "")) {
    return NextResponse.json({ error: "საჩივრის მოქმედება არასწორია." }, { status: 400 });
  }
  const { data: report, error: readError } = await supabase.from("community_reports")
    .select("id,post_id").eq("id", body.reportId).maybeSingle();
  if (readError) return NextResponse.json({ error: "საჩივარი ვერ მოიძებნა." }, { status: 503 });
  if (!report) return NextResponse.json({ error: "ეს საჩივარი უკვე დამუშავებულია ან აღარ არსებობს." }, { status: 404 });

  if (body.action === "remove_post") {
    const { error } = await supabase.from("community_posts").delete().eq("id", report.post_id);
    if (error) return NextResponse.json({ error: "პოსტის წაშლა ვერ მოხერხდა." }, { status: 503 });
  } else {
    const { error } = await supabase.from("community_reports").delete().eq("id", report.id);
    if (error) return NextResponse.json({ error: "საჩივრის დახურვა ვერ მოხერხდა." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
