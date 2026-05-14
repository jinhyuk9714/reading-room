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
  quote?: string | null;
  tags?: string[];
  mood?: string | null;
};

export type ReadingRoomSummary = {
  activeCount: number;
  finishedCount: number;
  pausedCount: number;
  weeklyPages: number;
  recentLogs: ReadingLog[];
  currentlyReading: LibraryItemWithBook[];
};

export type QuickLogDraft = {
  pageCount: number | null;
  currentPage: number | null;
  currentPercent: number | null;
  pagesRead: number | null;
  note: string | null;
  quote?: string | null;
  tags?: string[];
  mood?: string | null;
};

export type ReadingPace = {
  libraryItemId: string;
  title: string;
  remainingPages: number;
  averagePagesPerActiveDay: number;
  estimatedDaysToFinish: number | null;
};

export type CountSummary = {
  label: string;
  count: number;
};

export type ReadingInsightSummary = {
  statusCounts: Record<ReadingStatus, number>;
  weeklyPages: number;
  recentStreakDays: number;
  averagePagesPerActiveDay: number;
  pace: ReadingPace[];
  topAuthors: CountSummary[];
  topTags: CountSummary[];
  moodCounts: CountSummary[];
};

export type ReaderLogMode = "page" | "percent";

export type ReaderPreferences = {
  dailyPageGoal: number;
  weeklySessionGoal: number;
  defaultLogMode: ReaderLogMode;
  favoriteSubjects: string[];
  blockedSubjects: string[];
};

export type ReaderPreferenceDraft = ReaderPreferences;

export type ReadingGoalProgress = {
  dailyPageGoal: number;
  weeklySessionGoal: number;
  dailyPages: number;
  weeklyPages: number;
  weeklySessions: number;
  dailyPercent: number;
  weeklySessionPercent: number;
  unloggedToday: LibraryItemWithBook[];
};

export type LibraryFilter = {
  status?: ReadingStatus | "all";
  author?: string;
  tag?: string;
  query?: string;
};
