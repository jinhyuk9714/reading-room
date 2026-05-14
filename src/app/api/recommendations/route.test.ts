import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";
import { getRecommendations } from "@/lib/recommendations/recommendations";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/recommendations/recommendations", () => ({
  getRecommendations: vi.fn(),
  recommendationQueryFromIntent: vi.fn(() => "잔잔한 짧은 쉬운 에세이 잠들기 전"),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const getRecommendationsMock = vi.mocked(getRecommendations);
const createClientMock = vi.mocked(createClient);

function mockUser(user: { id: string } | null) {
  createClientMock.mockResolvedValueOnce({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
        error: null,
      })),
    },
  } as never);
}

describe("POST /api/recommendations", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns recommendation cards as JSON", async () => {
    mockUser({ id: "user-1" });
    getRecommendationsMock.mockResolvedValueOnce([
      {
        title: "Pachinko",
        authors: ["Min Jin Lee"],
        reason: "Sweeping family saga.",
        reasonTags: ["검색 기반", "국내판 확인"],
        matchScore: 73,
        section: "now",
        isFallback: true,
        domesticVerified: true,
        source: "search-fallback",
        provider: "open-library",
        providerId: "OL262758W",
        coverUrl: null,
        pageCount: null,
      },
    ]);

    const response = await POST(
      new Request("https://example.com/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ query: "family sagas", limit: 1 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      results: [
        {
          title: "Pachinko",
          authors: ["Min Jin Lee"],
          reason: "Sweeping family saga.",
          reasonTags: ["검색 기반", "국내판 확인"],
          matchScore: 73,
          section: "now",
          isFallback: true,
          domesticVerified: true,
          source: "search-fallback",
          provider: "open-library",
          providerId: "OL262758W",
          coverUrl: null,
          pageCount: null,
        },
      ],
    });
    expect(getRecommendationsMock).toHaveBeenCalledWith("family sagas", {
      limit: 1,
      mode: "feed",
      intent: {
        daily_page_goal: 20,
        default_log_mode: "page",
      },
      previousProviderIds: [],
      hiddenProviderIds: [],
      excludedProviderIds: [],
      recommendationEvents: [],
    });
  });

  it("supports structured purpose recommendation requests without a legacy query", async () => {
    mockUser({ id: "user-1" });
    getRecommendationsMock.mockResolvedValueOnce([]);

    const response = await POST(
      new Request("https://example.com/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          mode: "purpose",
          intent: {
            mood: "calm",
            length: "short",
            difficulty: "easy",
            genres: ["에세이"],
            purpose: "잠들기 전",
          },
          previousProviderIds: ["kakao:already-seen"],
          limit: 3,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(getRecommendationsMock).toHaveBeenCalledWith(
      "잔잔한 짧은 쉬운 에세이 잠들기 전",
      {
        limit: 3,
        mode: "purpose",
        intent: {
          daily_page_goal: 20,
          default_log_mode: "page",
          mood: "calm",
          length: "short",
          difficulty: "easy",
          genres: ["에세이"],
          purpose: "잠들기 전",
        },
        previousProviderIds: ["kakao:already-seen"],
        hiddenProviderIds: [],
        excludedProviderIds: [],
        recommendationEvents: [],
      },
    );
  });

  it("adds minimal recommendation event signals for the authenticated user", async () => {
    const order = vi.fn(() => ({
      limit: vi.fn(async () => ({
        data: [
          {
            event_type: "dismissed",
            provider: "kakao",
            provider_id: "dismissed-book",
            recommendation: { title: "지운 추천", authors: ["작가"] },
          },
          {
            event_type: "saved",
            provider: "naver",
            provider_id: "saved-book",
            recommendation: { title: "저장한 책", authors: ["좋아한 작가"] },
          },
        ],
        error: null,
      })),
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    createClientMock.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        })),
      },
      from: vi.fn(() => ({ select })),
    } as never);
    getRecommendationsMock.mockResolvedValueOnce([]);

    const response = await POST(
      new Request("https://example.com/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ query: "한국 소설", limit: 2 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(select).toHaveBeenCalledWith(
      "event_type, provider, provider_id, recommendation",
    );
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(getRecommendationsMock).toHaveBeenCalledWith(
      "한국 소설",
      expect.objectContaining({
        recommendationEvents: [
          {
            eventType: "dismissed",
            provider: "kakao",
            providerId: "dismissed-book",
            recommendation: { title: "지운 추천", authors: ["작가"] },
          },
          {
            eventType: "saved",
            provider: "naver",
            providerId: "saved-book",
            recommendation: { title: "저장한 책", authors: ["좋아한 작가"] },
          },
        ],
      }),
    );
  });

  it("requires an authenticated user before generating recommendations", async () => {
    mockUser(null);

    const response = await POST(
      new Request("https://example.com/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ query: "family sagas", limit: 1 }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "로그인이 필요합니다.",
    });
    expect(getRecommendationsMock).not.toHaveBeenCalled();
  });

  it("returns a 400 response when the query is missing", async () => {
    const response = await POST(
      new Request("https://example.com/api/recommendations", {
        method: "POST",
        body: JSON.stringify({ query: " " }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing recommendation query.",
    });
    expect(getRecommendationsMock).not.toHaveBeenCalled();
  });
});
