import type {
  LibraryItemWithBook,
  ReadingLog,
  ReadingRoomSummary,
} from "@/lib/reading/types";

type SummaryInput = {
  items: LibraryItemWithBook[];
  logs: ReadingLog[];
  now?: Date;
};

export function summarizeReadingRoom({
  items,
  logs,
  now = new Date(),
}: SummaryInput): ReadingRoomSummary {
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const recentLogs = [...logs]
    .filter((log) => {
      const loggedAt = new Date(log.loggedAt);
      return loggedAt >= weekStart && loggedAt <= now;
    })
    .sort(
      (a, b) =>
        new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
    )
    .slice(0, 5);

  return {
    activeCount: items.filter((item) => item.status === "reading").length,
    finishedCount: items.filter((item) => item.status === "finished").length,
    pausedCount: items.filter((item) => item.status === "paused").length,
    weeklyPages: logs.reduce((sum, log) => {
      const loggedAt = new Date(log.loggedAt);
      if (loggedAt < weekStart || loggedAt > now) {
        return sum;
      }
      return sum + (log.pagesRead ?? 0);
    }, 0),
    recentLogs,
    currentlyReading: items.filter((item) => item.status === "reading"),
  };
}
