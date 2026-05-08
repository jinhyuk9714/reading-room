"use client";

import {
  ArrowLeft,
  Archive,
  BarChart3,
  BookCheck,
  BookMarked,
  BookPlus,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Flame,
  Library,
  Lightbulb,
  PauseCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { BookSearchResult } from "@/lib/books/types";
import type { RecommendationCard } from "@/lib/recommendations/types";
import { aggregateAnonymousRankings } from "@/lib/rankings";
import { calculateProgress, validateReadingLog } from "@/lib/reading/progress";
import { summarizeReadingRoom } from "@/lib/reading/stats";
import type {
  LibraryItemWithBook,
  ReadingLog,
  ReadingStatus,
} from "@/lib/reading/types";
import { formatAuthors, formatDate } from "@/lib/utils";
import { BookCover } from "@/components/ui/book-cover";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { isReadingStatus } from "@/lib/library/validation";

const STORAGE_KEY = "reading-room-demo-v1";
const HIDDEN_RECOMMENDATIONS_KEY = "reading-room-demo-hidden-recommendations-v1";
const DEMO_USER_ID = "demo-user";

type DemoReadingRoomProps = {
  initialView:
    | "home"
    | "search"
    | "detail"
    | "archive"
    | "rankings"
    | "recommendations";
  detailId?: string;
};

type DemoState = {
  items: LibraryItemWithBook[];
  logs: ReadingLog[];
};

type DemoRecommendationPurpose = "auto" | "short" | "deep" | "explore";

const emptyState: DemoState = {
  items: [],
  logs: [],
};

export function DemoReadingRoom({
  initialView,
  detailId,
}: DemoReadingRoomProps) {
  const router = useRouter();
  const [state, setState] = useState<DemoState>(emptyState);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searchState, setSearchState] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setState(readState());
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const summary = useMemo(
    () => summarizeReadingRoom({ items: state.items, logs: state.logs }),
    [state],
  );

  function commit(nextState: DemoState) {
    setState(nextState);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  function navigate(path: string) {
    router.push(path);
  }

  function addBook(book: BookSearchResult, status: ReadingStatus = "reading") {
    const bookId = `demo-book-${crypto.randomUUID()}`;
    const itemId = `demo-${crypto.randomUUID()}`;
    const item: LibraryItemWithBook = {
      id: itemId,
      userId: DEMO_USER_ID,
      status,
      currentPage: null,
      currentPercent: null,
      startedOn: status === "want_to_read" ? null : today(),
      finishedOn: status === "finished" ? today() : null,
      rating: null,
      reflection: null,
      book: {
        id: bookId,
        title: book.title,
        subtitle: book.subtitle,
        authors: book.authors,
        coverUrl: book.coverUrl,
        pageCount: book.pageCount,
      },
    };

    commit({ ...state, items: [item, ...state.items] });
    navigate(`/library/${itemId}`);
  }

  function submitManualBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = stringOrNull(formData.get("title"));
    const status = parseReadingStatus(formData.get("status"));

    if (!title) {
      setMessage("책 제목을 입력해주세요.");
      return;
    }

    addBook(
      {
        provider: "manual",
        providerId: `manual-${crypto.randomUUID()}`,
        title,
        subtitle: null,
        authors: parseAuthorText(formData.get("authorsText")),
        isbn10: null,
        isbn13: null,
        coverUrl: null,
        pageCount: numberOrNull(formData.get("pageCount")),
        publishedYear: null,
        language: "ko",
        description: null,
        raw: {},
      },
      status,
    );
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextQuery = stringOrNull(formData.get("q")) ?? "";

    setQuery(nextQuery);
    setMessage(null);

    if (!nextQuery) {
      setResults([]);
      setSearchState("idle");
      return;
    }

    setSearchState("loading");

    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(nextQuery)}&limit=12`,
      );
      const payload = (await response.json()) as { results?: BookSearchResult[] };
      setResults(payload.results ?? []);
      setSearchState("done");
    } catch {
      setSearchState("error");
      setMessage("검색에 실패했습니다. 직접 입력으로 추가할 수 있습니다.");
    }
  }

  function updateItem(
    itemId: string,
    updater: (item: LibraryItemWithBook) => LibraryItemWithBook,
  ) {
    commit({
      ...state,
      items: state.items.map((item) => (item.id === itemId ? updater(item) : item)),
    });
  }

  function updateMetadata(
    itemId: string,
    updates: { title: string; authors: string[]; pageCount: number | null },
  ) {
    updateItem(itemId, (libraryItem) => ({
      ...libraryItem,
      book: {
        ...libraryItem.book,
        title: updates.title,
        authors: updates.authors,
        pageCount: updates.pageCount,
      },
    }));
    setMessage("책 정보를 저장했습니다.");
  }

  function archiveItem(itemId: string) {
    updateItem(itemId, (libraryItem) => ({
      ...libraryItem,
      status: "abandoned",
      finishedOn: null,
      rating: null,
      reflection: null,
    }));
    setMessage(null);
    navigate("/");
  }

  function restoreItem(itemId: string) {
    updateItem(itemId, (libraryItem) => ({
      ...libraryItem,
      status: "reading",
      finishedOn: null,
      rating: null,
      reflection: null,
    }));
    setMessage("보관함에서 복원했습니다.");
  }

  function deleteItem(itemId: string) {
    commit({
      items: state.items.filter((item) => item.id !== itemId),
      logs: state.logs.filter((log) => log.libraryItemId !== itemId),
    });
    setMessage("책을 삭제했습니다.");
  }

  function updateLog(
    logId: string,
    item: LibraryItemWithBook,
    draft: {
      currentPage: number | null;
      currentPercent: number | null;
      pagesRead: number | null;
      note: string | null;
    },
  ) {
    const validation = validateReadingLog({
      pageCount: item.book.pageCount,
      ...draft,
    });

    if (!validation.ok) {
      setMessage(validation.errors.join(" "));
      return false;
    }

    commit({
	      items: state.items.map((libraryItem) =>
	        libraryItem.id === item.id
	          ? {
	              ...libraryItem,
	              status:
	                libraryItem.status === "finished"
	                  ? libraryItem.status
	                  : ("reading" as ReadingStatus),
	              finishedOn:
	                libraryItem.status === "finished"
	                  ? libraryItem.finishedOn
	                  : null,
	              currentPage: draft.currentPage,
	              currentPercent: draft.currentPercent,
	            }
          : libraryItem,
      ),
      logs: state.logs.map((log) =>
        log.id === logId ? { ...log, ...draft } : log,
      ),
    });
    setMessage("기록을 수정했습니다.");
    return true;
  }

  function deleteLog(logId: string) {
    const deletedLog = state.logs.find((log) => log.id === logId);
    const nextLogs = state.logs.filter((log) => log.id !== logId);
    const nextItems = deletedLog
      ? state.items.map((item) => {
          if (item.id !== deletedLog.libraryItemId) {
            return item;
          }

          const latestLog = nextLogs
            .filter((log) => log.libraryItemId === item.id)
            .sort(
              (left, right) =>
                new Date(right.loggedAt).getTime() -
                new Date(left.loggedAt).getTime(),
            )[0];

          return {
            ...item,
            status:
              item.status === "finished"
                ? item.status
                : ("reading" as ReadingStatus),
            finishedOn: item.status === "finished" ? item.finishedOn : null,
            currentPage: latestLog?.currentPage ?? null,
            currentPercent: latestLog?.currentPercent ?? null,
          };
        })
      : state.items;

    commit({
      items: nextItems,
      logs: nextLogs,
    });
    setMessage("기록을 삭제했습니다.");
  }

  function submitReadingLog(
    event: FormEvent<HTMLFormElement>,
    item: LibraryItemWithBook,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPage = numberOrNull(formData.get("currentPage"));
    const currentPercent = numberOrNull(formData.get("currentPercent"));
    const pagesRead = numberOrNull(formData.get("pagesRead"));
    const note = stringOrNull(formData.get("note"));
    const validation = validateReadingLog({
      pageCount: item.book.pageCount,
      currentPage,
      currentPercent,
      pagesRead,
      note,
    });

    if (!validation.ok) {
      setMessage(validation.errors.join(" "));
      return;
    }

    const log: ReadingLog = {
      id: `demo-log-${crypto.randomUUID()}`,
      userId: DEMO_USER_ID,
      libraryItemId: item.id,
      loggedAt: new Date().toISOString(),
      currentPage,
      currentPercent,
      pagesRead,
      note,
    };

    const nextItems = state.items.map((libraryItem) =>
	      libraryItem.id === item.id
	        ? {
	            ...libraryItem,
	            status:
	              libraryItem.status === "finished"
	                ? libraryItem.status
	                : ("reading" as ReadingStatus),
	            finishedOn:
	              libraryItem.status === "finished" ? libraryItem.finishedOn : null,
	            currentPage,
	            currentPercent,
	          }
        : libraryItem,
    );

    commit({ items: nextItems, logs: [log, ...state.logs] });
    setMessage("기록을 저장했습니다.");
  }

  function submitFinishBook(
    event: FormEvent<HTMLFormElement>,
    item: LibraryItemWithBook,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rating = numberOrNull(formData.get("rating"));
    const reflection = stringOrNull(formData.get("reflection"));

    updateItem(item.id, (libraryItem) => ({
      ...libraryItem,
      status: "finished",
      finishedOn: today(),
      rating,
      reflection,
    }));
    setMessage("완독 회고를 저장했습니다.");
  }

  if (initialView === "search") {
    return (
      <SearchView
        message={message}
        query={query}
        ready={ready}
        results={results}
        searchState={searchState}
        onAddBook={addBook}
        onSubmitManualBook={submitManualBook}
        onSubmitSearch={submitSearch}
      />
    );
  }

  if (initialView === "detail") {
    const item = state.items.find((libraryItem) => libraryItem.id === detailId);
    const logs = state.logs.filter((log) => log.libraryItemId === detailId);

    return item ? (
      <DetailView
        item={item}
        logs={logs}
        message={message}
        ready={ready}
        onFinishBook={submitFinishBook}
        onLog={submitReadingLog}
        onArchive={() => archiveItem(item.id)}
        onDelete={() => {
          deleteItem(item.id);
          navigate("/");
        }}
        onDeleteLog={deleteLog}
        onUpdateLog={updateLog}
        onUpdateMetadata={updateMetadata}
	        onStatus={(status) =>
	          updateItem(item.id, (libraryItem) => ({
	            ...libraryItem,
	            status,
	            finishedOn:
	              status === "finished"
	                ? (libraryItem.finishedOn ?? today())
	                : null,
	            rating: status === "finished" ? libraryItem.rating : null,
	            reflection: status === "finished" ? libraryItem.reflection : null,
	          }))
	        }
      />
    ) : (
      <MissingItemView />
    );
  }

  if (initialView === "archive") {
    return (
      <ArchiveView
        items={state.items.filter((item) => item.status === "abandoned")}
        onDeleteItem={deleteItem}
        onRestoreItem={restoreItem}
      />
    );
  }

  if (initialView === "rankings") {
    return <RankingsView items={state.items} logs={state.logs} />;
  }

  if (initialView === "recommendations") {
    return (
      <RecommendationsView
        items={state.items}
        onAddRecommendation={(card) =>
          addBook({
            provider:
              card.provider === "google" ||
              card.provider === "open-library" ||
              card.provider === "manual" ||
              card.provider === "kakao" ||
              card.provider === "naver"
                ? card.provider
                : "manual",
            providerId: card.providerId,
            title: card.title,
            subtitle: null,
            authors: card.authors,
            isbn10: null,
            isbn13: null,
            coverUrl: card.coverUrl,
            pageCount: card.pageCount,
            publishedYear: null,
            language: "ko",
            description: card.reason,
            raw: {},
          })
        }
      />
    );
  }

  return <HomeView items={state.items} summary={summary} />;
}

function HomeView({
  items,
  summary,
}: {
  items: LibraryItemWithBook[];
  summary: ReturnType<typeof summarizeReadingRoom>;
}) {
  const visibleItems = items.filter((item) => item.status !== "abandoned");

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Reading Room</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              오늘의 독서장
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/search" variant="primary">
              <Plus className="size-4" />
              책 추가
            </ButtonLink>
            <ButtonLink href="/rankings" variant="secondary">
              랭킹
            </ButtonLink>
            <ButtonLink href="/recommendations" variant="secondary">
              추천
            </ButtonLink>
            <ButtonLink href="/archive" variant="ghost">
              보관함
            </ButtonLink>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <StatCard
            icon={<BookMarked className="size-5" />}
            label="읽는 중"
            value={`${summary.activeCount}권`}
          />
          <StatCard
            icon={<Library className="size-5" />}
            label="완독"
            value={`${summary.finishedCount}권`}
          />
          <StatCard
            icon={<CalendarDays className="size-5" />}
            label="최근 7일"
            value={`${summary.weeklyPages}쪽`}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel
            action={
              <ButtonLink href="/search" size="sm" variant="secondary">
                검색
              </ButtonLink>
            }
            title="지금 읽는 책"
          >
            {summary.currentlyReading.length === 0 ? (
              <EmptyState
                body="책을 하나 추가하면 첫 기록을 바로 남길 수 있어요."
                title="아직 읽는 중인 책이 없습니다."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.currentlyReading.map((item) => (
                  <BookCard item={item} key={item.id} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="최근 기록">
            {summary.recentLogs.length === 0 ? (
              <EmptyState
                body="짧은 메모 하나면 충분합니다. 오늘 읽은 흔적을 남겨보세요."
                title="이번 주 기록이 비어 있습니다."
              />
            ) : (
              <LogList logs={summary.recentLogs} />
            )}
          </Panel>
        </section>

        <Panel title="내 서재">
          {visibleItems.length === 0 ? (
            <EmptyState
              body="읽고 있는 책을 검색해 첫 번째 책장을 만들어보세요."
              title="서재가 아직 비어 있습니다."
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visibleItems.map((item) => (
                <BookCard item={item} key={item.id} cover="large" />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}

function SearchView({
  message,
  query,
  ready,
  results,
  searchState,
  onAddBook,
  onSubmitManualBook,
  onSubmitSearch,
}: {
  message: string | null;
  query: string;
  ready: boolean;
  results: BookSearchResult[];
  searchState: "idle" | "loading" | "done" | "error";
  onAddBook: (book: BookSearchResult, status: ReadingStatus) => void;
  onSubmitManualBook: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitSearch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">책 추가</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              검색해서 서재에 넣기
            </h1>
          </div>
          <ButtonLink href="/" variant="secondary">
            독서장으로
          </ButtonLink>
        </header>

        {message ? <Notice>{message}</Notice> : null}

        <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmitSearch}>
            <label className="sr-only" htmlFor="demo-q">
              책 제목 또는 저자 검색
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <input
                className="h-12 w-full rounded-md border border-[var(--color-line)] bg-white pl-10 pr-3 text-base outline-none transition focus:border-[var(--color-forest)]"
                defaultValue={query}
                id="demo-q"
                name="q"
                placeholder="책 제목, 저자, ISBN"
              />
            </div>
            <Button
              disabled={!ready || searchState === "loading"}
              size="lg"
              type="submit"
            >
              {searchState === "loading" ? "검색 중" : "검색"}
            </Button>
          </form>
        </section>

        {searchState === "done" || results.length > 0 ? (
          <section className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
            <h2 className="text-xl font-semibold">검색 결과</h2>
            {results.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
                검색 결과가 없습니다. 아래에서 직접 입력할 수 있습니다.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {results.map((book) => (
                  <form
                    className="flex gap-3 rounded-md border border-[var(--color-line)] bg-white/70 p-3"
                    key={`${book.provider}:${book.providerId}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      onAddBook(book, parseReadingStatus(formData.get("status")));
                    }}
                  >
                    <BookCover
                      authors={book.authors}
                      className="w-20 shrink-0"
                      coverUrl={book.coverUrl}
                      title={book.title}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-semibold">
                        {book.title}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                        {formatAuthors(book.authors)}
                      </p>
                      <p className="mt-2 text-xs text-[var(--color-muted)]">
                        {book.publishedYear ?? "연도 미상"}
                        {book.pageCount ? ` · ${book.pageCount}쪽` : ""}
                      </p>
                      <label className="mt-3 block text-xs text-[var(--color-muted)]">
                        시작 상태
                        <select
                          className="mt-1 h-9 w-full rounded-md border border-[var(--color-line)] bg-white px-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-forest)]"
                          defaultValue="reading"
                          name="status"
                        >
                          <option value="reading">읽는 중</option>
                          <option value="want_to_read">읽고 싶음</option>
                        </select>
                      </label>
                      <Button
                        className="mt-3"
                        disabled={!ready}
                        size="sm"
                        type="submit"
                      >
                        서재에 추가
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <h2 className="text-xl font-semibold">직접 입력</h2>
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={onSubmitManualBook}
          >
            <input
              className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
              name="title"
              placeholder="책 제목"
              required
            />
            <input
              className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
              name="authorsText"
              placeholder="저자, 쉼표로 구분"
            />
            <input
              className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
              min="1"
              name="pageCount"
              placeholder="전체 페이지"
              type="number"
            />
            <select
              className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
              defaultValue="reading"
              name="status"
            >
              <option value="reading">읽는 중</option>
              <option value="want_to_read">읽고 싶음</option>
            </select>
            <Button disabled={!ready} type="submit">
              직접 추가
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}

