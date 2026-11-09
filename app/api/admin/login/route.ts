import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COOKIE_NAME, SESSION_SECONDS, createAdminSession, createInvitedAdminSession } from "@/lib/admin-auth";
import { adminEmail } from "@/lib/admin-invitations";
import { isSameOrigin, readAdminJson, credentialsMatch } from "@/lib/admin-request";
import { checked, dbClient, failure, result } from "@/lib/platform-server";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword || (process.env.ADMIN_SESSION_SECRET?.length ?? 0) < 32) {
    return NextResponse.json({ error: "Admin credentials are not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await readAdminJson(request); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { email, password } = body;
  const normalized = adminEmail(email);
  const invalid = () => result({ error: "Invalid email or password." }, 401);
  if (!normalized || typeof password !== "string" || !password || password.length > 4096) return invalid();

  let session;
  if (normalized === adminEmail(expectedEmail)) {
    if (!credentialsMatch(password, expectedPassword)) return invalid();
    session = await createAdminSession(expectedEmail);
  } else {
    try {
      const db = dbClient();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!key) return result({ error: "Admin sign-in is not configured." }, 503);
      const client = createClient(/^https?:/.test(url) ? url : `https://${url}.supabase.co`, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.auth.signInWithPassword({ email: normalized, password });
      if (error?.status === 429) return result({ error: "Too many attempts." }, 429);
      if (error || !data.user?.email_confirmed_at || data.user.is_anonymous) return invalid();
      const membership = checked(await db.from("admin_memberships").select("invite_id").eq("user_id", data.user.id)
        .eq("email", normalized).is("revoked_at", null).maybeSingle());
      if (!membership) return invalid();
      session = await createInvitedAdminSession(data.user.id, membership.invite_id);
    } catch (error) { return failure(error); }
  }
  if (!session) return NextResponse.json({ error: "Admin session secret is invalid." }, { status: 503 });

  const response = result({ ok: true });
  response.cookies.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
