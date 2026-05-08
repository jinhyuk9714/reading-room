import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);

function recommendationCard() {
  return {
    title: "모순",
    authors: ["양귀자"],
    reason: "서재 흐름과 잘 맞는 국내판 추천입니다.",
    reasonTags: ["국내판 확인"],
    matchScore: 91,
    section: "now",
    isFallback: true,
    domesticVerified: true,
    source: "search-fallback",
    provider: "kakao",
    providerId: "kakao-contradiction",
    coverUrl: null,
    pageCount: 308,
  };
}

describe("POST /api/recommendations/events", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("stores authenticated recommendation feedback events", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    createClientMock.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: vi.fn(() => ({ insert })),
    } as never);

    const response = await POST(
      new Request("https://example.com/api/recommendations/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "dismissed",
          card: recommendationCard(),
          query: "국내 독서 추천",
          metadata: { purposeId: "feed" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        event_type: "dismissed",
        provider: "kakao",
        provider_id: "kakao-contradiction",
        source: "search-fallback",
        query: "국내 독서 추천",
        metadata: { purposeId: "feed" },
      }),
    );
  });

  it("requires a signed-in user", async () => {
    createClientMock.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: null,
        })),
      },
    } as never);

    const response = await POST(
      new Request("https://example.com/api/recommendations/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "opened",
          card: recommendationCard(),
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "로그인이 필요합니다.",
    });
  });

  it("rejects malformed event payloads", async () => {
    const response = await POST(
      new Request("https://example.com/api/recommendations/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "delete",
          card: { title: "bad" },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "추천 이벤트 형식이 올바르지 않습니다.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
