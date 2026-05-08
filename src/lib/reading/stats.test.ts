import { describe, expect, it } from "vitest";
import { summarizeReadingRoom } from "@/lib/reading/stats";
import type { LibraryItemWithBook, ReadingLog } from "@/lib/reading/types";

describe("reading room stats", () => {
  it("summarizes active books, finished books, recent logs, and weekly pages", () => {
    const items: LibraryItemWithBook[] = [
      {
        id: "item-1",
        userId: "user-1",
        status: "reading",
        currentPage: 80,
        currentPercent: null,
        startedOn: "2026-05-01",
        finishedOn: null,
        rating: null,
        reflection: null,
        book: {
          id: "book-1",
          title: "Pachinko",
          subtitle: null,
          authors: ["Min Jin Lee"],
          coverUrl: null,
          pageCount: 480,
        },
      },
      {
        id: "item-2",
        userId: "user-1",
        status: "finished",
        currentPage: 220,
        currentPercent: null,
        startedOn: "2026-04-01",
        finishedOn: "2026-04-20",
        rating: 5,
        reflection: "다시 읽고 싶은 책.",
        book: {
          id: "book-2",
          title: "Earthsea",
          subtitle: null,
          authors: ["Ursula K. Le Guin"],
          coverUrl: null,
          pageCount: 220,
        },
      },
    ];
    const logs: ReadingLog[] = [
      {
        id: "log-1",
        libraryItemId: "item-1",
        userId: "user-1",
        loggedAt: "2026-05-07T12:00:00.000Z",
        currentPage: 80,
        currentPercent: null,
        pagesRead: 30,
        note: "긴장이 붙기 시작했다.",
      },
      {
        id: "log-2",
        libraryItemId: "item-2",
        userId: "user-1",
        loggedAt: "2026-04-18T12:00:00.000Z",
        currentPage: 220,
        currentPercent: null,
        pagesRead: 22,
        note: null,
      },
    ];

    expect(
      summarizeReadingRoom({
        items,
        logs,
        now: new Date("2026-05-08T00:00:00.000Z"),
      }),
    ).toEqual({
      activeCount: 1,
      finishedCount: 1,
      pausedCount: 0,
      weeklyPages: 30,
      recentLogs: [logs[0]],
      currentlyReading: [items[0]],
    });
  });
});
