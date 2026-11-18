import { dbClient, checked, failure } from "@/lib/platform-server";
import { NextResponse } from "next/server";

// Only fictional, explicitly identified demo content is exposed without sign-in.
export async function GET() {
  try {
    const doctors = checked(
      await dbClient()
        .from("doctor_demo_profiles")
        .select("id,first_name,last_name,specialty,bio,photo_url")
        .eq("active", true)
        .order("created_at")
        .limit(50),
    );
    return NextResponse.json({ doctors }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    return failure(error);
  }
}
