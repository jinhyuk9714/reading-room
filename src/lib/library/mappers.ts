import type {
  LibraryItemWithBook,
  ReadingLog,
  ReadingStatus,
} from "@/lib/reading/types";

type BookRow = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[] | null;
  cover_url: string | null;
  page_count: number | null;
};

export type LibraryItemRow = {
  id: string;
  user_id: string;
  status: ReadingStatus;
  current_page: number | null;
  current_percent: number | null;
  started_on: string | null;
  finished_on: string | null;
  rating: number | null;
  reflection: string | null;
  custom_title?: string | null;
  custom_authors?: string[] | null;
  custom_page_count?: number | null;
  books: BookRow | BookRow[] | null;
};

export type ReadingLogRow = {
  id: string;
  user_id: string;
  library_item_id: string;
  logged_at: string;
  current_page: number | null;
  current_percent: number | null;
  pages_read: number | null;
  note: string | null;
  quote?: string | null;
  tags?: string[] | null;
  mood?: string | null;
};

export function mapLibraryItem(row: LibraryItemRow): LibraryItemWithBook {
  const book = Array.isArray(row.books) ? row.books[0] : row.books;

  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    currentPage: row.current_page,
    currentPercent: row.current_percent,
    startedOn: row.started_on,
    finishedOn: row.finished_on,
    rating: row.rating,
    reflection: row.reflection,
    book: {
      id: book?.id ?? "",
      title: row.custom_title ?? book?.title ?? "제목 없는 책",
      subtitle: book?.subtitle ?? null,
      authors: row.custom_authors ?? book?.authors ?? [],
      coverUrl: book?.cover_url ?? null,
      pageCount: row.custom_page_count ?? book?.page_count ?? null,
    },
  };
}

export function mapReadingLog(row: ReadingLogRow): ReadingLog {
  return {
    id: row.id,
    userId: row.user_id,
    libraryItemId: row.library_item_id,
    loggedAt: row.logged_at,
    currentPage: row.current_page,
    currentPercent: row.current_percent,
    pagesRead: row.pages_read,
    note: row.note,
    quote: row.quote,
    tags: row.tags ?? [],
    mood: row.mood,
  };
}
