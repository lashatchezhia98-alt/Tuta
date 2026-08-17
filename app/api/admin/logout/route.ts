import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/admin-auth";

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
