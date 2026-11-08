import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin-auth";

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url), 303);
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
