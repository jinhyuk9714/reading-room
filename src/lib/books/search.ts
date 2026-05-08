import {
  normalizeGoogleVolume,
  normalizeKakaoBook,
  normalizeNaverBook,
  normalizeOpenLibraryDoc,
} from "@/lib/books/normalizers";
import { searchCuratedKoreanBooks } from "@/lib/books/curated-korean";
import type { BookProvider, BookSearchResult } from "@/lib/books/types";
import {
  searchTypesenseBooks,
  upsertTypesenseBooks,
} from "@/lib/books/typesense";

type GoogleResponse = {
  items?: Parameters<typeof normalizeGoogleVolume>[0][];
};

type OpenLibraryResponse = {
  docs?: Parameters<typeof normalizeOpenLibraryDoc>[0][];
};

type KakaoResponse = {
  documents?: Parameters<typeof normalizeKakaoBook>[0][];
};

type NaverResponse = {
  items?: Parameters<typeof normalizeNaverBook>[0][];
};

type SearchMarket = "kr" | "global";

type SearchOptions = {
  limit?: number;
  market?: SearchMarket;
};

type ScoredBook = {
  book: BookSearchResult;
  score: number;
  sourceRank: number;
};

const SOURCE_RANK: Record<BookProvider, number> = {
  kakao: 0,
  naver: 1,
  manual: 2,
  "open-library": 3,
  google: 4,
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function canonicalTitleAliases(query: string): string[] {
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery === "1984") {
    return ["nineteeneightyfour"];
  }
  if (
    normalizedQuery === "nineteeneightyfour" ||
    normalizedQuery === "nineteen84"
  ) {
    return ["1984"];
  }

  return [];
}

function domesticQueryAliases(query: string): string[] {
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery === "1984") {
    return ["Nineteen Eighty-Four"];
  }
  if (
    normalizedQuery === "nineteeneightyfour" ||
    normalizedQuery === "nineteen84"
  ) {
    return ["1984"];
  }

  return [];
}

function normalizedIsbn(value: string | null): string | null {
  return value?.replaceAll("-", "").toUpperCase() ?? null;
}

function isIsbnQuery(query: string): boolean {
  return /^[0-9Xx\-\s]{10,17}$/.test(query.trim());
}

function hasHangul(query: string): boolean {
  return /[가-힣]/.test(query);
}

function hasKoreanText(value: string | null | undefined): boolean {
  return Boolean(value && hasHangul(value));
}

function hasKoreanMetadata(book: BookSearchResult): boolean {
  const language = book.language?.toLowerCase();

  return (
    language === "ko" ||
    language === "kor" ||
    hasKoreanText(book.title) ||
    hasKoreanText(book.subtitle) ||
    hasKoreanText(book.description) ||
    book.authors.some(hasKoreanText)
  );
}

function hasKoreanProviderMetadata(book: BookSearchResult): boolean {
  return (
    hasKoreanText(book.title) ||
    hasKoreanText(book.subtitle) ||
    hasKoreanText(book.description) ||
    book.authors.some(hasKoreanText) ||
    hasKoreanText(rawNestedString(book.raw, ["publisher"])) ||
    hasKoreanText(rawNestedString(book.raw, ["contents"]))
  );
}

function isKoreanMarketEdition(book: BookSearchResult): boolean {
  switch (book.provider) {
    case "kakao":
    case "naver":
      return hasKoreanProviderMetadata(book);
    case "manual":
      return true;
    case "google":
      return hasKoreanMetadata(book);
    case "open-library":
      return false;
  }
}

function filterMarketBooks(
  books: BookSearchResult[],
  market: SearchMarket,
): BookSearchResult[] {
  if (market === "global") {
    return books;
  }

  return books.filter(isKoreanMarketEdition);
}

function bookKey(book: BookSearchResult): string {
  const isbn13 = normalizedIsbn(book.isbn13);
  const isbn10 = normalizedIsbn(book.isbn10);

  return (
    isbn13 ??
    isbn10 ??
    `${normalizeSearchText(book.title)}::${book.authors
      .map(normalizeSearchText)
      .join(",")}`
  );
}

