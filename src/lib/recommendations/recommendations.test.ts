import { afterEach, describe, expect, it, vi } from "vitest";

import { getRecommendations } from "@/lib/recommendations/recommendations";
import { searchBooks } from "@/lib/books/search";

vi.mock("@/lib/books/search", () => ({
  searchBooks: vi.fn(),
}));

const searchBooksMock = vi.mocked(searchBooks);

describe("getRecommendations", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalOpenAiModel = process.env.OPENAI_RECOMMENDATIONS_MODEL;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    process.env.OPENAI_RECOMMENDATIONS_MODEL = originalOpenAiModel;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses search fallback without calling OpenAI when no API key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "open-library",
        providerId: "OL262758W",
        title: "Pachinko",
        subtitle: null,
        authors: ["Min Jin Lee"],
        isbn10: null,
        isbn13: null,
        coverUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
        pageCount: null,
        publishedYear: 2017,
        language: "en",
        description: null,
        raw: {},
      },
    ]);

    const results = await getRecommendations("family sagas", { limit: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(searchBooksMock).toHaveBeenCalledWith("family sagas", {
      limit: 1,
      market: "kr",
    });
    expect(results[0]).toMatchObject({
      title: "Pachinko",
      reason: "\"family sagas\"에 맞춰 고른 국내판 추천입니다.",
      reasonTags: ["검색 기반", "국내판 확인"],
      provider: "open-library",
      providerId: "OL262758W",
    });
  });

  it("falls back to search when the OpenAI Responses API request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_RECOMMENDATIONS_MODEL = "test-model";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "google",
        providerId: "google-left-hand",
        title: "The Left Hand of Darkness",
        subtitle: null,
        authors: ["Ursula K. Le Guin"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 304,
        publishedYear: 1969,
        language: "en",
        description: null,
        raw: {},
      },
    ]);

    const results = await getRecommendations("thoughtful science fiction", {
      limit: 2,
    });

    expect(results).toEqual([
      {
        title: "The Left Hand of Darkness",
        authors: ["Ursula K. Le Guin"],
        reason: "\"thoughtful science fiction\"에 맞춰 고른 국내판 추천입니다.",
        reasonTags: ["검색 기반", "국내판 확인"],
        matchScore: 73,
        section: "now",
        isFallback: true,
        domesticVerified: true,
        source: "search-fallback",
        provider: "google",
        providerId: "google-left-hand",
        coverUrl: null,
        pageCount: 304,
      },
    ]);
  });

  it("does not call OpenAI when a recommendation model is not configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_RECOMMENDATIONS_MODEL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "google",
        providerId: "google-1984-ko",
        title: "1984",
        subtitle: null,
        authors: ["조지 오웰"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 416,
        publishedYear: 2016,
        language: "ko",
        description: null,
        raw: {},
      },
    ]);

    const results = await getRecommendations("dystopia", { limit: 1 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      provider: "google",
      providerId: "google-1984-ko",
      title: "1984",
    });
  });

  it("uses library author keywords when the full recommendation prompt has no search results", async () => {
    delete process.env.OPENAI_API_KEY;
    searchBooksMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          provider: "open-library",
          providerId: "same-book",
          title: "데미안 ; 향수",
          subtitle: null,
          authors: ["Hermann Hesse"],
          isbn10: null,
          isbn13: null,
          coverUrl: null,
          pageCount: null,
          publishedYear: 1991,
          language: "ko",
          description: null,
          raw: {},
        },
        {
          provider: "open-library",
          providerId: "siddhartha",
          title: "Siddhartha",
          subtitle: null,
          authors: ["Hermann Hesse"],
          isbn10: null,
          isbn13: null,
          coverUrl: null,
          pageCount: 152,
          publishedYear: 1922,
          language: "en",
          description: null,
          raw: {},
        },
      ]);

    const query = [
      "Recommend books for a Korean personal reading room app.",
      "Avoid books already in the user's library when possible.",
      "Currently reading:",
      "- 데미안 ; 향수 by Hermann Hesse, Tu-sik Kang, Rainer Maria Rilke",
    ].join("\n");

    const results = await getRecommendations(query, { limit: 1 });

    expect(searchBooksMock).toHaveBeenNthCalledWith(1, query, {
      limit: 1,
      market: "kr",
    });
    expect(searchBooksMock).toHaveBeenNthCalledWith(2, "Hermann Hesse", {
      limit: 3,
      market: "kr",
    });
    expect(results).toEqual([
      {
        title: "Siddhartha",
        authors: ["Hermann Hesse"],
        reason: '"Hermann Hesse"에 맞춰 고른 국내판 추천입니다.',
        reasonTags: ["검색 기반", "비슷한 저자", "짧게 읽기", "국내판 확인"],
        matchScore: 75,
        section: "similar",
        isFallback: true,
        domesticVerified: true,
        source: "search-fallback",
        provider: "open-library",
        providerId: "siddhartha",
        coverUrl: null,
        pageCount: 152,
      },
    ]);
  });

  it("returns valid recommendation cards from OpenAI response output text", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_RECOMMENDATIONS_MODEL = "test-model";
    const fetchMock = vi.fn(async () =>
      Response.json({
        output_text: JSON.stringify([
          {
            title: "A Psalm for the Wild-Built",
            authors: ["Becky Chambers"],
            reason: "Gentle, hopeful science fiction with reflective pacing.",
            source: "openai",
            provider: "manual",
            providerId: "ai-a-psalm-for-the-wild-built",
            coverUrl: null,
            pageCount: 160,
          },
        ]),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "google",
        providerId: "google-psalm-ko",
        title: "와일드 로봇의 노래",
        subtitle: null,
        authors: ["베키 체임버스"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 160,
        publishedYear: 2024,
        language: "ko",
        description: null,
        raw: {},
      },
    ]);

    const results = await getRecommendations("hopeful sci-fi", { limit: 3 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(searchBooksMock).toHaveBeenCalledWith(
      "A Psalm for the Wild-Built Becky Chambers",
      { limit: 3, market: "kr" },
    );
    expect(results).toEqual([
      {
        title: "와일드 로봇의 노래",
        authors: ["베키 체임버스"],
        reason: "Gentle, hopeful science fiction with reflective pacing.",
        reasonTags: ["AI 추천", "국내판 확인"],
        matchScore: 88,
        section: "now",
        isFallback: false,
        domesticVerified: true,
        source: "openai",
        provider: "google",
        providerId: "google-psalm-ko",
        coverUrl: null,
        pageCount: 160,
      },
    ]);
  });

  it("supports purpose recommendations with intent-aware search and sections", async () => {
    delete process.env.OPENAI_API_KEY;
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "kakao",
        providerId: "short-calm",
        title: "아주 작은 독서",
        subtitle: null,
        authors: ["정온"],
        isbn10: null,
        isbn13: "9790000000001",
        coverUrl: null,
        pageCount: 168,
        publishedYear: 2025,
        language: "kor",
        description: "잔잔한 밤 독서에 맞는 짧은 에세이",
        raw: {},
      },
    ]);

    const results = await getRecommendations("서재 기반 추천", {
      limit: 1,
      mode: "purpose",
      intent: {
        mood: "calm",
        length: "short",
        difficulty: "easy",
        genres: ["에세이"],
        purpose: "잠들기 전",
      },
    });

    expect(searchBooksMock).toHaveBeenCalledWith(
      "잔잔한 짧은 쉬운 에세이 잠들기 전",
      { limit: 1, market: "kr" },
    );
    expect(results[0]).toMatchObject({
      title: "아주 작은 독서",
      section: "short",
      reasonTags: ["목적별", "짧게 읽기", "국내판 확인"],
      isFallback: true,
      domesticVerified: true,
    });
  });

  it("excludes hidden and previously shown provider ids from conversation results", async () => {
    delete process.env.OPENAI_API_KEY;
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "kakao",
        providerId: "skip-me",
        title: "이미 본 책",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 220,
        publishedYear: 2022,
        language: "kor",
        description: null,
        raw: {},
      },
      {
        provider: "kakao",
        providerId: "next-book",
        title: "다음 책",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 320,
        publishedYear: 2023,
        language: "kor",
        description: null,
        raw: {},
      },
    ]);

    const results = await getRecommendations("더 깊게", {
      limit: 1,
      mode: "conversation",
      previousProviderIds: ["kakao:skip-me"],
      hiddenProviderIds: ["kakao:hidden"],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: "next-book",
      section: "conversation",
      reasonTags: ["대화형 탐색", "국내판 확인"],
    });
  });

  it("excludes provider ids dismissed through recommendation events", async () => {
    delete process.env.OPENAI_API_KEY;
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "kakao",
        providerId: "dismissed-book",
        title: "지운 추천",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 180,
        publishedYear: 2024,
        language: "kor",
        description: null,
        raw: {},
      },
      {
        provider: "kakao",
        providerId: "fresh-book",
        title: "새 추천",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 260,
        publishedYear: 2025,
        language: "kor",
        description: null,
        raw: {},
      },
    ]);

    const results = await getRecommendations("한국 소설", {
      limit: 1,
      recommendationEvents: [
        {
          eventType: "dismissed",
          provider: "kakao",
          providerId: "dismissed-book",
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: "fresh-book",
      reason: "\"한국 소설\"에 맞춰 고른 국내판 추천입니다.",
    });
  });

  it("boosts candidates related to saved and opened recommendation events", async () => {
    delete process.env.OPENAI_API_KEY;
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "kakao",
        providerId: "general-book",
        title: "일반 장편",
        subtitle: null,
        authors: ["다른 작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 420,
        publishedYear: 2020,
        language: "kor",
        description: "천천히 읽는 장편 소설",
        raw: {},
      },
      {
        provider: "naver",
        providerId: "related-short",
        title: "저녁 산책 에세이",
        subtitle: null,
        authors: ["좋아한 작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 160,
        publishedYear: 2024,
        language: "ko",
        description: "짧고 잔잔한 산책 에세이",
        raw: {},
      },
    ]);

    const results = await getRecommendations("오늘 읽을 책", {
      limit: 1,
      intent: {
        daily_page_goal: 20,
        default_log_mode: "page",
      },
      recommendationEvents: [
        {
          eventType: "saved",
          provider: "kakao",
          providerId: "saved-essay",
          recommendation: {
            title: "좋아한 에세이",
            authors: ["좋아한 작가"],
            reason: "좋아한 책",
            source: "search-fallback",
            provider: "kakao",
            providerId: "saved-essay",
            coverUrl: null,
            pageCount: 150,
          },
        },
        {
          eventType: "opened",
          provider: "kakao",
          providerId: "opened-walk",
          recommendation: {
            title: "산책자의 문장",
            authors: ["산책 작가"],
            reason: "열어 본 책",
            source: "search-fallback",
            provider: "kakao",
            providerId: "opened-walk",
            coverUrl: null,
            pageCount: 190,
          },
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: "related-short",
      reasonTags: ["검색 기반", "취향 반영", "짧게 읽기", "국내판 확인"],
    });
  });

  it("excludes candidates matching blocked reader preference keywords", async () => {
    delete process.env.OPENAI_API_KEY;
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "kakao",
        providerId: "blocked-horror",
        title: "밤의 공포 소설",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 240,
        publishedYear: 2023,
        language: "kor",
        description: "공포와 미스터리",
        raw: {},
      },
      {
        provider: "naver",
        providerId: "calm-essay",
        title: "잔잔한 산책",
        subtitle: null,
        authors: ["산책가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 180,
        publishedYear: 2024,
        language: "ko",
        description: "차분한 에세이",
        raw: {},
      },
    ]);

    const results = await getRecommendations("오늘 읽을 책", {
      limit: 1,
      intent: { blockedSubjects: ["공포"] },
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: "calm-essay",
    });
  });

  it("honors mode and provider-id exclusions embedded in a recommendation context query", async () => {
    delete process.env.OPENAI_API_KEY;
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "kakao",
        providerId: "hidden-book",
        title: "숨김 책",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 210,
        publishedYear: 2021,
        language: "kor",
        description: null,
        raw: {},
      },
      {
        provider: "naver",
        providerId: "blocked-book",
        title: "제외 책",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 260,
        publishedYear: 2022,
        language: "kor",
        description: null,
        raw: {},
      },
      {
        provider: "kakao",
        providerId: "kept-book",
        title: "이어 읽는 책",
        subtitle: null,
        authors: ["작가"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: 240,
        publishedYear: 2023,
        language: "kor",
        description: null,
        raw: {},
      },
    ]);

    const query = [
      "Recommend books for a Korean personal reading room app.",
      "Recommendation mode: conversation.",
      "Hidden provider IDs: kakao:hidden-book",
      "Excluded provider IDs: naver:blocked-book",
      "Conversation context:",
      "- continue the earlier thread",
    ].join("\n");

    const results = await getRecommendations(query, { limit: 1 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: "kept-book",
      section: "conversation",
      reasonTags: ["대화형 탐색", "국내판 확인"],
    });
  });
});
