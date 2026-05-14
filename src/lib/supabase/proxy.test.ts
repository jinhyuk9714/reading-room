import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn(async () => ({ data: null, error: null }));
const createServerClient = vi.fn(() => ({
  auth: {
    getClaims,
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

function request(path: string, cookie?: string) {
  return new NextRequest(`https://reader.test${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("Supabase proxy session guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
  });

  it("redirects protected pages without an auth cookie before hitting Supabase", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");

    const response = await updateSession(request("/library"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://reader.test/login");
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("does not run Supabase checks for public pages or API routes", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");

    await expect(updateSession(request("/login"))).resolves.toMatchObject({
      status: 200,
    });
    await expect(updateSession(request("/demo"))).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      updateSession(request("/api/recommendations")),
    ).resolves.toMatchObject({
      status: 200,
    });

    expect(createServerClient).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("refreshes a request that already carries a Supabase auth cookie", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");

    const response = await updateSession(
      request("/library", "sb-project-auth-token.0=token"),
    );

    expect(response.status).toBe(200);
    expect(createServerClient).toHaveBeenCalledOnce();
    expect(getClaims).toHaveBeenCalledOnce();
  });
});
