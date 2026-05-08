import type { BookProvider, BookSearchResult } from "@/lib/books/types";

type TypesenseBookDocument = {
  id: string;
  provider: BookProvider;
  providerId: string;
  title: string;
  subtitle?: string;
  authors: string[];
  isbn10?: string;
  isbn13?: string;
  coverUrl?: string;
  pageCount?: number;
  publishedYear?: number;
  language?: string;
  description?: string;
  popularityScore: number;
  sourcePriority: number;
  appAddsCount: number;
  appLogsCount: number;
  lastSeenAt: number;
};

type TypesenseSearchResponse = {
  hits?: { document?: TypesenseBookDocument }[];
};

let collectionEnsured = false;

function configuredCollection() {
  return process.env.TYPESENSE_COLLECTION?.trim() || "books";
}

function hasTypesenseConfig() {
  return Boolean(
    process.env.TYPESENSE_HOST?.trim() &&
      process.env.TYPESENSE_API_KEY?.trim(),
  );
}

function typesenseUrl(path: string): URL | null {
  const host = process.env.TYPESENSE_HOST?.trim();
  const apiKey = process.env.TYPESENSE_API_KEY?.trim();

  if (!host || !apiKey) {
    return null;
  }

  const protocol = process.env.TYPESENSE_PROTOCOL?.trim() || "https";
  const port = process.env.TYPESENSE_PORT?.trim() || "443";
  const base = host.startsWith("http://") || host.startsWith("https://")
    ? new URL(host)
    : new URL(`${protocol}://${host}`);

  if (!base.port && port) {
    base.port = port;
  }
  base.pathname = path;

  return base;
}

function sourcePriority(provider: BookProvider): number {
  switch (provider) {
    case "kakao":
      return 10;
    case "naver":
      return 20;
    case "manual":
      return 30;
    case "open-library":
      return 40;
    case "google":
      return 50;
  }
}

function stableDocumentId(book: BookSearchResult): string {
  return (
    book.isbn13?.replaceAll("-", "") ??
    book.isbn10?.replaceAll("-", "") ??
    `${book.provider}:${book.providerId}`
  );
}

