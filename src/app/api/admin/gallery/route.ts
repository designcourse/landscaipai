import { NextResponse } from "next/server";

export async function GET() {
  // TODO: List all gallery items (admin only)
  return NextResponse.json([]);
}

export async function POST() {
  // TODO: Add gallery item (admin only)
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
