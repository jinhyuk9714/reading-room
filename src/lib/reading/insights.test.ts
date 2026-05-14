import { describe, expect, it } from "vitest";
import { buildReadingInsightSummary } from "@/lib/reading/insights";
import type { LibraryItemWithBook, ReadingLog } from "@/lib/reading/types";

function item(
  id: string,
  status: LibraryItemWithBook["status"],
  overrides: Partial<LibraryItemWithBook> = {},
): LibraryItemWithBook {
  return {
    id,
    userId: "user-1",
    status,
    currentPage: 0,
    currentPercent: null,
    startedOn: null,
    finishedOn: null,
    rating: null,
    reflection: null,
    book: {
      id: `book-${id}`,
      title: `Book ${id}`,
      subtitle: null,
      authors: ["Author A"],
      coverUrl: null,
      pageCount: 100,
    },
    ...overrides,
  };
}

function log(
  id: string,
  libraryItemId: string,
  loggedAt: string,
  pagesRead: number | null,
  overrides: Partial<ReadingLog> = {},
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
    quote: null,
    tags: [],
    mood: null,
    ...overrides,
  };
}

describe("reading insights", () => {
  it("summarizes status, pace, authors, tags, moods, and current-book finish estimates", () => {
    const items: LibraryItemWithBook[] = [
      item("active-1", "reading", {
        currentPage: 40,
        book: {
          id: "book-active-1",
          title: "Pachinko",
          subtitle: null,
          authors: ["Min Jin Lee"],
          coverUrl: null,
          pageCount: 100,
        },
      }),
      item("active-2", "reading", {
        currentPage: 120,
        book: {
          id: "book-active-2",
          title: "Earthsea",
          subtitle: null,
          authors: ["Ursula K. Le Guin", "Author A"],
          coverUrl: null,
          pageCount: 240,
        },
      }),
      item("done", "finished", {
        book: {
          id: "book-done",
          title: "Finished",
          subtitle: null,
          authors: ["Min Jin Lee"],
          coverUrl: null,
          pageCount: 200,
        },
      }),
      item("paused", "paused"),
    ];
    const logs: ReadingLog[] = [
      log("log-1", "active-1", "2026-05-14T10:00:00.000Z", 10, {
        tags: ["craft", "memoir"],
        mood: "focused",
      }),
      log("log-2", "active-1", "2026-05-13T10:00:00.000Z", 20, {
        tags: ["craft"],
        mood: "calm",
      }),
      log("log-3", "active-2", "2026-05-11T10:00:00.000Z", 30, {
        tags: ["memoir"],
        mood: "focused",
      }),
      log("log-4", "active-2", "2026-05-08T10:00:00.000Z", 5, {
        tags: ["older"],
        mood: "calm",
      }),
    ];

    expect(
      buildReadingInsightSummary({
        items,
        logs,
        now: new Date("2026-05-14T23:00:00.000Z"),
      }),
    ).toEqual({
      statusCounts: {
        want_to_read: 0,
        reading: 2,
        paused: 1,
        finished: 1,
        abandoned: 0,
      },
      weeklyPages: 65,
      recentStreakDays: 2,
      averagePagesPerActiveDay: 16.25,
      pace: [
        {
          libraryItemId: "active-1",
          title: "Pachinko",
          remainingPages: 60,
          averagePagesPerActiveDay: 15,
          estimatedDaysToFinish: 4,
        },
        {
          libraryItemId: "active-2",
          title: "Earthsea",
          remainingPages: 120,
          averagePagesPerActiveDay: 17.5,
          estimatedDaysToFinish: 7,
        },
      ],
      topAuthors: [
        { label: "Author A", count: 2 },
        { label: "Min Jin Lee", count: 2 },
        { label: "Ursula K. Le Guin", count: 1 },
      ],
      topTags: [
        { label: "craft", count: 2 },
        { label: "memoir", count: 2 },
        { label: "older", count: 1 },
      ],
      moodCounts: [
        { label: "calm", count: 2 },
        { label: "focused", count: 2 },
      ],
    });
  });
});
