import { NextResponse } from "next/server";
import { bearerToken, flittEnvironment } from "@/lib/flitt";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const clients = flittEnvironment();
  if (!clients) return NextResponse.json({ error: "Payment status is not configured." }, { status: 503 });
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in to check Premium access." }, { status: 401 });
  const { data: { user }, error: authError } = await clients.auth.auth.getUser(token);
  if (authError || !user || user.is_anonymous) return NextResponse.json({ error: "Sign in with a registered account." }, { status: 401 });
  const { data, error } = await clients.admin.from("premium_memberships").select("expires_at").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not check Premium access." }, { status: 503 });
  const expiresAt = data?.expires_at || null;
  return NextResponse.json({ active: Boolean(expiresAt && Date.parse(expiresAt) > Date.now()), expiresAt }, { headers: { "Cache-Control": "no-store" } });
}
