import { describe, expect, it } from "vitest";
import { aggregateAnonymousRankings } from "@/lib/rankings";
import type { LibraryItemWithBook, ReadingLog } from "@/lib/reading/types";

describe("aggregateAnonymousRankings", () => {
  it("aggregates book-level activity without exposing user identity", () => {
    const items: LibraryItemWithBook[] = [
      item("item-a", "book-a", "A Book", "finished", 5),
      item("item-b", "book-a", "A Book", "reading"),
      item("item-c", "book-b", "B Book", "reading", 3),
    ];
    const logs: ReadingLog[] = [
      log("log-a", "item-a", "2026-05-08T00:00:00.000Z"),
      log("log-b", "item-b", "2026-05-07T00:00:00.000Z"),
      log("log-c", "item-c", "2026-04-01T00:00:00.000Z"),
    ];

    const rankings = aggregateAnonymousRankings({
      items,
      logs,
      now: new Date("2026-05-08T12:00:00.000Z"),
    });

    expect(rankings.popular[0]).toMatchObject({
      bookId: "book-a",
      libraryCount: 2,
      finishedCount: 1,
      recentLogCount: 2,
      averageRating: 5,
      ratingCount: 1,
    });
    expect(rankings.rated[0]).toMatchObject({
      bookId: "book-a",
      averageRating: 5,
      ratingCount: 1,
    });
    expect(JSON.stringify(rankings)).not.toContain("user-");
  });

  it("hides rating rankings until enough anonymous samples exist", () => {
    const rankings = aggregateAnonymousRankings({
      items: [
        item("item-a", "book-a", "A Book", "finished", 5),
        item("item-b", "book-b", "B Book", "finished", 4),
        item("item-c", "book-b", "B Book", "finished", 5),
      ],
      logs: [],
      minimumSampleSize: 2,
    });

    expect(rankings.rated.map((book) => book.bookId)).toEqual(["book-b"]);
  });
});

function item(
  id: string,
  bookId: string,
  title: string,
  status: LibraryItemWithBook["status"],
  rating: number | null = null,
): LibraryItemWithBook {
  return {
    id,
    userId: `user-${id}`,
    status,
    currentPage: null,
    currentPercent: null,
    startedOn: null,
    finishedOn: status === "finished" ? "2026-05-08" : null,
    rating,
    reflection: null,
    book: {
      id: bookId,
      title,
      subtitle: null,
      authors: ["Author"],
      coverUrl: null,
      pageCount: 200,
    },
  };
}

function log(id: string, libraryItemId: string, loggedAt: string): ReadingLog {
  return {
    id,
    userId: `user-${id}`,
    libraryItemId,
    loggedAt,
    currentPage: null,
    currentPercent: null,
    pagesRead: 12,
    note: null,
  };
}
