import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Manually adjust user credits (admin only)
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
