import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("library_items")
    .select("*")
    .order("category")
    .order("common_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const isDev = process.env.NODE_ENV === "development";

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": isDev ? "no-store" : "public, max-age=3600, s-maxage=3600",
    },
  });
}
