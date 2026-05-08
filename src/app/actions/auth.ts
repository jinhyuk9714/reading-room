"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, hasGoogleOAuthEnabled, hasSupabaseEnv } from "@/lib/env";

export async function signInWithGoogle() {
  if (!hasSupabaseEnv()) {
    redirect("/login?error=missing-env");
  }

  if (!hasGoogleOAuthEnabled()) {
    redirect("/login?error=google-oauth-disabled");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "oauth")}`);
  }

  redirect(data.url);
}

export async function signOut() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
