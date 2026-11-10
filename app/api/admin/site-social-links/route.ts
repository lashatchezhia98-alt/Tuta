import { isSameOrigin, readAdminJson } from "@/lib/admin-request";
import { NextResponse } from "next/server";
import { getAdminIdentity, requireAdmin } from "@/lib/platform-server";
import { canAccessAdminSection } from "@/lib/admin-sections";
import { parseSocialLinks, type SocialPlatform } from "@/lib/site-social-links";

export const dynamic = "force-dynamic";

const platformNames: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "ადმინის შესვლა ხელახლა გაიარე." }, { status: 401 });
  if (!canAccessAdminSection(identity.access, "social-links")) return NextResponse.json({ error: "ამ სექციაზე წვდომა არ გაქვს." }, { status: 403 });

  try {
    const db = await requireAdmin(request, false, "social-links");
    let input: Record<string, unknown>;
    try { input = await readAdminJson(request, 16_384); }
    catch { return NextResponse.json({ error: "ბმულების მონაცემები არასწორია." }, { status: 400 }); }
    const { links, invalid } = parseSocialLinks(input.links);
    if (invalid.length) return NextResponse.json({ error: `შეამოწმე ${invalid.map(platform => platformNames[platform]).join(", ")} ბმული. გამოიყენე შესაბამისი სოციალური ქსელის https:// მისამართი.` }, { status: 400 });

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: current, error: readError } = await db.from("site_settings").select("features").eq("id", "global").maybeSingle();
      if (readError || !current) return NextResponse.json({ error: "პარამეტრები ვერ ჩაიტვირთა." }, { status: 503 });
      const features = { ...(current.features as Record<string, unknown> || {}), socialLinks: links };
      const { data: saved, error } = await db.from("site_settings").update({ features, updated_at: new Date().toISOString() })
        .eq("id", "global").filter("features", "eq", JSON.stringify(current.features)).select("features").maybeSingle();
      if (error) return NextResponse.json({ error: "ბმულების შენახვა ვერ მოხერხდა." }, { status: 503 });
      if (saved) return NextResponse.json({ links });
    }
    return NextResponse.json({ error: "პარამეტრები პარალელურად შეიცვალა. სცადე ხელახლა." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "ბმულების შენახვა ვერ მოხერხდა." }, { status: 503 });
  }
}
