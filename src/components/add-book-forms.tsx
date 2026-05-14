"use client";

import { BookPlus } from "lucide-react";
import { useActionState } from "react";
import {
  addManualBookState,
  addSearchResultToLibraryState,
} from "@/app/actions/library";
import { BookCover } from "@/components/ui/book-cover";
import { Button } from "@/components/ui/button";
import type { BookSearchResult } from "@/lib/books/types";
import { idleActionState, type ActionState } from "@/lib/library/validation";
import type { RecommendationCard } from "@/lib/recommendations/types";
import { formatAuthors } from "@/lib/utils";

type AddBookFormBook = Pick<
  BookSearchResult,
  | "provider"
  | "providerId"
  | "title"
  | "subtitle"
  | "authors"
  | "isbn10"
  | "isbn13"
  | "coverUrl"
  | "pageCount"
  | "publishedYear"
  | "language"
  | "description"
>;

export function SearchResultAddCard({ book }: { book: BookSearchResult }) {
  const [state, formAction, pending] = useActionState(
    addSearchResultToLibraryState,
    idleActionState,
  );

  return (
    <form
      action={formAction}
      className="flex gap-3 rounded-md border border-[var(--color-line)] bg-white/70 p-3"
    >
      <BookCover
        className="w-20 shrink-0"
        title={book.title}
        authors={book.authors}
        coverUrl={book.coverUrl}
      />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-semibold">{book.title}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
          {formatAuthors(book.authors)}
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          {book.publishedYear ?? "연도 미상"}
          {book.pageCount ? ` · ${book.pageCount}쪽` : ""}
        </p>
        <BookHiddenFields book={book} />
        <StatusSelect />
        <Button className="mt-3" disabled={pending} size="sm" type="submit">
          <BookPlus className="size-4" />
          {pending ? "추가 중" : "서재에 추가"}
        </Button>
        <ActionNotice state={state} />
      </div>
    </form>
  );
}

export function RecommendationAddForm({ card }: { card: RecommendationCard }) {
  const [state, formAction, pending] = useActionState(
    addSearchResultToLibraryState,
    idleActionState,
  );
  const book: AddBookFormBook = {
    provider: card.provider as BookSearchResult["provider"],
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
  };

  return (
    <form action={formAction} className="mt-3">
      <BookHiddenFields book={book} />
      <input name="recommendationAuthors" type="hidden" value={JSON.stringify(card.authors)} />
      <input name="recommendationCoverUrl" type="hidden" value={card.coverUrl ?? ""} />
      <input name="recommendationPageCount" type="hidden" value={card.pageCount ?? ""} />
      <input name="recommendationProvider" type="hidden" value={card.provider} />
      <input name="recommendationProviderId" type="hidden" value={card.providerId} />
      <input name="recommendationReason" type="hidden" value={card.reason} />
      <input name="recommendationSection" type="hidden" value={card.section ?? ""} />
      <input name="recommendationSource" type="hidden" value={card.source} />
      <input name="recommendationTitle" type="hidden" value={card.title} />
      <StatusSelect />
      <Button disabled={pending} size="sm" type="submit" variant="secondary">
        <BookPlus className="size-4" />
        {pending ? "추가 중" : "서재에 추가"}
      </Button>
      <ActionNotice state={state} />
    </form>
  );
}

export function ManualBookForm() {
  const [state, formAction, pending] = useActionState(
    addManualBookState,
    idleActionState,
  );

  return (
    <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-2">
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
      <StatusSelect className="mt-0" />
      <Button disabled={pending} type="submit">
        {pending ? "추가 중" : "직접 추가"}
      </Button>
      <div className="md:col-span-2">
        <ActionNotice state={state} />
      </div>
    </form>
  );
}

function BookHiddenFields({ book }: { book: AddBookFormBook }) {
  return (
    <>
      <input name="provider" type="hidden" value={book.provider} />
      <input name="providerId" type="hidden" value={book.providerId} />
      <input name="title" type="hidden" value={book.title} />
      <input name="subtitle" type="hidden" value={book.subtitle ?? ""} />
      <input name="authors" type="hidden" value={JSON.stringify(book.authors)} />
      <input name="isbn10" type="hidden" value={book.isbn10 ?? ""} />
      <input name="isbn13" type="hidden" value={book.isbn13 ?? ""} />
      <input name="coverUrl" type="hidden" value={book.coverUrl ?? ""} />
      <input name="pageCount" type="hidden" value={book.pageCount ?? ""} />
      <input
        name="publishedYear"
        type="hidden"
        value={book.publishedYear ?? ""}
      />
      <input name="language" type="hidden" value={book.language ?? ""} />
      <input name="description" type="hidden" value={book.description ?? ""} />
    </>
  );
}

function StatusSelect({ className = "mt-3" }: { className?: string }) {
  return (
    <label className={`block text-xs text-[var(--color-muted)] ${className}`}>
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
  );
}

function ActionNotice({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className="mt-2 rounded-md border border-[var(--color-line)] bg-white/80 p-2 text-sm leading-6 text-[var(--color-muted)]"
    >
      {state.message}
    </p>
  );
}
