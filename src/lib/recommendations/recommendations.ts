import { searchBooks } from "@/lib/books/search";
import type { BookSearchResult } from "@/lib/books/types";
import type {
  ExistingRecommendationBook,
  RecommendationCard,
  RecommendationEventSignal,
  RecommendationIntent,
  RecommendationMode,
  RecommendationOptions,
  RecommendationSection,
} from "@/lib/recommendations/types";

type ResponsesApiPayload = {
  output_text?: unknown;
  output?: {
    content?: {
      text?: unknown;
    }[];
  }[];
};

type LibrarySignals = {
  titles: Set<string>;
  searchTerms: string[];
  providerIds: Set<string>;
};

type PositiveRecommendationSignals = {
  titles: Set<string>;
  authors: Set<string>;
  terms: Set<string>;
};

type RecommendationContext = {
  mode: RecommendationMode;
  intent?: RecommendationIntent;
  blockedProviderIds: Set<string>;
  librarySignals: LibrarySignals;
  positiveSignals: PositiveRecommendationSignals;
};

type FallbackSearchPlan = {
  query: string;
  origin: "primary" | "purpose" | "library-title" | "library-author";
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const MODE_VALUES = new Set<RecommendationMode>([
  "feed",
  "purpose",
  "conversation",
]);

const KOREAN_MOOD_WORDS: Record<string, string> = {
  calm: "잔잔한",
  reflective: "사색적인",
  hopeful: "희망적인",
  cozy: "따뜻한",
};

const KOREAN_LENGTH_WORDS: Record<string, string> = {
  short: "짧은",
  medium: "적당한",
  long: "긴",
};

const KOREAN_DIFFICULTY_WORDS: Record<string, string> = {
  easy: "쉬운",
  medium: "보통 난이도의",
  deep: "깊이 있는",
};

const BLOCKING_EVENT_TYPES = new Set(["dismissed", "hidden", "excluded"]);
const POSITIVE_EVENT_TYPES = new Set(["opened", "saved", "added_to_library"]);

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 6;
  }
  return Math.min(Math.max(Math.trunc(limit ?? 6), 1), 12);
}

function normalizeMode(mode: string | undefined): RecommendationMode {
  return mode && MODE_VALUES.has(mode as RecommendationMode)
    ? (mode as RecommendationMode)
    : "feed";
}

function fallbackReason(query: string): string {
  return `"${query}"에 맞춰 고른 국내판 추천입니다.`;
}

function comparableText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function compactText(value: string): string {
  return comparableText(value).replaceAll(" ", "");
}

