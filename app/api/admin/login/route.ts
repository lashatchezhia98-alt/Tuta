import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_SECONDS, createAdminSession } from "@/lib/admin-auth";
import { isSameOrigin, readAdminJson, credentialsMatch } from "@/lib/admin-request";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: "Admin credentials are not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await readAdminJson(request); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { email, password } = body;
  const emailMatches = credentialsMatch(email, expectedEmail);
  const passwordMatches = credentialsMatch(password, expectedPassword);
  if (!emailMatches || !passwordMatches) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await createAdminSession(expectedEmail);
  if (!session) return NextResponse.json({ error: "Admin session secret is invalid." }, { status: 503 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