function DetailView({
  item,
  logs,
  message,
  ready,
  onArchive,
  onDelete,
  onDeleteLog,
  onFinishBook,
  onLog,
  onStatus,
  onUpdateLog,
  onUpdateMetadata,
}: {
  item: LibraryItemWithBook;
  logs: ReadingLog[];
  message: string | null;
  ready: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onDeleteLog: (logId: string) => void;
  onFinishBook: (
    event: FormEvent<HTMLFormElement>,
    item: LibraryItemWithBook,
  ) => void;
  onLog: (event: FormEvent<HTMLFormElement>, item: LibraryItemWithBook) => void;
  onStatus: (status: ReadingStatus) => void;
  onUpdateLog: (
    logId: string,
    item: LibraryItemWithBook,
    draft: {
      currentPage: number | null;
      currentPercent: number | null;
      pagesRead: number | null;
      note: string | null;
    },
  ) => boolean;
  onUpdateMetadata: (
    itemId: string,
    updates: { title: string; authors: string[]; pageCount: number | null },
  ) => void;
}) {
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const progress =
    item.currentPercent ??
    calculateProgress({
      currentPage: item.currentPage,
      pageCount: item.book.pageCount,
    });

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <ButtonLink className="mb-5" href="/" variant="ghost">
            <ArrowLeft className="size-4" />
            독서장
          </ButtonLink>
          <BookCover
            authors={item.book.authors}
            className="mx-auto w-44"
            coverUrl={item.book.coverUrl}
            title={item.book.title}
          />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            {item.book.title}
          </h1>
          <p className="mt-2 text-[var(--color-muted)]">
            {formatAuthors(item.book.authors)}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {item.book.pageCount ? `전체 페이지 ${item.book.pageCount}쪽` : "페이지 미상"}
          </p>
          <ProgressBar className="mt-5" value={progress} />
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {progress}% 진행 · 상태 {statusLabel(item.status)}
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-4 lg:grid-cols-1">
            <StatusButton
              icon={<Bookmark className="size-4" />}
              label="읽고 싶음"
              ready={ready}
              onClick={() => onStatus("want_to_read")}
            />
            <StatusButton
              icon={<Bookmark className="size-4" />}
              label="읽는 중"
              ready={ready}
              onClick={() => onStatus("reading")}
            />
            <StatusButton
              icon={<PauseCircle className="size-4" />}
              label="잠시 멈춤"
              ready={ready}
              onClick={() => onStatus("paused")}
            />
            <StatusButton
              icon={<CheckCircle2 className="size-4" />}
              label="완독 표시"
              ready={ready}
              onClick={() => onStatus("finished")}
            />
          </div>

          <section className="mt-5 rounded-md border border-[var(--color-line)] bg-white/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">책 정보</h2>
              <Button
                onClick={() => setEditingMetadata((value) => !value)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {editingMetadata ? (
                  <X className="size-4" />
                ) : (
                  <Pencil className="size-4" />
                )}
                {editingMetadata ? "닫기" : "책 정보 수정"}
              </Button>
            </div>
            {editingMetadata ? (
              <form
                className="mt-3 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  const title = stringOrNull(formData.get("title"));
                  if (!title) {
                    return;
                  }
                  onUpdateMetadata(item.id, {
                    title,
                    authors: parseAuthorText(formData.get("authorsText")),
                    pageCount: numberOrNull(formData.get("pageCount")),
                  });
                  setEditingMetadata(false);
                }}
              >
                <input
                  aria-label="책 제목"
                  className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                  defaultValue={item.book.title}
                  name="title"
                  required
                />
                <input
                  aria-label="저자"
                  className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                  defaultValue={formatAuthors(item.book.authors)}
                  name="authorsText"
                />
                <input
                  aria-label="전체 페이지"
                  className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                  defaultValue={item.book.pageCount ?? ""}
                  min="1"
                  name="pageCount"
                  type="number"
                />
                <Button disabled={!ready} size="sm" type="submit" variant="secondary">
                  <Save className="size-4" />
                  저장
                </Button>
              </form>
            ) : null}
          </section>

          <div className="mt-5 grid gap-2">
            <Button
              className="w-full"
              disabled={!ready}
              onClick={() => {
                if (
                  window.confirm(
                    "이 책을 보관함으로 이동할까요? 독서장에서는 숨겨지고 보관함에서 복원할 수 있습니다.",
                  )
                ) {
                  onArchive();
                }
              }}
              type="button"
              variant="secondary"
            >
              <Archive className="size-4" />
              보관함으로 이동
            </Button>
            <Button
              className="w-full"
              disabled={!ready}
              onClick={() => {
                if (window.confirm("이 책과 기록을 모두 삭제할까요?")) {
                  onDelete();
                }
              }}
              type="button"
              variant="danger"
            >
              <Trash2 className="size-4" />
              영구 삭제
            </Button>
          </div>
        </aside>

        <section className="grid gap-5">
          {message ? <Notice>{message}</Notice> : null}

          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
            <h2 className="text-xl font-semibold">오늘 기록</h2>
            <form
              className="mt-4 grid gap-3 md:grid-cols-3"
              onSubmit={(event) => onLog(event, item)}
            >
              {item.book.pageCount ? (
                <input
                  className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                  defaultValue={item.currentPage ?? ""}
                  max={item.book.pageCount}
                  min="0"
                  name="currentPage"
                  placeholder="현재 페이지"
                  type="number"
                />
              ) : (
                <input
                  className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                  defaultValue={item.currentPercent ?? ""}
                  max="100"
                  min="0"
                  name="currentPercent"
                  placeholder="현재 퍼센트"
                  type="number"
                />
              )}
              <input
                className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                min="0"
                name="pagesRead"
                placeholder="오늘 읽은 쪽"
                type="number"
              />
              <Button disabled={!ready} type="submit">
                기록 저장
              </Button>
              <textarea
                className="min-h-24 rounded-md border border-[var(--color-line)] bg-white px-3 py-3 outline-none focus:border-[var(--color-forest)] md:col-span-3"
                maxLength={500}
                name="note"
                placeholder="한 줄 메모"
              />
            </form>
          </div>

          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
            <h2 className="text-xl font-semibold">완독 회고</h2>
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => onFinishBook(event, item)}
            >
              <select
                className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                defaultValue={item.rating ?? ""}
                name="rating"
              >
                <option value="">별점 없이 남기기</option>
                <option value="5">5 · 오래 남을 책</option>
                <option value="4">4 · 좋았다</option>
                <option value="3">3 · 무난했다</option>
                <option value="2">2 · 아쉬웠다</option>
                <option value="1">1 · 맞지 않았다</option>
              </select>
              <textarea
                className="min-h-28 rounded-md border border-[var(--color-line)] bg-white px-3 py-3 outline-none focus:border-[var(--color-forest)]"
                defaultValue={item.reflection ?? ""}
                name="reflection"
                placeholder="읽고 남은 생각"
              />
              <Button disabled={!ready} type="submit" variant="secondary">
                <BookCheck className="size-4" />
                완독 저장
              </Button>
            </form>
            {item.status === "finished" ? (
              <Button
                className="mt-3"
                disabled={!ready}
                onClick={() => onStatus("reading")}
                type="button"
                variant="ghost"
              >
                <RotateCcw className="size-4" />
                완독 취소
              </Button>
            ) : null}
            {item.reflection ? (
              <p className="mt-4 rounded-md border border-[var(--color-line)] bg-white/70 p-4 text-sm leading-6 text-[var(--color-muted)]">
                {item.reflection}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
            <h2 className="text-xl font-semibold">기록 타임라인</h2>
            {logs.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-[var(--color-line)] bg-white/50 p-5 text-sm leading-6 text-[var(--color-muted)]">
                아직 기록이 없습니다. 오늘 읽은 위치부터 남겨보세요.
              </p>
            ) : (
              <LogList
                editingLogId={editingLogId}
                item={item}
                logs={logs}
                ready={ready}
                onCancelEdit={() => setEditingLogId(null)}
                onDeleteLog={onDeleteLog}
                onEditLog={setEditingLogId}
                onUpdateLog={(logId, draft) => {
                  if (onUpdateLog(logId, item, draft)) {
                    setEditingLogId(null);
                  }
                }}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ArchiveView({
  items,
  onDeleteItem,
  onRestoreItem,
}: {
  items: LibraryItemWithBook[];
  onDeleteItem: (itemId: string) => void;
  onRestoreItem: (itemId: string) => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Reading Room</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              보관함
            </h1>
          </div>
          <ButtonLink href="/" variant="secondary">
            독서장
          </ButtonLink>
        </header>

        <Panel title="보관한 책">
          {items.length === 0 ? (
            <EmptyState body="보관한 책이 없습니다." title="보관함이 비어 있습니다." />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <article
                  className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
                  key={item.id}
                >
                  <BookCard item={item} cover="large" />
                  <Button
                    className="mt-3"
                    onClick={() => onRestoreItem(item.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    <RotateCcw className="size-4" />
                    복원
                  </Button>
                  <Button
                    className="mt-3"
                    onClick={() => {
                      if (window.confirm("이 책과 기록을 모두 삭제할까요?")) {
                        onDeleteItem(item.id);
                      }
                    }}
                    size="sm"
                    type="button"
                    variant="danger"
                  >
                    <Trash2 className="size-4" />
                    영구 삭제
                  </Button>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}

function RankingsView({
  items,
  logs,
}: {
  items: LibraryItemWithBook[];
  logs: ReadingLog[];
}) {
  const rankings = aggregateAnonymousRankings({ items, logs });

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Reading Room</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              익명 독서 랭킹
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/" variant="secondary">
              독서장
            </ButtonLink>
            <ButtonLink href="/recommendations" variant="primary">
              추천
            </ButtonLink>
          </div>
        </header>

        <DemoRankingSection
          books={rankings.popular}
          icon={<Trophy className="size-5" />}
          metric="libraryCount"
          title="인기 도서"
        />
        <DemoRankingSection
          books={rankings.rated}
          icon={<BookCheck className="size-5" />}
          metric="averageRating"
          title="높은 별점 책"
        />
        <DemoRankingSection
          books={rankings.active}
          icon={<Flame className="size-5" />}
          metric="recentLogCount"
          title="최근 많이 읽은 책"
        />
      </div>
    </main>
  );
}

function DemoRankingSection({
  books,
  icon,
  metric,
  title,
}: {
  books: ReturnType<typeof aggregateAnonymousRankings>["popular"];
  icon: ReactNode;
  metric: "libraryCount" | "averageRating" | "recentLogCount";
  title: string;
}) {
  return (
    <Panel title={title}>
      <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
        {icon}
      </div>
      {books.length === 0 ? (
        <EmptyState body="아직 집계할 기록이 없습니다." title="랭킹이 비어 있습니다." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {books.map((book, index) => (
            <article
              className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
              key={`${title}-${book.bookId}`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-forest)]">
                <BarChart3 className="size-4" />
                {index + 1}위 · {demoRankingMetricLabel(book, metric)}
              </p>
              <BookCover
                authors={book.authors}
                className="mt-3 w-full"
                coverUrl={book.coverUrl}
                title={book.title}
              />
              <h3 className="mt-3 line-clamp-2 font-semibold">{book.title}</h3>
              <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                {formatAuthors(book.authors)}
              </p>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function demoRankingMetricLabel(
  book: ReturnType<typeof aggregateAnonymousRankings>["popular"][number],
  metric: "libraryCount" | "averageRating" | "recentLogCount",
) {
  if (metric === "averageRating") {
    return `평균 ${(book.averageRating ?? 0).toFixed(1)}점 · ${book.ratingCount}명`;
  }

  return `${book[metric]}회`;
}

function RecommendationsView({
  items,
  onAddRecommendation,
}: {
  items: LibraryItemWithBook[];
  onAddRecommendation: (card: RecommendationCard) => void;
}) {
  const [purpose, setPurpose] = useState<DemoRecommendationPurpose>("auto");
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() =>
    readHiddenRecommendationKeys(),
  );
  const cards = createDemoRecommendations(items, purpose).filter(
    (card) => !hiddenKeys.includes(recommendationKey(card)),
  );

  function hideRecommendation(card: RecommendationCard) {
    const key = recommendationKey(card);
    setHiddenKeys((current) => {
      const next = [...new Set([...current, key])];
      window.localStorage.setItem(
        HIDDEN_RECOMMENDATIONS_KEY,
        JSON.stringify(next),
      );
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Reading Room</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              내 서재 기반 추천
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/" variant="secondary">
              독서장
            </ButtonLink>
            <ButtonLink href="/rankings" variant="secondary">
              랭킹
            </ButtonLink>
          </div>
        </header>

        <Panel title="추천 도서">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
                <Lightbulb className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-forest)]">
                  로컬 추천 피드
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  목적을 바꾸면 데모에서도 후보가 즉시 갱신됩니다.
                </p>
              </div>
            </div>
            <div
              aria-label="추천 목적"
              className="flex flex-wrap gap-2"
              role="group"
            >
              {[
                ["auto", "자동"],
                ["short", "짧게 완독"],
                ["deep", "깊이 읽기"],
                ["explore", "새로운 결"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  onClick={() => setPurpose(value as DemoRecommendationPurpose)}
                  size="sm"
                  type="button"
                  variant={purpose === value ? "primary" : "secondary"}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {cards.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <article
                  className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
                  key={`${card.provider}:${card.providerId}`}
                >
                  <div className="flex gap-3">
                    <BookCover
                      authors={card.authors}
                      className="w-24 shrink-0"
                      coverUrl={card.coverUrl}
                      title={card.title}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 font-semibold">
                        {card.title}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                        {formatAuthors(card.authors)}
                      </p>
                      <p className="mt-2 text-xs text-[var(--color-muted)]">
                        {card.pageCount ? `${card.pageCount}쪽 · ` : ""}
                        로컬 추천 · {card.matchScore ?? 72}% 적합
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                    {card.reason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => onAddRecommendation(card)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <BookPlus className="size-4" />
                      서재에 추가
                    </Button>
                    <Button
                      onClick={() => hideRecommendation(card)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      이 책 제외
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-[var(--color-line)] bg-white/70 p-4 text-sm leading-6 text-[var(--color-muted)]">
              이 조건의 추천을 모두 제외했습니다. 다른 목적을 선택하면 새 후보를 볼 수 있습니다.
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}

function createDemoRecommendations(
  items: LibraryItemWithBook[],
  purpose: DemoRecommendationPurpose = "auto",
): RecommendationCard[] {
  const visibleItems = items.filter((item) => item.status !== "abandoned");
  const anchor = visibleItems[0];
  const second = visibleItems[1];
  const label = {
    auto: "자동 추천",
    short: "짧은 추천",
    deep: "깊은 추천",
    explore: "탐색 추천",
  } satisfies Record<DemoRecommendationPurpose, string>;
  const title = {
    auto: "추천 도서",
    short: "짧은 밤의 책",
    deep: "깊이 읽는 책",
    explore: "낯선 장르 산책",
  } satisfies Record<DemoRecommendationPurpose, string>;
  const sideTitle = {
    auto: "추천 산책",
    short: "가볍게 완독",
    deep: "긴 호흡의 질문",
    explore: "새로운 결",
  } satisfies Record<DemoRecommendationPurpose, string>;
  const firstSection =
    purpose === "short" ? "short" : purpose === "explore" ? "expand" : "purpose";

  return [
    {
      title: title[purpose],
      authors: anchor?.book.authors.length ? anchor.book.authors : ["Reading Room"],
      reason: anchor
        ? `${anchor.book.title}${
            second ? `, ${second.book.title}` : ""
          }의 결을 이어서 ${label[purpose]}으로 남기기 좋은 책입니다.`
        : `첫 독서 기록을 시작하기 좋은 ${label[purpose]}입니다.`,
      reasonTags: [label[purpose], "국내판 확인"],
      matchScore: purpose === "auto" ? 78 : 84,
      section: firstSection,
      isFallback: true,
      domesticVerified: true,
      source: "local-demo",
      provider: "manual",
      providerId: `demo-recommendation-${purpose}-${anchor?.book.id ?? "starter"}`,
      coverUrl: null,
      pageCount: purpose === "short" ? 164 : (anchor?.book.pageCount ?? 220),
    },
    {
      title: sideTitle[purpose],
      authors: ["Reading Room"],
      reason:
        purpose === "deep"
          ? "최근 기록의 질문을 더 깊게 이어갈 수 있도록 긴 호흡의 후보를 골랐습니다."
          : purpose === "explore"
            ? "서재에 아직 적은 결을 넓히기 위한 국내판 탐색 후보입니다."
            : "최근 읽은 책의 속도와 메모량을 기준으로 부담 없이 이어갈 수 있는 후보입니다.",
      reasonTags: [label[purpose], "로컬 피드", "국내판 확인"],
      matchScore: purpose === "auto" ? 72 : 80,
      section: purpose === "explore" ? "expand" : purpose === "short" ? "short" : "now",
      isFallback: true,
      domesticVerified: true,
      source: "local-demo",
      provider: "manual",
      providerId: `demo-recommendation-${purpose}-walk`,
      coverUrl: null,
      pageCount: purpose === "deep" ? 360 : 180,
    },
  ];
}

function readHiddenRecommendationKeys() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(HIDDEN_RECOMMENDATIONS_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function recommendationKey(card: RecommendationCard) {
  return `${card.provider}:${card.providerId}`;
}

function MissingItemView() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 text-[var(--color-ink)]">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">책을 찾지 못했습니다.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          이 브라우저에 저장된 책장이 비어 있거나 다른 기기에서 만든 기록입니다.
        </p>
        <ButtonLink className="mt-5" href="/search">
          책 추가
        </ButtonLink>
      </div>
    </main>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
        {icon}
      </div>
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function BookCard({
  item,
  cover = "compact",
}: {
  item: LibraryItemWithBook;
  cover?: "compact" | "large";
}) {
  const progress =
    item.currentPercent ??
    calculateProgress({
      currentPage: item.currentPage,
      pageCount: item.book.pageCount,
    });

  return (
    <ButtonLink
      className="h-auto justify-start p-0 text-left"
      href={`/library/${item.id}`}
      variant="ghost"
    >
      <article className="w-full rounded-md border border-[var(--color-line)] bg-white/70 p-3 transition hover:border-[var(--color-forest)]">
        <div className={cover === "large" ? "grid gap-3" : "flex gap-3"}>
          <BookCover
            authors={item.book.authors}
            className={cover === "large" ? "mb-1 w-full" : "w-20 shrink-0"}
            coverUrl={item.book.coverUrl}
            title={item.book.title}
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-semibold">{item.book.title}</h3>
            <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
              {formatAuthors(item.book.authors)}
            </p>
            {cover === "compact" ? (
              <>
                <ProgressBar className="mt-4" value={progress} />
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {progress}% 진행
                </p>
              </>
            ) : null}
          </div>
        </div>
      </article>
    </ButtonLink>
  );
}

function LogList({
  editingLogId,
  item,
  logs,
  ready = true,
  onCancelEdit,
  onDeleteLog,
  onEditLog,
  onUpdateLog,
}: {
  editingLogId?: string | null;
  item?: LibraryItemWithBook;
  logs: ReadingLog[];
  ready?: boolean;
  onCancelEdit?: () => void;
  onDeleteLog?: (logId: string) => void;
  onEditLog?: (logId: string) => void;
  onUpdateLog?: (
    logId: string,
    draft: {
      currentPage: number | null;
      currentPercent: number | null;
      pagesRead: number | null;
      note: string | null;
    },
  ) => void;
}) {
  return (
    <ol className="mt-4 space-y-3">
      {logs.map((log) => (
        <li
          className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
          key={log.id}
        >
          {editingLogId === log.id && item && onUpdateLog ? (
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                onUpdateLog(log.id, {
                  currentPage: numberOrNull(formData.get("currentPage")),
                  currentPercent: numberOrNull(formData.get("currentPercent")),
                  pagesRead: numberOrNull(formData.get("pagesRead")),
                  note: stringOrNull(formData.get("note")),
                });
              }}
            >
              {item.book.pageCount ? (
                <input
                  aria-label="현재 페이지"
                  className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                  defaultValue={log.currentPage ?? ""}
                  max={item.book.pageCount}
                  min="0"
                  name="currentPage"
                  type="number"
                />
              ) : (
                <input
                  aria-label="현재 퍼센트"
                  className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                  defaultValue={log.currentPercent ?? ""}
                  max="100"
                  min="0"
                  name="currentPercent"
                  type="number"
                />
              )}
              <input
                aria-label="오늘 읽은 쪽"
                className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
                defaultValue={log.pagesRead ?? ""}
                min="0"
                name="pagesRead"
                type="number"
              />
              <div className="flex gap-2">
                <Button disabled={!ready} type="submit">
                  기록 저장
                </Button>
                <Button onClick={onCancelEdit} type="button" variant="ghost">
                  취소
                </Button>
              </div>
              <textarea
                aria-label="메모"
                className="min-h-24 rounded-md border border-[var(--color-line)] bg-white px-3 py-3 outline-none focus:border-[var(--color-forest)] md:col-span-3"
                defaultValue={log.note ?? ""}
                maxLength={500}
                name="note"
              />
            </form>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {formatDate(log.loggedAt)}
                    {log.pagesRead ? ` · ${log.pagesRead}쪽` : null}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                    {log.note ?? "메모 없이 진행만 기록했습니다."}
                  </p>
                </div>
                {onEditLog || onDeleteLog ? (
                  <div className="flex shrink-0 gap-2">
                    {onEditLog ? (
                      <Button
                        disabled={!ready}
                        onClick={() => onEditLog(log.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Pencil className="size-4" />
                        기록 수정
                      </Button>
                    ) : null}
                    {onDeleteLog ? (
                      <Button
                        disabled={!ready}
                        onClick={() => {
                          if (window.confirm("이 기록을 삭제할까요?")) {
                            onDeleteLog(log.id);
                          }
                        }}
                        size="sm"
                        type="button"
                        variant="danger"
                      >
                        <Trash2 className="size-4" />
                        기록 삭제
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

function StatusButton({
  icon,
  label,
  ready,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ready: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className="w-full"
      disabled={!ready}
      onClick={onClick}
      type="button"
      variant="secondary"
    >
      {icon}
      {label}
    </Button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-md border border-dashed border-[var(--color-line)] bg-white/50 p-5">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5 rounded-md border border-[var(--color-line)] bg-white/70 p-3 text-sm leading-6 text-[var(--color-muted)]">
      {children}
    </p>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    want_to_read: "읽고 싶음",
    reading: "읽는 중",
    paused: "잠시 멈춤",
    finished: "완독",
    abandoned: "보관",
  };
  return labels[status] ?? status;
}

function readState(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState;
    }

    const parsed = JSON.parse(raw) as Partial<DemoState>;

    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return emptyState;
  }
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseAuthorText(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean);
}

function parseReadingStatus(value: FormDataEntryValue | null): ReadingStatus {
  return isReadingStatus(value) ? value : "reading";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
