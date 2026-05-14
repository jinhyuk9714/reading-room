import { defaultReaderPreferences } from "@/lib/reader-preferences";
import type {
  LibraryItemWithBook,
  ReaderPreferences,
  ReadingGoalProgress,
  ReadingLog,
} from "@/lib/reading/types";

type ReadingGoalInput = {
  items: LibraryItemWithBook[];
  logs: ReadingLog[];
  preferences?: ReaderPreferences;
  now?: Date;
};

export function buildReadingGoalProgress({
  items,
  logs,
  preferences = defaultReaderPreferences,
  now = new Date(),
}: ReadingGoalInput): ReadingGoalProgress {
  const today = dayKey(now);
  const weekStart = startOfDay(addDays(now, -6));
  const visibleReadingItems = items.filter((item) => item.status === "reading");
  const todayLogs = logs.filter((log) => dayKey(new Date(log.loggedAt)) === today);
  const weeklyLogs = logs.filter((log) => {
    const loggedAt = new Date(log.loggedAt);
    return loggedAt >= weekStart && loggedAt <= now;
  });
  const loggedTodayItemIds = new Set(todayLogs.map((log) => log.libraryItemId));
  const dailyPages = todayLogs.reduce((sum, log) => sum + (log.pagesRead ?? 0), 0);
  const weeklyPages = weeklyLogs.reduce((sum, log) => sum + (log.pagesRead ?? 0), 0);
  const weeklySessions = new Set(
    weeklyLogs.map((log) => `${dayKey(new Date(log.loggedAt))}:${log.libraryItemId}`),
  ).size;

  return {
    dailyPageGoal: preferences.dailyPageGoal,
    weeklySessionGoal: preferences.weeklySessionGoal,
    dailyPages,
    weeklyPages,
    weeklySessions,
    dailyPercent: clampPercent(dailyPages, preferences.dailyPageGoal),
    weeklySessionPercent: clampPercent(
      weeklySessions,
      preferences.weeklySessionGoal,
    ),
    unloggedToday: visibleReadingItems.filter(
      (item) => !loggedTodayItemIds.has(item.id),
    ),
  };
}

function clampPercent(value: number, goal: number): number {
  if (goal <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / goal) * 100));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}
