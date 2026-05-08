export type ReadingStatus =
  | "want_to_read"
  | "reading"
  | "paused"
  | "finished"
  | "abandoned";

export type BookSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
};

export type LibraryItemWithBook = {
  id: string;
  userId: string;
  status: ReadingStatus;
  currentPage: number | null;
  currentPercent: number | null;
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
  reflection: string | null;
  book: BookSummary;
};

export type ReadingLog = {
  id: string;
  userId: string;
  libraryItemId: string;
  loggedAt: string;
  currentPage: number | null;
  currentPercent: number | null;
  pagesRead: number | null;
  note: string | null;
};

export type ReadingRoomSummary = {
  activeCount: number;
  finishedCount: number;
  pausedCount: number;
  weeklyPages: number;
  recentLogs: ReadingLog[];
  currentlyReading: LibraryItemWithBook[];
};
