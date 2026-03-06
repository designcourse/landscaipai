import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    // TODO: Exchange code for session via Supabase
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
