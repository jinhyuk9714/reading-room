import { describe, expect, it } from "vitest";
import { buildReadingGoalProgress } from "@/lib/reading/goals";
import type { LibraryItemWithBook, ReadingLog } from "@/lib/reading/types";

describe("buildReadingGoalProgress", () => {
  it("summarizes daily pages, weekly sessions, and books that still need a log today", () => {
    const now = new Date("2026-05-15T12:00:00.000Z");
    const reading = item("reading-1", "이어 읽는 책", "reading");
    const loggedToday = item("reading-2", "오늘 기록한 책", "reading");

    const progress = buildReadingGoalProgress({
      items: [reading, loggedToday, item("paused-1", "멈춘 책", "paused")],
      logs: [
        log("today", loggedToday.id, "2026-05-15T09:00:00.000Z", 12),
        log("week", reading.id, "2026-05-12T09:00:00.000Z", 30),
        log("old", reading.id, "2026-05-01T09:00:00.000Z", 80),
      ],
      preferences: {
        dailyPageGoal: 20,
        weeklySessionGoal: 4,
        defaultLogMode: "page",
        favoriteSubjects: [],
        blockedSubjects: [],
      },
      now,
    });

    expect(progress.dailyPages).toBe(12);
    expect(progress.dailyPercent).toBe(60);
    expect(progress.weeklySessions).toBe(2);
    expect(progress.weeklySessionPercent).toBe(50);
    expect(progress.unloggedToday.map((entry) => entry.book.title)).toEqual([
      "이어 읽는 책",
    ]);
  });
});

function item(
  id: string,
  title: string,
  status: LibraryItemWithBook["status"],
): LibraryItemWithBook {
  return {
    id,
    userId: "user-1",
    status,
    currentPage: null,
    currentPercent: null,
    startedOn: "2026-05-01",
    finishedOn: null,
    rating: null,
    reflection: null,
    book: {
      id: `book-${id}`,
      title,
      subtitle: null,
      authors: ["저자"],
      coverUrl: null,
      pageCount: 200,
    },
  };
}

function log(
  id: string,
  libraryItemId: string,
  loggedAt: string,
  pagesRead: number,
): ReadingLog {
  return {
    id,
    userId: "user-1",
    libraryItemId,
    loggedAt,
    currentPage: null,
    currentPercent: null,
    pagesRead,
    note: null,
  };
}
