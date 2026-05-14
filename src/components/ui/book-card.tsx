import Link from "next/link";
import { BookCover } from "@/components/ui/book-cover";
import { ProgressBar } from "@/components/ui/progress-bar";
import { calculateProgress } from "@/lib/reading/progress";
import type { LibraryItemWithBook } from "@/lib/reading/types";
import { cn, formatAuthors, formatDate } from "@/lib/utils";

const statusLabels: Record<LibraryItemWithBook["status"], string> = {
  want_to_read: "읽고 싶음",
  reading: "읽는 중",
  paused: "멈춤",
  finished: "완독",
  abandoned: "보관",
};

type BookCardProps = {
  item: LibraryItemWithBook;
  compact?: boolean;
  meta?: string;
};

export function BookCard({ item, compact = false, meta }: BookCardProps) {
  const progress =
    item.currentPercent ??
    calculateProgress({
      currentPage: item.currentPage,
      pageCount: item.book.pageCount,
    });

  return (
    <Link
      className={cn(
        "block rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3 transition hover:border-[var(--color-forest)] hover:bg-white",
        compact ? "h-full" : "",
      )}
      href={`/library/${item.id}`}
      prefetch={false}
    >
      <div className="flex gap-3">
        <BookCover
          authors={item.book.authors}
          className={compact ? "w-14 shrink-0" : "w-20 shrink-0"}
          coverUrl={item.book.coverUrl}
          title={item.book.title}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5">
              {item.book.title}
            </h3>
            <span className="shrink-0 rounded-sm bg-[var(--color-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
              {statusLabels[item.status]}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--color-muted)]">
            {formatAuthors(item.book.authors)}
          </p>
          {item.status === "reading" || progress > 0 ? (
            <>
              <ProgressBar className="mt-3" value={progress} />
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {progress}% · {item.currentPage ?? 0}
                {item.book.pageCount ? `/${item.book.pageCount}` : ""}쪽
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              {meta ??
                (item.finishedOn
                  ? `완독 ${formatDate(item.finishedOn)}`
                  : "기록 없음")}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
