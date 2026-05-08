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
    expect(results).toEqual([
      {
        title: "Pachinko",
        authors: ["Min Jin Lee"],
        reason: "Matched your request for \"family sagas\".",
        source: "search-fallback",
        provider: "open-library",
        providerId: "OL262758W",
        coverUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
        pageCount: null,
      },
    ]);
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
        reason: "Matched your request for \"thoughtful science fiction\".",
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
        reason: 'Matched your request for "Hermann Hesse".',
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
        source: "openai",
        provider: "google",
        providerId: "google-psalm-ko",
        coverUrl: null,
        pageCount: 160,
      },
    ]);
  });
});
