import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Upload photo to project via Supabase Storage
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
