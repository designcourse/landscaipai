import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Only allow relative redirects to prevent open redirect attacks
      const safeNext = next.startsWith("/") ? next : "/dashboard";
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", request.url)
  );
}
