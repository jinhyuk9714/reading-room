import type {
  CountSummary,
  LibraryItemWithBook,
  ReadingInsightSummary,
  ReadingLog,
  ReadingPace,
  ReadingStatus,
} from "@/lib/reading/types";

type InsightInput = {
  items: LibraryItemWithBook[];
  logs: ReadingLog[];
  now?: Date;
};

const STATUSES: ReadingStatus[] = [
  "want_to_read",
  "reading",
  "paused",
  "finished",
  "abandoned",
];

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function increment(counts: Map<string, number>, key: string, amount = 1) {
  counts.set(key, (counts.get(key) ?? 0) + amount);
}

function rankedCounts(counts: Map<string, number>): CountSummary[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function averagePagesPerActiveDay(logs: ReadingLog[]): number {
  const pagesByDay = new Map<string, number>();

  for (const log of logs) {
    const pages = log.pagesRead ?? 0;
    if (pages <= 0) {
      continue;
    }
    increment(pagesByDay, dayKey(new Date(log.loggedAt)), pages);
  }

  if (pagesByDay.size === 0) {
    return 0;
  }

  const totalPages = [...pagesByDay.values()].reduce(
    (sum, pages) => sum + pages,
    0,
  );
  return totalPages / pagesByDay.size;
}

function recentStreakDays(logs: ReadingLog[], now: Date): number {
  const activeDays = new Set(
    logs
      .filter((log) => (log.pagesRead ?? 0) > 0)
      .map((log) => dayKey(new Date(log.loggedAt))),
  );
  let streak = 0;
  let cursor = startOfDay(now);

  for (let index = 0; index < 7; index += 1) {
    if (!activeDays.has(dayKey(cursor))) {
      break;
    }
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function paceForCurrentBooks(
  items: LibraryItemWithBook[],
  logs: ReadingLog[],
): ReadingPace[] {
  return items
    .filter((item) => item.status === "reading" && item.book.pageCount !== null)
    .map((item) => {
      const itemLogs = logs.filter((log) => log.libraryItemId === item.id);
      const average = averagePagesPerActiveDay(itemLogs);
      const remainingPages = Math.max(
        (item.book.pageCount ?? 0) - (item.currentPage ?? 0),
        0,
      );

      return {
        libraryItemId: item.id,
        title: item.book.title,
        remainingPages,
        averagePagesPerActiveDay: average,
        estimatedDaysToFinish:
          average > 0 ? Math.ceil(remainingPages / average) : null,
      };
    });
}

export function buildReadingInsightSummary({
  items,
  logs,
  now = new Date(),
}: InsightInput): ReadingInsightSummary {
  const weekStart = startOfDay(addDays(now, -6));
  const statusCounts = Object.fromEntries(
    STATUSES.map((status) => [
      status,
      items.filter((item) => item.status === status).length,
    ]),
  ) as Record<ReadingStatus, number>;
  const authorCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const moodCounts = new Map<string, number>();

  for (const item of items) {
    for (const author of item.book.authors) {
      increment(authorCounts, author);
    }
  }

  for (const log of logs) {
    for (const tag of log.tags ?? []) {
      increment(tagCounts, tag);
    }
    if (log.mood) {
      increment(moodCounts, log.mood);
    }
  }

  return {
    statusCounts,
    weeklyPages: logs.reduce((sum, log) => {
      const loggedAt = new Date(log.loggedAt);
      if (loggedAt < weekStart || loggedAt > now) {
        return sum;
      }
      return sum + (log.pagesRead ?? 0);
    }, 0),
    recentStreakDays: recentStreakDays(logs, now),
    averagePagesPerActiveDay: averagePagesPerActiveDay(logs),
    pace: paceForCurrentBooks(items, logs),
    topAuthors: rankedCounts(authorCounts),
    topTags: rankedCounts(tagCounts),
    moodCounts: rankedCounts(moodCounts),
  };
}
