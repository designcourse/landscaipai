import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Get current credit balance
  return NextResponse.json({ credits: 0 });
}
