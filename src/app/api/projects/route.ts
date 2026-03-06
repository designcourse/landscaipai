import { NextResponse } from "next/server";

export async function GET() {
  // TODO: List user's projects
  return NextResponse.json([]);
}

export async function POST() {
  // TODO: Create new project
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
