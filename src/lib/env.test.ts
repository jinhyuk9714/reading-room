import { afterEach, describe, expect, it } from "vitest";

import {
  getSiteUrl,
  hasGoogleOAuthEnabled,
  hasSupabaseEnv,
} from "@/lib/env";

describe("environment helpers", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires both public Supabase values for cloud mode", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(hasSupabaseEnv()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(hasSupabaseEnv()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    expect(hasSupabaseEnv()).toBe(true);
  });

  it("keeps Google OAuth disabled until explicitly enabled", () => {
    delete process.env.GOOGLE_OAUTH_ENABLED;
    expect(hasGoogleOAuthEnabled()).toBe(false);

    process.env.GOOGLE_OAUTH_ENABLED = "false";
    expect(hasGoogleOAuthEnabled()).toBe(false);

    process.env.GOOGLE_OAUTH_ENABLED = "true";
    expect(hasGoogleOAuthEnabled()).toBe(true);
  });

  it("uses the explicit site URL before Vercel defaults", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "reading-room.vercel.app";

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
