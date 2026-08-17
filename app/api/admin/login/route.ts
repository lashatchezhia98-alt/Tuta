import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_SECONDS, createAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: "Admin credentials are not configured." }, { status: 503 });
  }

  const { email, password } = await request.json();
  if (email !== expectedEmail || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await createAdminSession(email);
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
