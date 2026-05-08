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
      intent: undefined,
      previousProviderIds: [],
      hiddenProviderIds: [],
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
          mood: "calm",
          length: "short",
          difficulty: "easy",
          genres: ["에세이"],
          purpose: "잠들기 전",
        },
        previousProviderIds: ["kakao:already-seen"],
        hiddenProviderIds: [],
      },
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
