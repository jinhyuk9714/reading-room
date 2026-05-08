import type { LibraryItemWithBook, ReadingLog } from "@/lib/reading/types";

export type RankingLibraryItem = Pick<
  LibraryItemWithBook,
  "id" | "status" | "rating" | "book"
>;

export type RankingReadingLog = Pick<ReadingLog, "libraryItemId" | "loggedAt">;

export type RankingBook = {
  bookId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
  libraryCount: number;
  finishedCount: number;
  recentLogCount: number;
  ratingCount: number;
  averageRating: number | null;
};

export type ReadingRankings = {
  popular: RankingBook[];
  rated: RankingBook[];
  active: RankingBook[];
};

type RankingInput = {
  items: RankingLibraryItem[];
  logs: RankingReadingLog[];
  now?: Date;
  minimumSampleSize?: number;
};

export function aggregateAnonymousRankings({
  items,
  logs,
  now = new Date(),
  minimumSampleSize = 1,
}: RankingInput): ReadingRankings {
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const byBook = new Map<string, RankingBook>();
  const itemBookIds = new Map<string, string>();
  const ratingSums = new Map<string, number>();

  for (const item of items) {
    const existing = byBook.get(item.book.id) ?? {
      bookId: item.book.id,
      title: item.book.title,
      authors: item.book.authors,
      coverUrl: item.book.coverUrl,
      pageCount: item.book.pageCount,
      libraryCount: 0,
      finishedCount: 0,
      recentLogCount: 0,
      ratingCount: 0,
      averageRating: null,
    };

    existing.libraryCount += 1;
    existing.finishedCount += item.status === "finished" ? 1 : 0;
    if (typeof item.rating === "number") {
      existing.ratingCount += 1;
      ratingSums.set(
        item.book.id,
        (ratingSums.get(item.book.id) ?? 0) + item.rating,
      );
    }
    byBook.set(item.book.id, existing);
    itemBookIds.set(item.id, item.book.id);
  }

  for (const log of logs) {
    const bookId = itemBookIds.get(log.libraryItemId);
    if (!bookId) {
      continue;
    }

    const loggedAt = new Date(log.loggedAt);
    if (loggedAt < weekStart || loggedAt > now) {
      continue;
    }

    const ranking = byBook.get(bookId);
    if (ranking) {
      ranking.recentLogCount += 1;
    }
  }

  const rankings = [...byBook.values()].map((ranking) => ({
    ...ranking,
    averageRating:
      ranking.ratingCount > 0
        ? Number(
            ((ratingSums.get(ranking.bookId) ?? 0) / ranking.ratingCount).toFixed(
              2,
            ),
          )
        : null,
  }));

  return {
    popular: sortRankings(rankings, "libraryCount"),
    rated: sortRatingRankings(rankings, minimumSampleSize),
    active: sortRankings(rankings, "recentLogCount"),
  };
}

function sortRankings(
  rankings: RankingBook[],
  field: "libraryCount" | "finishedCount" | "recentLogCount",
) {
  return [...rankings]
    .filter((ranking) => ranking[field] > 0)
    .sort((a, b) => b[field] - a[field] || a.title.localeCompare(b.title))
    .slice(0, 8);
}

function sortRatingRankings(
  rankings: RankingBook[],
  minimumSampleSize: number,
) {
  return [...rankings]
    .filter(
      (ranking) =>
        ranking.averageRating !== null && ranking.ratingCount >= minimumSampleSize,
    )
    .sort(
      (a, b) =>
        (b.averageRating ?? 0) - (a.averageRating ?? 0) ||
        b.ratingCount - a.ratingCount ||
        b.finishedCount - a.finishedCount ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 8);
}
