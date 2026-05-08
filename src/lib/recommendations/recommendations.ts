import { searchBooks } from "@/lib/books/search";
import type { BookSearchResult } from "@/lib/books/types";
import type { RecommendationCard } from "@/lib/recommendations/types";

type RecommendationOptions = {
  limit?: number;
};

type ResponsesApiPayload = {
  output_text?: unknown;
  output?: {
    content?: {
      text?: unknown;
    }[];
  }[];
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 6;
  }
  return Math.min(Math.max(Math.trunc(limit ?? 6), 1), 12);
}

function fallbackReason(query: string): string {
  return `Matched your request for "${query}".`;
}

function comparableTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function searchKey(book: BookSearchResult): string {
  return `${book.provider}:${book.providerId}`;
}

function extractLibrarySignals(query: string) {
  const titles = new Set<string>();
  const searchTerms: string[] = [];
  const bookLinePattern = /^- (.+?) by (.+?)(?:;|$)/gim;

  for (const match of query.matchAll(bookLinePattern)) {
    const title = match[1]?.trim();
    const authors = match[2]
      ?.split(",")
      .map((author) => author.trim())
      .filter(Boolean);

    if (title) {
      titles.add(comparableTitle(title));
    }

    const primaryAuthor = authors?.[0];
    if (primaryAuthor) {
      searchTerms.push(primaryAuthor);
    }
    if (title) {
      searchTerms.push(title);
    }
  }

  return { searchTerms, titles };
}

function fallbackSearchQueries(query: string): string[] {
  const { searchTerms } = extractLibrarySignals(query);
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const candidate of [query, ...searchTerms]) {
    const trimmed = candidate.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }
    seen.add(key);
    queries.push(trimmed);
  }

  return queries;
}

function cardFromSearchResult(
  book: BookSearchResult,
  query: string,
): RecommendationCard {
  return {
    title: book.title,
    authors: book.authors,
    reason: fallbackReason(query),
    source: "search-fallback",
    provider: book.provider,
    providerId: book.providerId,
    coverUrl: book.coverUrl,
    pageCount: book.pageCount,
  };
}

function cardCatalogQuery(card: RecommendationCard): string {
  return [card.title, card.authors[0]].filter(Boolean).join(" ");
}

async function revalidateKoreanCatalogCards(
  cards: RecommendationCard[],
  limit: number,
): Promise<RecommendationCard[]> {
  const revalidated: RecommendationCard[] = [];
  const seen = new Set<string>();

  for (const card of cards) {
    const query = cardCatalogQuery(card);
    if (!query) {
      continue;
    }

    const results = await searchBooks(query, {
      limit: Math.max(limit, 3),
      market: "kr",
    });
    const book = results[0];
    if (!book) {
      continue;
    }

    const key = searchKey(book);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    revalidated.push({
      ...cardFromSearchResult(book, query),
      reason: card.reason,
      source: card.source,
    });

    if (revalidated.length >= limit) {
      return revalidated;
    }
  }

  return revalidated;
}

async function fallbackRecommendations(
  query: string,
  limit: number,
): Promise<RecommendationCard[]> {
  const { titles } = extractLibrarySignals(query);
  const seen = new Set<string>();
  const cards: RecommendationCard[] = [];

  for (const searchQuery of fallbackSearchQueries(query)) {
    const searchLimit = searchQuery === query ? limit : limit * 3;
    const results = await searchBooks(searchQuery, {
      limit: searchLimit,
      market: "kr",
    });

    for (const book of results) {
      if (titles.has(comparableTitle(book.title))) {
        continue;
      }

      const key = searchKey(book);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      cards.push(cardFromSearchResult(book, searchQuery));
      if (cards.length >= limit) {
        return cards;
      }
    }
  }

  return cards;
}

function isRecommendationCard(value: unknown): value is RecommendationCard {
  if (!value || typeof value !== "object") {
    return false;
  }

  const card = value as Record<string, unknown>;
  return (
    typeof card.title === "string" &&
    Array.isArray(card.authors) &&
    card.authors.every((author) => typeof author === "string") &&
    typeof card.reason === "string" &&
    typeof card.source === "string" &&
    typeof card.provider === "string" &&
    typeof card.providerId === "string" &&
    (typeof card.coverUrl === "string" || card.coverUrl === null) &&
    (typeof card.pageCount === "number" || card.pageCount === null)
  );
}

function responseText(payload: ResponsesApiPayload): string | null {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

function parseRecommendationCards(text: string, limit: number): RecommendationCard[] {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isRecommendationCard).slice(0, limit);
}

async function aiRecommendations(
  query: string,
  limit: number,
): Promise<RecommendationCard[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_RECOMMENDATIONS_MODEL?.trim();
  if (!apiKey || !model) {
    return [];
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "Recommend Korean-market book editions for a reading room app. Return only a JSON array of objects with exactly these keys: title, authors, reason, source, provider, providerId, coverUrl, pageCount. Use source \"openai\" and provider \"manual\" when catalog metadata is unknown; the app will verify each recommendation against its Korean catalog before showing it.",
        },
        {
          role: "user",
          content: `Query: ${query}\nLimit: ${limit}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as ResponsesApiPayload;
  const text = responseText(payload);
  const parsed = text ? parseRecommendationCards(text, limit) : [];
  return revalidateKoreanCatalogCards(parsed, limit);
}

export async function getRecommendations(
  query: string,
  { limit: requestedLimit = 6 }: RecommendationOptions = {},
): Promise<RecommendationCard[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const limit = normalizeLimit(requestedLimit);

  try {
    const results = await aiRecommendations(trimmedQuery, limit);
    if (results.length > 0) {
      return results;
    }
  } catch {
    // Fall through to search-backed recommendations.
  }

  return fallbackRecommendations(trimmedQuery, limit);
}
