import { afterEach, describe, expect, it, vi } from "vitest";
import { searchBooks } from "@/lib/books/search";

describe("searchBooks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("can merge Open Library metadata when global market search is requested", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({
          items: [
            {
              id: "google-pachinko",
              volumeInfo: {
                title: "Pachinko",
                authors: ["Min Jin Lee"],
                industryIdentifiers: [
                  { type: "ISBN_13", identifier: "9781455563937" },
                ],
              },
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({
          docs: [
            {
              key: "/works/OLduplicateW",
              title: "Pachinko",
              author_name: ["Min Jin Lee"],
              isbn: ["9781455563937"],
            },
            {
              key: "/works/OLuniqueW",
              title: "Free Food for Millionaires",
              author_name: ["Min Jin Lee"],
              isbn: ["9780446696975"],
            },
          ],
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("pachinko", {
      limit: 3,
      market: "global",
    });

    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("https://www.googleapis.com/books/v1/volumes"),
        expect.stringContaining("https://openlibrary.org/search.json"),
      ]),
    );
    const googleUrl = requestedUrls.find((url) =>
      url.startsWith("https://www.googleapis.com/books/v1/volumes"),
    );
    expect(googleUrl).not.toContain("key=");
    expect(googleUrl).toContain("intitle%3Apachinko");
    expect(results.map((book) => book.providerId)).toEqual([
      "OLduplicateW",
      "OLuniqueW",
    ]);
    expect(results[0]).toMatchObject({
      provider: "open-library",
      title: "Pachinko",
      authors: ["Min Jin Lee"],
      isbn13: "9781455563937",
    });
  });

  it("falls back to Open Library for global market search when Google Books fails", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return new Response(null, { status: 503 });
      }

      return Response.json({
        docs: [
          {
            key: "/works/OL262758W",
            title: "Pachinko",
            author_name: ["Min Jin Lee"],
          },
        ],
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("pachinko", { market: "global" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "open-library",
      providerId: "OL262758W",
      title: "Pachinko",
    });
  });

  it("continues with Open Library for global market search when Google Books fetch throws", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        throw new Error("network unavailable");
      }

      return Response.json({
        docs: [
          {
            key: "/works/OL262758W",
            title: "Pachinko",
            author_name: ["Min Jin Lee"],
          },
        ],
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("pachinko", { market: "global" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "open-library",
      providerId: "OL262758W",
      title: "Pachinko",
    });
  });

  it("returns curated Korean metadata when external providers cannot resolve a short Korean title", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return new Response(null, { status: 429 });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json(
          {
            detail: [
              {
                msg: "Query too short, must be at least 3 characters",
              },
            ],
          },
          { status: 400 },
        );
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("모순", { limit: 3 });

    expect(results[0]).toMatchObject({
      provider: "manual",
      providerId: "ko-isbn-9788998441012",
      title: "모순",
      subtitle: "양귀자 장편소설",
      authors: ["양귀자"],
      isbn13: "9788998441012",
      pageCount: 308,
      publishedYear: 2013,
      language: "kor",
    });
  });

  it("ranks Korean-market Google results above Open Library foreign editions", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({
          items: [
            {
              id: "google-korean-1984",
              volumeInfo: {
                title: "1984",
                authors: ["조지 오웰"],
                publishedDate: "2016",
                language: "ko",
              },
            },
            {
              id: "google-methods",
              volumeInfo: {
                title: "General and Synthetic Methods",
                authors: ["Royal Society of Chemistry"],
                publishedDate: "1984",
              },
              searchInfo: {
                textSnippet: "Annual review published in 1984.",
              },
            },
            {
              id: "google-accounting",
              volumeInfo: {
                title: "Accounting Standards",
                authors: ["FASB"],
                publishedDate: "1984",
              },
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        if (requestUrl.includes("title=1984")) {
          return Response.json({
            docs: [
              {
                key: "/works/OL1168083W",
                title: "Nineteen Eighty-Four",
                author_name: ["George Orwell"],
                isbn: ["0451524934", "9780451524935"],
                first_publish_year: 1949,
                language: ["eng"],
                edition_count: 535,
                ratings_count: 397,
                want_to_read_count: 6762,
                already_read_count: 842,
                currently_reading_count: 488,
              },
            ],
          });
        }

        return Response.json({
          docs: [
            {
              key: "/works/OL30827457W",
              title: "1984",
              author_name: ["George Orwell", "Amélie Audiberti"],
              isbn: ["9798590144907"],
              first_publish_year: 2021,
              language: ["eng"],
              edition_count: 8,
              want_to_read_count: 56,
              already_read_count: 1,
              currently_reading_count: 2,
            },
          ],
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("1984", { limit: 2 });

    expect(results[0]).toMatchObject({
      provider: "google",
      providerId: "google-korean-1984",
      title: "1984",
      authors: ["조지 오웰"],
      language: "ko",
    });
  });

  it("shows only Korean-market editions for 1984 and hides Open Library foreign editions", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({
          items: [
            {
              id: "google-korean-1984",
              volumeInfo: {
                title: "1984",
                authors: ["조지 오웰"],
                publishedDate: "2016",
                language: "ko",
                industryIdentifiers: [
                  { type: "ISBN_13", identifier: "9788937460777" },
                ],
              },
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({
          docs: [
            {
              key: "/works/OL1168083W",
              title: "Nineteen Eighty-Four",
              author_name: ["George Orwell"],
              isbn: ["9780451524935"],
              first_publish_year: 1949,
              language: ["eng"],
              edition_count: 535,
              ratings_count: 397,
            },
          ],
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("1984", { limit: 5 });

    expect(results).toEqual([
      expect.objectContaining({
        provider: "google",
        providerId: "google-korean-1984",
        title: "1984",
        authors: ["조지 오웰"],
        language: "ko",
      }),
    ]);
    expect(
      String(
        fetchMock.mock.calls.find(([url]) =>
          String(url).startsWith("https://www.googleapis.com/books/v1/volumes"),
        )?.[0],
      ),
    ).toContain("langRestrict=ko");
  });

  it("filters Google results that are still foreign-language editions despite Korean search restriction", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({
          items: [
            {
              id: "google-korean-1984",
              volumeInfo: {
                title: "1984",
                authors: ["조지 오웰"],
                language: "ko",
              },
            },
            {
              id: "google-english-1984",
              volumeInfo: {
                title: "1984",
                authors: ["George Orwell"],
                language: "en",
              },
              saleInfo: {
                country: "KR",
              },
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({ docs: [] });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("1984", { limit: 5 });

    expect(results.map((book) => book.providerId)).toEqual([
      "google-korean-1984",
    ]);
  });

  it("does not fall back to Open Library foreign editions when no domestic result exists", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({ items: [] });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({
          docs: [
            {
              key: "/works/OL262758W",
              title: "Pachinko",
              author_name: ["Min Jin Lee"],
              isbn: ["9781455563937"],
              language: ["eng"],
            },
          ],
        });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(searchBooks("pachinko", { limit: 3 })).resolves.toEqual([]);
  });

  it("filters foreign editions returned from Typesense before deciding search is complete", async () => {
    vi.stubEnv("TYPESENSE_HOST", "reading-room.typesense.net");
    vi.stubEnv("TYPESENSE_PORT", "443");
    vi.stubEnv("TYPESENSE_PROTOCOL", "https");
    vi.stubEnv("TYPESENSE_API_KEY", "typesense-key");

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (
        requestUrl.startsWith(
          "https://reading-room.typesense.net/collections/books/documents/search",
        )
      ) {
        return Response.json({
          hits: [
            {
              document: {
                id: "ol-1984",
                provider: "open-library",
                providerId: "OL1168083W",
                title: "Nineteen Eighty-Four",
                authors: ["George Orwell"],
                language: "eng",
                popularityScore: 200,
                sourcePriority: 40,
                appAddsCount: 0,
                appLogsCount: 0,
                lastSeenAt: 1,
              },
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({
          items: [
            {
              id: "google-korean-1984",
              volumeInfo: {
                title: "1984",
                authors: ["조지 오웰"],
                language: "ko",
              },
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({ docs: [] });
      }

      if (requestUrl.includes("reading-room.typesense.net")) {
        return Response.json({ success: true });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("1984", { limit: 1 });

    expect(results[0]).toMatchObject({
      provider: "google",
      providerId: "google-korean-1984",
      language: "ko",
    });
  });

  it("uses Korean providers before curated fallback when Kakao and Naver keys are configured", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "kakao-test-key");
    vi.stubEnv("NAVER_CLIENT_ID", "naver-client-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "naver-client-secret");

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://dapi.kakao.com/v3/search/book")) {
        return Response.json({
          documents: [
            {
              title: "모순",
              contents: "양귀자의 대표 장편소설.",
              url: "https://search.daum.net/book/123",
              isbn: "8998441015 9788998441012",
              datetime: "2013-04-01T00:00:00.000+09:00",
              authors: ["양귀자"],
              publisher: "쓰다",
              translators: [],
              price: 13000,
              sale_price: 11700,
              thumbnail: "http://t1.daumcdn.net/book/cover.jpg",
              status: "정상판매",
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openapi.naver.com/v1/search/book.json")) {
        return Response.json({ items: [] });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return new Response(null, { status: 400 });
      }

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({ items: [] });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("모순", { limit: 3 });

    expect(results[0]).toMatchObject({
      provider: "kakao",
      providerId: "9788998441012",
      title: "모순",
      authors: ["양귀자"],
    });
  });

  it("filters Kakao and Naver results that have no Korean-market metadata", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "kakao-test-key");
    vi.stubEnv("NAVER_CLIENT_ID", "naver-client-id");
    vi.stubEnv("NAVER_CLIENT_SECRET", "naver-client-secret");

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://dapi.kakao.com/v3/search/book")) {
        return Response.json({
          documents: [
            {
              title: "1984",
              contents: "A dystopian novel in English.",
              url: "https://search.daum.net/book/en-1984",
              isbn: "0451524934 9780451524935",
              datetime: "1950-01-01T00:00:00.000+09:00",
              authors: ["George Orwell"],
              publisher: "Signet Classics",
              thumbnail: "",
              status: "정상판매",
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openapi.naver.com/v1/search/book.json")) {
        return Response.json({
          items: [
            {
              title: "1984",
              author: "George Orwell",
              publisher: "Penguin",
              isbn: "0451524934 9780451524935",
              description: "A dystopian novel in English.",
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({ items: [] });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({ docs: [] });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(searchBooks("1984", { limit: 3 })).resolves.toEqual([]);
  });

  it("prioritizes author matches for short Korean author-name searches", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "kakao-test-key");

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.startsWith("https://dapi.kakao.com/v3/search/book")) {
        return Response.json({
          documents: [
            {
              title: "한강",
              contents: "강과 도시를 다룬 국내서.",
              url: "https://search.daum.net/book/river",
              isbn: "9790000000001",
              datetime: "2020-01-01T00:00:00.000+09:00",
              authors: ["다른 저자"],
              publisher: "국내출판사",
              thumbnail: "",
            },
            {
              title: "소년이 온다",
              contents: "한강 작가의 장편소설.",
              url: "https://search.daum.net/book/human-acts",
              isbn: "9788936434120",
              datetime: "2014-05-19T00:00:00.000+09:00",
              authors: ["한강"],
              publisher: "창비",
              thumbnail: "",
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({ items: [] });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({ docs: [] });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("한강", { limit: 2 });

    expect(results[0]).toMatchObject({
      provider: "kakao",
      title: "소년이 온다",
      authors: ["한강"],
    });
  });

  it("does not wait for Typesense upserts before returning provider results", async () => {
    vi.stubEnv("TYPESENSE_HOST", "reading-room.typesense.net");
    vi.stubEnv("TYPESENSE_PORT", "443");
    vi.stubEnv("TYPESENSE_PROTOCOL", "https");
    vi.stubEnv("TYPESENSE_API_KEY", "typesense-key");

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (
        requestUrl.startsWith(
          "https://reading-room.typesense.net/collections/books/documents/search",
        )
      ) {
        return Response.json({ hits: [] });
      }

      if (
        requestUrl === "https://reading-room.typesense.net/collections/books"
      ) {
        return new Promise<Response>(() => undefined);
      }

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({
          items: [
            {
              id: "google-korean-1984",
              volumeInfo: {
                title: "1984",
                authors: ["조지 오웰"],
                language: "ko",
              },
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({ docs: [] });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await Promise.race([
      searchBooks("1984", { limit: 1 }),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 30),
      ),
    ]);

    expect(result).not.toBe("timeout");
    expect(result).toEqual([
      expect.objectContaining({
        provider: "google",
        providerId: "google-korean-1984",
      }),
    ]);
  });

  it("falls back to global external providers when Typesense is configured but unavailable", async () => {
    vi.stubEnv("TYPESENSE_HOST", "reading-room.typesense.net");
    vi.stubEnv("TYPESENSE_PORT", "443");
    vi.stubEnv("TYPESENSE_PROTOCOL", "https");
    vi.stubEnv("TYPESENSE_API_KEY", "typesense-key");

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);

      if (requestUrl.includes("reading-room.typesense.net")) {
        return new Response(null, { status: 503 });
      }

      if (requestUrl.startsWith("https://openlibrary.org/search.json")) {
        return Response.json({
          docs: [
            {
              key: "/works/OL262758W",
              title: "Pachinko",
              author_name: ["Min Jin Lee"],
              isbn: ["9781455563937"],
            },
          ],
        });
      }

      if (requestUrl.startsWith("https://www.googleapis.com/books/v1/volumes")) {
        return Response.json({ items: [] });
      }

      return new Response(null, { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await searchBooks("pachinko", {
      limit: 3,
      market: "global",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("reading-room.typesense.net"),
      expect.any(Object),
    );
    expect(results[0]).toMatchObject({
      provider: "open-library",
      providerId: "OL262758W",
      title: "Pachinko",
    });
  });
});
