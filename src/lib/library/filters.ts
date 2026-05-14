import type { LibraryItemWithBook, ReadingStatus } from "@/lib/reading/types";

export type LibrarySort = "recent" | "title" | "progress";

export type LibraryItemFilter = {
  query?: string;
  statuses?: ReadingStatus[];
  sort?: LibrarySort;
};

export function filterLibraryItems(
  items: LibraryItemWithBook[],
  filter: LibraryItemFilter = {},
): LibraryItemWithBook[] {
  const query = normalize(filter.query);
  const statusSet = filter.statuses?.length ? new Set(filter.statuses) : null;
  const sort = filter.sort ?? "recent";

  return items
    .filter((item) => {
      if (statusSet && !statusSet.has(item.status)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = normalize(
        [
          item.book.title,
          item.book.subtitle,
          item.book.authors.join(" "),
          item.reflection,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return searchableText.includes(query);
    })
    .sort((a, b) => compareLibraryItems(a, b, sort));
}

function compareLibraryItems(
  a: LibraryItemWithBook,
  b: LibraryItemWithBook,
  sort: LibrarySort,
): number {
  if (sort === "title") {
    return a.book.title.localeCompare(b.book.title, "ko-KR");
  }

  if (sort === "progress") {
    return readingProgress(b) - readingProgress(a);
  }

  return relevantDate(b).localeCompare(relevantDate(a));
}

function readingProgress(item: LibraryItemWithBook): number {
  if (item.currentPercent != null) {
    return item.currentPercent;
  }

  if (item.currentPage != null && item.book.pageCount) {
    return Math.min(100, Math.round((item.currentPage / item.book.pageCount) * 100));
  }

  return item.status === "finished" ? 100 : 0;
}

function relevantDate(item: LibraryItemWithBook): string {
  return item.finishedOn ?? item.startedOn ?? "";
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("ko-KR") ?? "";
}
