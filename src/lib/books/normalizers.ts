import type { BookSearchResult } from "@/lib/books/types";

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    industryIdentifiers?: { type?: string; identifier?: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    pageCount?: number;
    publishedDate?: string;
    language?: string;
    description?: string;
  };
  searchInfo?: {
    textSnippet?: string;
  };
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  language?: string[];
  edition_count?: number;
  ratings_average?: number;
  ratings_count?: number;
  want_to_read_count?: number;
  already_read_count?: number;
  currently_reading_count?: number;
};

type KakaoBookDocument = {
  title?: string;
  contents?: string;
  url?: string;
  isbn?: string;
  datetime?: string;
  authors?: string[];
  publisher?: string;
  translators?: string[];
  price?: number;
  sale_price?: number;
  thumbnail?: string;
  status?: string;
};

type NaverBookItem = {
  title?: string;
  link?: string;
  image?: string;
  author?: string;
  discount?: string;
  publisher?: string;
  pubdate?: string;
  isbn?: string;
  description?: string;
};

function normalizeCoverUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  return url.replace(/^http:\/\//, "https://");
}

function publishedYear(date: string | undefined): number | null {
  if (!date) {
    return null;
  }
  const match = /^(\d{4})/.exec(date);
  return match ? Number(match[1]) : null;
}

function publishedYearFromCompactDate(date: string | undefined): number | null {
  if (!date) {
    return null;
  }
  const match = /^(\d{4})/.exec(date);
  return match ? Number(match[1]) : null;
}

function stripHtml(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  return cleaned || null;
}

function findIsbn(
  identifiers: { type?: string; identifier?: string }[] | undefined,
  type: "ISBN_10" | "ISBN_13",
): string | null {
  return (
    identifiers?.find((identifier) => identifier.type === type)?.identifier ??
    null
  );
}

function findOpenLibraryIsbn(
  isbns: string[] | undefined,
  length: 10 | 13,
): string | null {
  return isbns?.find((isbn) => isbn.replaceAll("-", "").length === length) ?? null;
}

function isbnCandidates(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : (value?.split(/\s+/) ?? []);

  return values
    .map((isbn) => isbn.replaceAll("-", "").trim())
    .filter((isbn) => /^[0-9Xx]{10,13}$/.test(isbn));
}

function findIsbnCandidate(
  value: string | string[] | undefined,
  length: 10 | 13,
): string | null {
  return isbnCandidates(value).find((isbn) => isbn.length === length) ?? null;
}

function providerIdFromMetadata(
  isbn13: string | null,
  isbn10: string | null,
  fallback: string | undefined,
): string {
  return isbn13 ?? isbn10 ?? fallback?.trim() ?? crypto.randomUUID();
}

function splitNaverAuthors(author: string | undefined): string[] {
  const cleaned = stripHtml(author);
  if (!cleaned) {
    return [];
  }

  return cleaned
    .split(/\s*\|\s*|\s*,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function normalizeGoogleVolume(volume: GoogleVolume): BookSearchResult {
  const info = volume.volumeInfo ?? {};

  return {
    provider: "google",
    providerId: volume.id ?? crypto.randomUUID(),
    title: info.title?.trim() || "제목 없는 책",
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    isbn10: findIsbn(info.industryIdentifiers, "ISBN_10"),
    isbn13: findIsbn(info.industryIdentifiers, "ISBN_13"),
    coverUrl: normalizeCoverUrl(
      info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail,
    ),
    pageCount: info.pageCount ?? null,
    publishedYear: publishedYear(info.publishedDate),
    language: info.language ?? null,
    description: info.description ?? null,
    raw: volume,
  };
}

export function normalizeOpenLibraryDoc(doc: OpenLibraryDoc): BookSearchResult {
  const providerId = doc.key?.split("/").filter(Boolean).at(-1) ?? doc.title ?? "";

  return {
    provider: "open-library",
    providerId,
    title: doc.title?.trim() || "제목 없는 책",
    subtitle: null,
    authors: doc.author_name ?? [],
    isbn10: findOpenLibraryIsbn(doc.isbn, 10),
    isbn13: findOpenLibraryIsbn(doc.isbn, 13),
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null,
    pageCount: null,
    publishedYear: doc.first_publish_year ?? null,
    language: doc.language?.[0] ?? null,
    description: null,
    raw: doc,
  };
}

export function normalizeKakaoBook(doc: KakaoBookDocument): BookSearchResult {
  const isbn10 = findIsbnCandidate(doc.isbn, 10);
  const isbn13 = findIsbnCandidate(doc.isbn, 13);
  const title = stripHtml(doc.title) ?? "제목 없는 책";

  return {
    provider: "kakao",
    providerId: providerIdFromMetadata(isbn13, isbn10, doc.url ?? title),
    title,
    subtitle: null,
    authors: doc.authors ?? [],
    isbn10,
    isbn13,
    coverUrl: normalizeCoverUrl(doc.thumbnail),
    pageCount: null,
    publishedYear: publishedYear(doc.datetime),
    language: "kor",
    description: stripHtml(doc.contents),
    raw: doc,
  };
}

export function normalizeNaverBook(item: NaverBookItem): BookSearchResult {
  const isbn10 = findIsbnCandidate(item.isbn, 10);
  const isbn13 = findIsbnCandidate(item.isbn, 13);
  const title = stripHtml(item.title) ?? "제목 없는 책";

  return {
    provider: "naver",
    providerId: providerIdFromMetadata(isbn13, isbn10, item.link ?? title),
    title,
    subtitle: null,
    authors: splitNaverAuthors(item.author),
    isbn10,
    isbn13,
    coverUrl: normalizeCoverUrl(item.image),
    pageCount: null,
    publishedYear: publishedYearFromCompactDate(item.pubdate),
    language: "kor",
    description: stripHtml(item.description),
    raw: item,
  };
}