function textTokens(value: string): string[] {
  return comparableText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function searchKey(book: BookSearchResult): string {
  return `${book.provider}:${book.providerId}`;
}

function providerIdKeys(providerId: string, provider?: string): string[] {
  const keys = [providerId];
  if (provider) {
    keys.push(`${provider}:${providerId}`);
  }
  return keys.map((key) => key.toLowerCase());
}

function addProviderIds(
  target: Set<string>,
  ids: readonly string[] | undefined,
): void {
  for (const id of ids ?? []) {
    const trimmed = id.trim();
    if (trimmed) {
      target.add(trimmed.toLowerCase());
    }
  }
}

function addEventProviderId(
  target: Set<string>,
  signal: RecommendationEventSignal,
): void {
  const providerId = signal.providerId?.trim();
  if (!providerId) {
    return;
  }

  for (const key of providerIdKeys(providerId, signal.provider ?? undefined)) {
    target.add(key);
  }
}

function addPositiveSignalText(
  target: PositiveRecommendationSignals,
  signal: RecommendationEventSignal,
): void {
  const recommendation = signal.recommendation;
  const title =
    typeof recommendation?.title === "string" ? recommendation.title : null;
  if (title) {
    target.titles.add(comparableText(title));
    for (const token of textTokens(title)) {
      target.terms.add(token);
    }
  }

  const authors = Array.isArray(recommendation?.authors)
    ? recommendation.authors
    : [];
  for (const author of authors) {
    if (typeof author !== "string") {
      continue;
    }
    target.authors.add(comparableText(author));
    for (const token of textTokens(author)) {
      target.terms.add(token);
    }
  }
}

function modeFromQuery(query: string): RecommendationMode | undefined {
  const match = query.match(/^Recommendation mode:\s*(\w+)\.?$/im);
  const mode = match?.[1];
  return mode && MODE_VALUES.has(mode as RecommendationMode)
    ? (mode as RecommendationMode)
    : undefined;
}

function providerIdsFromQuery(query: string): string[] {
  const ids: string[] = [];
  const linePattern =
    /^(?:Previous|Hidden|Excluded) provider IDs:\s*(.+)$/gim;

  for (const match of query.matchAll(linePattern)) {
    ids.push(
      ...(match[1] ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  return ids;
}

function extractLibrarySignals(
  query: string,
  existingLibrary: readonly ExistingRecommendationBook[] = [],
): LibrarySignals {
  const titles = new Set<string>();
  const searchTerms: string[] = [];
  const providerIds = new Set<string>();
  const bookLinePattern = /^- (.+?) by (.+?)(?:;|$)/gim;

  for (const match of query.matchAll(bookLinePattern)) {
    const title = match[1]?.trim();
    const authors = match[2]
      ?.split(",")
      .map((author) => author.trim())
      .filter(Boolean);

    if (title) {
      titles.add(comparableText(title));
      searchTerms.push(title);
    }

    const primaryAuthor = authors?.[0];
    if (primaryAuthor) {
      searchTerms.unshift(primaryAuthor);
    }
  }

  for (const book of existingLibrary) {
    if (book.title) {
      titles.add(comparableText(book.title));
      searchTerms.push(book.title);
    }
    const primaryAuthor = book.authors?.find(Boolean);
    if (primaryAuthor) {
      searchTerms.unshift(primaryAuthor);
    }
    if (book.providerId) {
      for (const key of providerIdKeys(book.providerId, book.provider)) {
        providerIds.add(key);
      }
    }
  }

  return { titles, searchTerms, providerIds };
}

function buildContext(
  query: string,
  options: RecommendationOptions,
): RecommendationContext {
  const librarySignals = extractLibrarySignals(query, options.existingLibrary);
  const blockedProviderIds = new Set(librarySignals.providerIds);
  const positiveSignals: PositiveRecommendationSignals = {
    titles: new Set(),
    authors: new Set(),
    terms: new Set(),
  };

  addProviderIds(blockedProviderIds, providerIdsFromQuery(query));
  addProviderIds(blockedProviderIds, options.previousProviderIds);
  addProviderIds(blockedProviderIds, options.hiddenProviderIds);
  addProviderIds(blockedProviderIds, options.excludedProviderIds);

  for (const signal of options.recommendationEvents ?? []) {
    if (BLOCKING_EVENT_TYPES.has(signal.eventType)) {
      addEventProviderId(blockedProviderIds, signal);
    }
    if (POSITIVE_EVENT_TYPES.has(signal.eventType)) {
      addPositiveSignalText(positiveSignals, signal);
    }
  }

  return {
    mode: normalizeMode(options.mode ?? modeFromQuery(query)),
    intent: options.intent,
    blockedProviderIds,
    librarySignals,
    positiveSignals,
  };
}

function isBlockedProviderId(
  book: Pick<BookSearchResult, "provider" | "providerId">,
  blockedProviderIds: ReadonlySet<string>,
): boolean {
  return providerIdKeys(book.providerId, book.provider).some((key) =>
    blockedProviderIds.has(key),
  );
}

function isExistingLibraryTitle(
  book: Pick<BookSearchResult, "title">,
  librarySignals: LibrarySignals,
): boolean {
  return librarySignals.titles.has(comparableText(book.title));
}

function intentWord(
  value: string | undefined,
  dictionary: Record<string, string>,
): string | null {
  if (!value) {
    return null;
  }
  return dictionary[value] ?? value;
}

function purposeSearchQuery(intent: RecommendationIntent | undefined): string | null {
  if (!intent) {
    return null;
  }

  const parts = [
    intentWord(intent.mood, KOREAN_MOOD_WORDS),
    intentWord(intent.length, KOREAN_LENGTH_WORDS),
    intentWord(intent.difficulty, KOREAN_DIFFICULTY_WORDS),
    ...(intent.genres ?? []),
    intent.purpose,
  ].filter((part): part is string => Boolean(part?.trim()));

  return parts.length > 0 ? parts.join(" ") : null;
}

export function recommendationQueryFromIntent(
  intent: RecommendationIntent | undefined,
): string {
  return purposeSearchQuery(intent) ?? "국내 독서 추천";
}

function fallbackSearchPlans(
  query: string,
  context: RecommendationContext,
): FallbackSearchPlan[] {
  const seen = new Set<string>();
  const plans: FallbackSearchPlan[] = [];

  function add(candidate: string, origin: FallbackSearchPlan["origin"]) {
    const trimmed = candidate.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      return;
    }
    seen.add(key);
    plans.push({ query: trimmed, origin });
  }

  if (context.mode === "purpose") {
    const intentQuery = purposeSearchQuery(context.intent);
    if (intentQuery) {
      add(intentQuery, "purpose");
    }
  }

  add(query, "primary");

  for (const term of context.librarySignals.searchTerms) {
    add(
      term,
      context.librarySignals.titles.has(comparableText(term))
        ? "library-title"
        : "library-author",
    );
  }

  return plans;
}

function searchLimitForPlan(
  plan: FallbackSearchPlan,
  query: string,
  limit: number,
): number {
  if (plan.origin === "library-author" || plan.origin === "library-title") {
    return Math.max(limit * 3, 3);
  }
  if (plan.query === query || plan.origin === "purpose") {
    return limit;
  }
  return Math.max(limit * 3, 3);
}

function inferredFeedSection(query: string): RecommendationSection {
  void query;
  return "now";
}

function fallbackSection(
  query: string,
  context: RecommendationContext,
  plan: FallbackSearchPlan,
): RecommendationSection {
  if (context.mode === "conversation") {
    return "conversation";
  }
  if (context.mode === "purpose") {
    return context.intent?.length === "short" ? "short" : "purpose";
  }
  if (plan.origin === "library-author" || plan.origin === "library-title") {
    return "similar";
  }
  return inferredFeedSection(query);
}

function aiSection(context: RecommendationContext): RecommendationSection {
  if (context.mode === "conversation") {
    return "conversation";
  }
  if (context.mode === "purpose") {
    return context.intent?.length === "short" ? "short" : "purpose";
  }
  return "now";
}

function fallbackReasonTags(
  context: RecommendationContext,
  plan: FallbackSearchPlan,
): string[] {
  const tags =
    context.mode === "purpose"
      ? ["목적별"]
      : context.mode === "conversation"
        ? ["대화형 탐색"]
        : ["검색 기반"];

  if (context.mode === "purpose" && context.intent?.length === "short") {
    tags.push("짧게 읽기");
  }
  if (context.mode === "feed" && plan.origin === "library-author") {
    tags.push("비슷한 저자");
  }
  tags.push("국내판 확인");

  return tags;
}

function aiReasonTags(context: RecommendationContext): string[] {
  const tags = ["AI 추천"];
  if (context.mode === "conversation") {
    tags.push("대화형 탐색");
  }
  if (context.mode === "purpose") {
    tags.push("목적별");
  }
  tags.push("국내판 확인");
  return tags;
}

function matchScore(
  context: RecommendationContext,
  section: RecommendationSection,
  plan: FallbackSearchPlan | null,
  isFallback: boolean,
): number {
  if (!isFallback) {
    return 88;
  }
  if (context.mode === "purpose") {
    return section === "short" ? 82 : 80;
  }
  if (context.mode === "conversation") {
    return 78;
  }
  if (plan?.origin === "library-author" || plan?.origin === "library-title") {
    return 75;
  }
  return 73;
}

function providerScore(provider: BookSearchResult["provider"]): number {
  switch (provider) {
    case "kakao":
      return 12;
    case "naver":
      return 10;
    case "manual":
      return 8;
    case "google":
      return 6;
    case "open-library":
      return 4;
  }
}

function prefersShortPace(intent: RecommendationIntent | undefined): boolean {
  const dailyPageGoal = intent?.daily_page_goal;
  return (
    intent?.length === "short" ||
    (typeof dailyPageGoal === "number" &&
      Number.isFinite(dailyPageGoal) &&
      dailyPageGoal <= 50) ||
    intent?.default_log_mode === "pages"
  );
}

function candidateMatchesPositiveSignals(
  book: Pick<BookSearchResult, "title" | "authors" | "description">,
  signals: PositiveRecommendationSignals,
): boolean {
  const title = comparableText(book.title);
  if (signals.titles.has(title)) {
    return true;
  }

  for (const author of book.authors) {
    if (signals.authors.has(comparableText(author))) {
      return true;
    }
  }

  const haystack = comparableText(
    [book.title, ...book.authors, book.description ?? ""].join(" "),
  );
  for (const term of signals.terms) {
    if (haystack.includes(term)) {
      return true;
    }
  }

  return false;
}

function candidateScore(
  query: string,
  book: BookSearchResult,
  context: RecommendationContext,
): number {
  const normalizedQuery = compactText(query);
  const title = compactText(book.title);
  const authors = book.authors.map(compactText).join("");
  let score = providerScore(book.provider);

  if (normalizedQuery && title === normalizedQuery) {
    score += 80;
  } else if (normalizedQuery && title.includes(normalizedQuery)) {
    score += 55;
  } else if (normalizedQuery && normalizedQuery.includes(title)) {
    score += 35;
  }

  if (normalizedQuery && authors && normalizedQuery.includes(authors)) {
    score += 24;
  } else if (normalizedQuery && authors && authors.includes(normalizedQuery)) {
    score += 18;
  }

  if (book.language?.toLowerCase().startsWith("ko")) {
    score += 8;
  }
  if (book.pageCount) {
    score += 2;
  }
  if (candidateMatchesPositiveSignals(book, context.positiveSignals)) {
    score += 36;
  }
  if (
    prefersShortPace(context.intent) &&
    book.pageCount !== null &&
    book.pageCount <= 220
  ) {
    score += book.pageCount <= 180 ? 14 : 8;
  }

  return score;
}

function sortCandidates(
  query: string,
  books: BookSearchResult[],
  context: RecommendationContext,
): BookSearchResult[] {
  return [...books].sort(
    (left, right) =>
      candidateScore(query, right, context) - candidateScore(query, left, context) ||
      left.title.localeCompare(right.title),
  );
}

function reasonTagsForBook(
  reasonTags: string[],
  book: BookSearchResult,
  context: RecommendationContext,
): string[] {
  const tags = [...reasonTags];
  if (
    candidateMatchesPositiveSignals(book, context.positiveSignals) &&
    !tags.includes("취향 반영")
  ) {
    const domesticIndex = tags.indexOf("국내판 확인");
    if (domesticIndex === -1) {
      tags.push("취향 반영");
    } else {
      tags.splice(domesticIndex, 0, "취향 반영");
    }
  }
  return tags;
}

function cardFromSearchResult(
  book: BookSearchResult,
  reason: string,
  source: string,
  reasonTags: string[],
  matchScoreValue: number,
  section: RecommendationSection,
  isFallback: boolean,
): RecommendationCard {
  const cardReasonTags = [...reasonTags];
  if (
    isFallback &&
    book.pageCount !== null &&
    book.pageCount <= 200 &&
    !cardReasonTags.includes("짧게 읽기")
  ) {
    const domesticIndex = cardReasonTags.indexOf("국내판 확인");
    if (domesticIndex === -1) {
      cardReasonTags.push("짧게 읽기");
    } else {
      cardReasonTags.splice(domesticIndex, 0, "짧게 읽기");
    }
  }

  return {
    title: book.title,
    authors: book.authors,
    reason,
    reasonTags: cardReasonTags,
    matchScore: matchScoreValue,
    section,
    isFallback,
    domesticVerified: true,
    source,
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
  context: RecommendationContext,
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

    for (const book of sortCandidates(query, results, context)) {
      const key = searchKey(book);
      if (
        seen.has(key) ||
        isBlockedProviderId(book, context.blockedProviderIds) ||
        isExistingLibraryTitle(book, context.librarySignals)
      ) {
        continue;
      }

      seen.add(key);
      const section = aiSection(context);
      revalidated.push(
        cardFromSearchResult(
          book,
          card.reason,
          card.source,
          aiReasonTags(context),
          matchScore(context, section, null, false),
          section,
          false,
        ),
      );
      break;
    }

    if (revalidated.length >= limit) {
      return revalidated;
    }
  }

  return revalidated;
}

async function fallbackRecommendations(
  query: string,
  limit: number,
  context: RecommendationContext,
): Promise<RecommendationCard[]> {
  const seen = new Set<string>();
  const cards: RecommendationCard[] = [];

  for (const plan of fallbackSearchPlans(query, context)) {
    const results = await searchBooks(plan.query, {
      limit: searchLimitForPlan(plan, query, limit),
      market: "kr",
    });
    const section = fallbackSection(query, context, plan);
    const reasonTags = fallbackReasonTags(context, plan);
    const score = matchScore(context, section, plan, true);

    for (const book of sortCandidates(plan.query, results, context)) {
      const key = searchKey(book);
      if (
        seen.has(key) ||
        isBlockedProviderId(book, context.blockedProviderIds) ||
        isExistingLibraryTitle(book, context.librarySignals)
      ) {
        continue;
      }

      seen.add(key);
      cards.push(
        cardFromSearchResult(
          book,
          fallbackReason(plan.query),
          "search-fallback",
          reasonTagsForBook(reasonTags, book, context),
          score,
          section,
          true,
        ),
      );
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
  context: RecommendationContext,
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
          content: `Mode: ${context.mode}\nQuery: ${query}\nLimit: ${limit}`,
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
  return revalidateKoreanCatalogCards(parsed, limit, context);
}

export async function getRecommendations(
  query: string,
  options: RecommendationOptions = {},
): Promise<RecommendationCard[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const limit = normalizeLimit(options.limit);
  const context = buildContext(trimmedQuery, options);

  try {
    const results = await aiRecommendations(trimmedQuery, limit, context);
    if (results.length > 0) {
      return results;
    }
  } catch {
    // Fall through to search-backed recommendations.
  }

  return fallbackRecommendations(trimmedQuery, limit, context);
}