function numberFromRaw(raw: unknown, key: string): number {
  if (!raw || typeof raw !== "object" || !(key in raw)) {
    return 0;
  }
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function popularityScore(book: BookSearchResult): number {
  const editionCount = numberFromRaw(book.raw, "edition_count");
  const ratingsCount = numberFromRaw(book.raw, "ratings_count");
  const wantToReadCount = numberFromRaw(book.raw, "want_to_read_count");
  const alreadyReadCount = numberFromRaw(book.raw, "already_read_count");
  const currentlyReadingCount = numberFromRaw(book.raw, "currently_reading_count");

  return (
    Math.log1p(editionCount) * 8 +
    Math.log1p(ratingsCount) * 4 +
    Math.log1p(wantToReadCount) * 3 +
    Math.log1p(alreadyReadCount) * 2 +
    Math.log1p(currentlyReadingCount) * 2
  );
}

function toTypesenseDocument(book: BookSearchResult): TypesenseBookDocument {
  return {
    id: stableDocumentId(book),
    provider: book.provider,
    providerId: book.providerId,
    title: book.title,
    subtitle: book.subtitle ?? undefined,
    authors: book.authors,
    isbn10: book.isbn10 ?? undefined,
    isbn13: book.isbn13 ?? undefined,
    coverUrl: book.coverUrl ?? undefined,
    pageCount: book.pageCount ?? undefined,
    publishedYear: book.publishedYear ?? undefined,
    language: book.language ?? undefined,
    description: book.description ?? undefined,
    popularityScore: popularityScore(book),
    sourcePriority: sourcePriority(book.provider),
    appAddsCount: 0,
    appLogsCount: 0,
    lastSeenAt: Date.now(),
  };
}

function toSearchResult(document: TypesenseBookDocument): BookSearchResult {
  return {
    provider: document.provider,
    providerId: document.providerId,
    title: document.title,
    subtitle: document.subtitle ?? null,
    authors: document.authors ?? [],
    isbn10: document.isbn10 ?? null,
    isbn13: document.isbn13 ?? null,
    coverUrl: document.coverUrl ?? null,
    pageCount: document.pageCount ?? null,
    publishedYear: document.publishedYear ?? null,
    language: document.language ?? null,
    description: document.description ?? null,
    raw: { source: "typesense", document },
  };
}

async function ensureTypesenseCollection() {
  if (collectionEnsured || !hasTypesenseConfig()) {
    return;
  }

  const collection = configuredCollection();
  const collectionUrl = typesenseUrl(`/collections/${collection}`);
  const createUrl = typesenseUrl("/collections");
  const apiKey = process.env.TYPESENSE_API_KEY?.trim();

  if (!collectionUrl || !createUrl || !apiKey) {
    return;
  }

  const headers = { "X-TYPESENSE-API-KEY": apiKey };
  const existing = await fetch(collectionUrl.toString(), { headers });

  if (existing.ok) {
    collectionEnsured = true;
    return;
  }
  if (existing.status !== 404) {
    throw new Error("Typesense collection check failed.");
  }

  const created = await fetch(createUrl.toString(), {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: collection,
      fields: [
        { name: "provider", type: "string", facet: true },
        { name: "providerId", type: "string" },
        { name: "title", type: "string" },
        { name: "subtitle", type: "string", optional: true },
        { name: "authors", type: "string[]", facet: true },
        { name: "isbn10", type: "string", optional: true },
        { name: "isbn13", type: "string", optional: true },
        { name: "coverUrl", type: "string", optional: true },
        { name: "pageCount", type: "int32", optional: true },
        { name: "publishedYear", type: "int32", optional: true, facet: true },
        { name: "language", type: "string", optional: true, facet: true },
        { name: "description", type: "string", optional: true },
        { name: "popularityScore", type: "float" },
        { name: "sourcePriority", type: "int32" },
        { name: "appAddsCount", type: "int32" },
        { name: "appLogsCount", type: "int32" },
        { name: "lastSeenAt", type: "int64" },
      ],
      default_sorting_field: "popularityScore",
    }),
  });

  if (!created.ok) {
    throw new Error("Typesense collection creation failed.");
  }

  collectionEnsured = true;
}

export async function searchTypesenseBooks(
  query: string,
  limit: number,
): Promise<BookSearchResult[]> {
  if (!hasTypesenseConfig()) {
    return [];
  }

  const collection = configuredCollection();
  const url = typesenseUrl(`/collections/${collection}/documents/search`);
  const apiKey = process.env.TYPESENSE_API_KEY?.trim();

  if (!url || !apiKey) {
    return [];
  }

  url.searchParams.set("q", query);
  url.searchParams.set("query_by", "title,authors,subtitle,description");
  url.searchParams.set("query_by_weights", "6,4,2,1");
  url.searchParams.set("per_page", String(Math.min(Math.max(limit, 1), 50)));
  url.searchParams.set(
    "sort_by",
    "_text_match:desc,popularityScore:desc,sourcePriority:asc",
  );

  try {
    const response = await fetch(url.toString(), {
      headers: { "X-TYPESENSE-API-KEY": apiKey },
      next: { revalidate: 60 * 5 },
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as TypesenseSearchResponse;
    return (payload.hits ?? [])
      .map((hit) => hit.document)
      .filter((document): document is TypesenseBookDocument => Boolean(document))
      .map(toSearchResult);
  } catch {
    return [];
  }
}

export async function upsertTypesenseBooks(
  books: BookSearchResult[],
): Promise<void> {
  if (!hasTypesenseConfig() || books.length === 0) {
    return;
  }

  const collection = configuredCollection();
  const url = typesenseUrl(`/collections/${collection}/documents/import`);
  const apiKey = process.env.TYPESENSE_API_KEY?.trim();

  if (!url || !apiKey) {
    return;
  }

  url.searchParams.set("action", "upsert");

  await ensureTypesenseCollection();

  const body = books.map((book) => JSON.stringify(toTypesenseDocument(book))).join("\n");
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "X-TYPESENSE-API-KEY": apiKey,
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Typesense import failed.");
  }
}
