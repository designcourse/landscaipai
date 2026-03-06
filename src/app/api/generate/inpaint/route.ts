import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Validate auth, deduct credit, call Gemini with mask context
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