function numberFromRaw(raw: unknown, key: string): number {
  if (!raw || typeof raw !== "object" || !(key in raw)) {
    return 0;
  }

  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rawNestedString(raw: unknown, path: string[]): string {
  let current = raw;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return "";
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : "";
}

function providerPopularity(book: BookSearchResult): number {
  return (
    Math.log1p(numberFromRaw(book.raw, "edition_count")) * 8 +
    Math.log1p(numberFromRaw(book.raw, "ratings_count")) * 4 +
    Math.log1p(numberFromRaw(book.raw, "want_to_read_count")) * 3 +
    Math.log1p(numberFromRaw(book.raw, "already_read_count")) * 2 +
    Math.log1p(numberFromRaw(book.raw, "currently_reading_count")) * 2
  );
}

function sourceScore(provider: BookProvider): number {
  switch (provider) {
    case "kakao":
      return 45;
    case "naver":
      return 38;
    case "manual":
      return 32;
    case "open-library":
      return 30;
    case "google":
      return 10;
  }
}

function isLikelyKoreanAuthorQuery(query: string): boolean {
  return /^[가-힣]{2,4}$/.test(query.trim());
}

function scoreBook(query: string, book: BookSearchResult): ScoredBook {
  const normalizedQuery = normalizeSearchText(query);
  const titleAliases = canonicalTitleAliases(query);
  const normalizedTitle = normalizeSearchText(book.title);
  const normalizedAuthors = book.authors.map(normalizeSearchText);
  const joinedAuthors = normalizedAuthors.join("");
  const isbnQuery = query.replaceAll("-", "").replace(/\s+/g, "").toUpperCase();
  const titleExact =
    normalizedQuery === normalizedTitle || titleAliases.includes(normalizedTitle);
  const titleStartsWith = normalizedTitle.startsWith(normalizedQuery);
  const titleContains = normalizedTitle.includes(normalizedQuery);
  const authorMatches = normalizedAuthors.some(
    (author) => author.includes(normalizedQuery) || normalizedQuery.includes(author),
  );
  const isbnMatches =
    Boolean(isbnQuery) &&
    (normalizedIsbn(book.isbn10) === isbnQuery ||
      normalizedIsbn(book.isbn13) === isbnQuery);

  let score = sourceScore(book.provider) + providerPopularity(book);
  const likelyKoreanAuthorQuery = isLikelyKoreanAuthorQuery(query);

  if (isbnMatches) {
    score += 500;
  }
  if (titleExact) {
    score += 300;
  } else if (titleStartsWith) {
    score += 210;
  } else if (titleContains) {
    score += 150;
  }
  if (authorMatches) {
    score +=
      likelyKoreanAuthorQuery && !titleExact && !titleContains
        ? 360
        : titleExact || titleContains
          ? 70
          : 90;
  }
  if (normalizedQuery && joinedAuthors && normalizedQuery.includes(joinedAuthors)) {
    score += 40;
  }

  const googleSnippet = rawNestedString(book.raw, ["searchInfo", "textSnippet"]);
  const googleDescription = rawNestedString(book.raw, ["volumeInfo", "description"]);
  const onlySnippetMatch =
    book.provider === "google" &&
    !isbnMatches &&
    !titleContains &&
    !authorMatches &&
    normalizeSearchText(`${googleSnippet} ${googleDescription}`).includes(
      normalizedQuery,
    );

  if (onlySnippetMatch) {
    score -= 200;
  }

  return { book, score, sourceRank: SOURCE_RANK[book.provider] };
}

function mergeBooks(
  primary: BookSearchResult,
  secondary: BookSearchResult,
): BookSearchResult {
  return {
    ...primary,
    subtitle: primary.subtitle ?? secondary.subtitle,
    authors: primary.authors.length > 0 ? primary.authors : secondary.authors,
    isbn10: primary.isbn10 ?? secondary.isbn10,
    isbn13: primary.isbn13 ?? secondary.isbn13,
    coverUrl: primary.coverUrl ?? secondary.coverUrl,
    pageCount: primary.pageCount ?? secondary.pageCount,
    publishedYear: primary.publishedYear ?? secondary.publishedYear,
    language: primary.language ?? secondary.language,
    description: primary.description ?? secondary.description,
  };
}

function rankAndDedupe(
  query: string,
  books: BookSearchResult[],
  limit: number,
): BookSearchResult[] {
  const scored = books
    .map((book) => scoreBook(query, book))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.sourceRank - right.sourceRank ||
        left.book.title.localeCompare(right.book.title),
    );

  const merged = new Map<string, BookSearchResult>();

  for (const { book } of scored) {
    const key = bookKey(book);
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, mergeBooks(existing, book));
      continue;
    }

    merged.set(key, book);
  }

  return [...merged.values()].slice(0, limit);
}

async function searchKakaoBooks(
  query: string,
  limit: number,
): Promise<BookSearchResult[]> {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  try {
    const url = new URL("https://dapi.kakao.com/v3/search/book");
    url.searchParams.set("query", query);
    url.searchParams.set("sort", "accuracy");
    url.searchParams.set("size", String(Math.min(Math.max(limit, 1), 50)));

    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as KakaoResponse;
    return (payload.documents ?? []).map(normalizeKakaoBook);
  } catch {
    return [];
  }
}

async function searchNaverBooks(
  query: string,
  limit: number,
): Promise<BookSearchResult[]> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return [];
  }

  try {
    const url = new URL("https://openapi.naver.com/v1/search/book.json");
    url.searchParams.set("query", query);
    url.searchParams.set("display", String(Math.min(Math.max(limit, 1), 100)));
    url.searchParams.set("sort", "sim");

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as NaverResponse;
    return (payload.items ?? []).map(normalizeNaverBook);
  } catch {
    return [];
  }
}

