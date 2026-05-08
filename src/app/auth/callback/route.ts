import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";

  if (!next.startsWith("/")) {
    next = "/";
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(`${origin}/login?error=missing-env`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          user_id: user.id,
          display_name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email ??
            "Reader",
          locale: "ko-KR",
        });

        if (profileError) {
          return NextResponse.redirect(`${origin}/login?error=profile`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
