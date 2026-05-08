import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { searchBooks } from "@/lib/books/search";

vi.mock("@/lib/books/search", () => ({
  searchBooks: vi.fn(),
}));

const searchBooksMock = vi.mocked(searchBooks);

describe("GET /api/books/search", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns search results as JSON", async () => {
    searchBooksMock.mockResolvedValueOnce([
      {
        provider: "google",
        providerId: "abc123",
        title: "The Left Hand of Darkness",
        subtitle: null,
        authors: ["Ursula K. Le Guin"],
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: null,
        publishedYear: 1969,
        language: "en",
        description: null,
        raw: {},
      },
    ]);

    const response = await GET(
      new Request("https://example.com/api/books/search?q=left%20hand&limit=5"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      results: [
        {
          provider: "google",
          providerId: "abc123",
          title: "The Left Hand of Darkness",
          subtitle: null,
          authors: ["Ursula K. Le Guin"],
          isbn10: null,
          isbn13: null,
          coverUrl: null,
          pageCount: null,
          publishedYear: 1969,
          language: "en",
          description: null,
          raw: {},
        },
      ],
    });
    expect(searchBooksMock).toHaveBeenCalledWith("left hand", { limit: 5 });
  });

  it("clamps large limits before searching", async () => {
    searchBooksMock.mockResolvedValueOnce([]);

    const response = await GET(
      new Request("https://example.com/api/books/search?q=1984&limit=999"),
    );

    expect(response.status).toBe(200);
    expect(searchBooksMock).toHaveBeenCalledWith("1984", { limit: 20 });
  });

  it("rejects abusive query sizes before calling providers", async () => {
    const response = await GET(
      new Request(
        `https://example.com/api/books/search?q=${"a".repeat(121)}&limit=5`,
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "검색어는 120자 이내로 입력해주세요.",
    });
    expect(searchBooksMock).not.toHaveBeenCalled();
  });

  it("returns a sanitized cacheable error when search providers fail", async () => {
    searchBooksMock.mockRejectedValueOnce(new Error("provider secret leaked"));

    const response = await GET(
      new Request("https://example.com/api/books/search?q=left%20hand"),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=30");
    await expect(response.json()).resolves.toEqual({
      error: "검색에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
  });

  it("returns a 400 response when the query is missing", async () => {
    const response = await GET(
      new Request("https://example.com/api/books/search?q=%20"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing search query.",
    });
    expect(searchBooksMock).not.toHaveBeenCalled();
  });
});