function shouldSearchOpenLibraryTitle(query: string): boolean {
  return !hasHangul(query) && !isIsbnQuery(query) && query.trim().length <= 80;
}

async function fetchOpenLibrary(
  query: string,
  limit: number,
  searchMode: "q" | "title",
): Promise<BookSearchResult[]> {
  try {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set(searchMode, query);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 50)));
    url.searchParams.set(
      "fields",
      [
        "key",
        "title",
        "author_name",
        "isbn",
        "cover_i",
        "first_publish_year",
        "language",
        "edition_count",
        "ratings_average",
        "ratings_count",
        "want_to_read_count",
        "already_read_count",
        "currently_reading_count",
      ].join(","),
    );

    const response = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as OpenLibraryResponse;
    return (payload.docs ?? []).map(normalizeOpenLibraryDoc);
  } catch {
    return [];
  }
}

async function searchOpenLibrary(
  query: string,
  limit: number,
): Promise<BookSearchResult[]> {
  const searches = [fetchOpenLibrary(query, limit, "q")];

  if (shouldSearchOpenLibraryTitle(query)) {
    searches.push(fetchOpenLibrary(query, limit, "title"));
  }

  const results = await Promise.all(searches);
  return results.flat();
}

function googleQuery(query: string): string {
  if (isIsbnQuery(query)) {
    return `isbn:${query.replaceAll("-", "").replace(/\s+/g, "")}`;
  }

  return `intitle:${query}`;
}

async function searchGoogleBooks(
  query: string,
  limit: number,
  market: SearchMarket,
): Promise<BookSearchResult[]> {
  try {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", googleQuery(query));
    url.searchParams.set("maxResults", String(Math.min(Math.max(limit, 1), 40)));
    url.searchParams.set("printType", "books");
    if (market === "kr") {
      url.searchParams.set("langRestrict", "ko");
    }
    if (process.env.GOOGLE_BOOKS_API_KEY) {
      url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
    }

    const response = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as GoogleResponse;
    return (payload.items ?? []).map(normalizeGoogleVolume);
  } catch {
    return [];
  }
}

async function searchProviderBooks(
  query: string,
  limit: number,
  market: SearchMarket,
): Promise<BookSearchResult[]> {
  const providerLimit = Math.min(Math.max(limit * 3, 12), 40);
  const koreanFirst = hasHangul(query);
  const queries = market === "kr" ? [query, ...domesticQueryAliases(query)] : [query];

  if (market === "kr") {
    const domesticSearches = queries.flatMap((providerQuery) => [
      searchKakaoBooks(providerQuery, providerLimit),
      searchNaverBooks(providerQuery, providerLimit),
      searchGoogleBooks(providerQuery, providerLimit, market),
    ]);
    const results = await Promise.all([
      ...domesticSearches,
      searchOpenLibrary(query, providerLimit),
    ]);

    return results.flat();
  }

  const providers = koreanFirst
    ? [
        searchKakaoBooks(query, providerLimit),
        searchNaverBooks(query, providerLimit),
        searchOpenLibrary(query, providerLimit),
        searchGoogleBooks(query, providerLimit, market),
      ]
    : [
        searchOpenLibrary(query, providerLimit),
        searchGoogleBooks(query, providerLimit, market),
        searchKakaoBooks(query, providerLimit),
        searchNaverBooks(query, providerLimit),
      ];

  const results = await Promise.all(providers);
  return results.flat();
}

function hasEnoughStrongTypesenseResults(
  query: string,
  books: BookSearchResult[],
  limit: number,
): boolean {
  if (books.length < limit) {
    return false;
  }

  const topScore = books.length > 0 ? scoreBook(query, books[0]).score : 0;
  return topScore >= 240;
}

export async function searchBooks(
  query: string,
  { limit = 12, market = "kr" }: SearchOptions = {},
): Promise<BookSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const typesenseBooks = filterMarketBooks(
    await searchTypesenseBooks(trimmedQuery, safeLimit),
    market,
  );
  const providerBooks = hasEnoughStrongTypesenseResults(
    trimmedQuery,
    typesenseBooks,
    safeLimit,
  )
    ? []
    : await searchProviderBooks(trimmedQuery, safeLimit, market);
  const curatedKoreanBooks = searchCuratedKoreanBooks(trimmedQuery, safeLimit);

  const ranked = rankAndDedupe(
    trimmedQuery,
    filterMarketBooks(
      [...typesenseBooks, ...providerBooks, ...curatedKoreanBooks],
      market,
    ),
    safeLimit,
  );

  void upsertTypesenseBooks(ranked).catch(() => undefined);

  return ranked;
}
