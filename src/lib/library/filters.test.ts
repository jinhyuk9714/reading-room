import { describe, expect, it } from "vitest";

import { filterLibraryItems } from "@/lib/library/filters";
import type { LibraryItemWithBook, ReadingStatus } from "@/lib/reading/types";

describe("filterLibraryItems", () => {
  it("filters by reading status and query, then sorts recently updated work first", () => {
    const items = [
      item("old-reading", "오래된 책", "reading", "2026-05-01"),
      item("matching-paused", "잠시 멈춘 책", "paused", "2026-05-10"),
      item("new-reading", "새로운 책", "reading", "2026-05-11"),
      item("finished", "새로운 완독", "finished", "2026-05-12"),
    ];

    expect(
      filterLibraryItems(items, {
        query: "책",
        statuses: ["reading", "paused"],
        sort: "recent",
      }).map((entry) => entry.id),
    ).toEqual(["new-reading", "matching-paused", "old-reading"]);
  });

  it("can surface the want-to-read queue by title", () => {
    const items = [
      item("b", "비평 수업", "want_to_read", "2026-05-02"),
      item("a", "가벼운 산문", "want_to_read", "2026-05-03"),
      item("reading", "읽는 책", "reading", "2026-05-04"),
    ];

    expect(
      filterLibraryItems(items, {
        statuses: ["want_to_read"],
        sort: "title",
      }).map((entry) => entry.book.title),
    ).toEqual(["가벼운 산문", "비평 수업"]);
  });
});

function item(
  id: string,
  title: string,
  status: ReadingStatus,
  startedOn: string,
): LibraryItemWithBook {
  return {
    id,
    userId: "user-1",
    status,
    currentPage: null,
    currentPercent: null,
    startedOn,
    finishedOn: status === "finished" ? startedOn : null,
    rating: null,
    reflection: null,
    book: {
      id: `book-${id}`,
      title,
      subtitle: null,
      authors: ["작가"],
      coverUrl: null,
      pageCount: 200,
    },
  };
}
