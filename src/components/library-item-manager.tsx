"use client";

import {
  Archive,
  ArrowLeft,
  BookCheck,
  Bookmark,
  CheckCircle2,
  PauseCircle,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useState,
} from "react";
import {
  addReadingLogAction,
  archiveLibraryItemAction,
  deleteLibraryItemAction,
  deleteReadingLogAction,
  finishBookAction,
  updateLibraryItemMetadataAction,
  updateReadingLogAction,
  updateReadingStatusAction,
} from "@/app/actions/library";
import { BookCover } from "@/components/ui/book-cover";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { idleActionState, type ActionState } from "@/lib/library/validation";
import { calculateProgress } from "@/lib/reading/progress";
import type {
  LibraryItemWithBook,
  ReadingLog,
  ReadingStatus,
} from "@/lib/reading/types";
import { formatAuthors, formatDate } from "@/lib/utils";

type LibraryItemManagerProps = {
  item: LibraryItemWithBook;
  logs: ReadingLog[];
};

export function LibraryItemManager({ item, logs }: LibraryItemManagerProps) {
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

          <StatusControls itemId={item.id} />
          <MetadataEditor item={item} />
          <DangerZone itemId={item.id} />
        </aside>

        <section className="grid gap-5">
          <ReadingLogForm item={item} />
          <FinishForm item={item} />
          <Timeline item={item} logs={logs} />
        </section>
      </div>
    </main>
  );
}

function MetadataEditor({ item }: { item: LibraryItemWithBook }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateLibraryItemMetadataAction,
    idleActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <section className="mt-5 rounded-md border border-[var(--color-line)] bg-white/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">책 정보</h2>
        <Button
          onClick={() => setEditing((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
          {editing ? "닫기" : "책 정보 수정"}
        </Button>
      </div>
      {editing ? (
        <form action={formAction} className="mt-3 grid gap-3">
          <input name="libraryItemId" type="hidden" value={item.id} />
          <input
            aria-label="책 제목"
            className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
            defaultValue={item.book.title}
            name="title"
            placeholder="책 제목"
            required
          />
          <input
            aria-label="저자"
            className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
            defaultValue={formatAuthors(item.book.authors)}
            name="authorsText"
            placeholder="저자"
          />
          <input
            aria-label="전체 페이지"
            className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
            defaultValue={item.book.pageCount ?? ""}
            min="1"
            name="pageCount"
            placeholder="전체 페이지"
            type="number"
          />
          <Button disabled={pending} size="sm" type="submit" variant="secondary">
            <Save className="size-4" />
            {pending ? "저장 중" : "저장"}
          </Button>
          <ActionNotice state={state} />
        </form>
      ) : (
        <ActionNotice state={state} />
      )}
    </section>
  );
}

function StatusControls({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateReadingStatusAction,
    idleActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="mt-5 grid gap-2 sm:grid-cols-4 lg:grid-cols-1">
      <input name="libraryItemId" type="hidden" value={itemId} />
      <StatusButton
        icon={<Bookmark className="size-4" />}
        label="읽고 싶음"
        pending={pending}
        status="want_to_read"
      />
      <StatusButton
        icon={<Bookmark className="size-4" />}
        label="읽는 중"
        pending={pending}
        status="reading"
      />
      <StatusButton
        icon={<PauseCircle className="size-4" />}
        label="잠시 멈춤"
        pending={pending}
        status="paused"
      />
      <StatusButton
        icon={<CheckCircle2 className="size-4" />}
        label="완독 표시"
        pending={pending}
        status="finished"
      />
      <div className="sm:col-span-4 lg:col-span-1">
        <ActionNotice state={state} />
      </div>
    </form>
  );
}

function StatusButton({
  icon,
  label,
  pending,
  status,
}: {
  icon: ReactNode;
  label: string;
  pending: boolean;
  status: ReadingStatus;
}) {
  return (
    <Button
      className="w-full"
      disabled={pending}
      name="status"
      type="submit"
      value={status}
      variant="secondary"
    >
      {icon}
      {label}
    </Button>
  );
}

function DangerZone({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveLibraryItemAction,
    idleActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLibraryItemAction,
    idleActionState,
  );

  useEffect(() => {
    if (archiveState.status === "success" || deleteState.status === "success") {
      router.push("/");
      router.refresh();
    }
  }, [archiveState.status, deleteState.status, router]);

  return (
    <section className="mt-5 grid gap-2">
      <form
        action={archiveAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "이 책을 보관함으로 이동할까요? 독서장에서는 숨겨지고 보관함에서 복원할 수 있습니다.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input name="libraryItemId" type="hidden" value={itemId} />
        <Button
          className="w-full"
          disabled={archivePending}
          type="submit"
          variant="secondary"
        >
          <Archive className="size-4" />
          {archivePending ? "보관 중" : "보관함으로 이동"}
        </Button>
      </form>
      <form
        action={deleteAction}
        onSubmit={(event) => {
          if (!window.confirm("이 책과 기록을 모두 삭제할까요?")) {
            event.preventDefault();
          }
        }}
      >
        <input name="libraryItemId" type="hidden" value={itemId} />
        <Button
          className="w-full"
          disabled={deletePending}
          type="submit"
          variant="danger"
        >
          <Trash2 className="size-4" />
          {deletePending ? "삭제 중" : "영구 삭제"}
        </Button>
      </form>
      <ActionNotice state={archiveState.status === "idle" ? deleteState : archiveState} />
    </section>
  );
}

function ReadingLogForm({ item }: { item: LibraryItemWithBook }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    addReadingLogAction,
    idleActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
      <h2 className="text-xl font-semibold">오늘 기록</h2>
      <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-3">
        <input name="libraryItemId" type="hidden" value={item.id} />
        <input name="pageCount" type="hidden" value={item.book.pageCount ?? ""} />
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
        <Button disabled={pending} type="submit">
          {pending ? "저장 중" : "기록 저장"}
        </Button>
        <textarea
          className="min-h-24 rounded-md border border-[var(--color-line)] bg-white px-3 py-3 outline-none focus:border-[var(--color-forest)] md:col-span-3"
          maxLength={500}
          name="note"
          placeholder="한 줄 메모"
        />
      </form>
      <ActionNotice state={state} />
    </div>
  );
}

function FinishForm({ item }: { item: LibraryItemWithBook }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    finishBookAction,
    idleActionState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    updateReadingStatusAction,
    idleActionState,
  );

  useEffect(() => {
    if (state.status === "success" || cancelState.status === "success") {
      router.refresh();
    }
  }, [cancelState.status, router, state.status]);

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
      <h2 className="text-xl font-semibold">완독 회고</h2>
      <form action={formAction} className="mt-4 grid gap-3">
        <input name="libraryItemId" type="hidden" value={item.id} />
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
          maxLength={2000}
          name="reflection"
          placeholder="읽고 남은 생각"
        />
        <Button disabled={pending} type="submit" variant="secondary">
          <BookCheck className="size-4" />
          {pending ? "저장 중" : "완독 저장"}
        </Button>
      </form>
      {item.status === "finished" ? (
        <form action={cancelAction} className="mt-3">
          <input name="libraryItemId" type="hidden" value={item.id} />
          <input name="status" type="hidden" value="reading" />
          <Button disabled={cancelPending} type="submit" variant="ghost">
            <RotateCcw className="size-4" />
            {cancelPending ? "취소 중" : "완독 취소"}
          </Button>
        </form>
      ) : null}
      <ActionNotice state={state} />
      <ActionNotice state={cancelState} />
      {item.reflection ? (
        <p className="mt-4 rounded-md border border-[var(--color-line)] bg-white/70 p-4 text-sm leading-6 text-[var(--color-muted)]">
          {item.reflection}
        </p>
      ) : null}
    </div>
  );
}

function Timeline({
  item,
  logs,
}: {
  item: LibraryItemWithBook;
  logs: ReadingLog[];
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
      <h2 className="text-xl font-semibold">기록 타임라인</h2>
      {logs.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-[var(--color-line)] bg-white/50 p-5 text-sm leading-6 text-[var(--color-muted)]">
          아직 기록이 없습니다. 오늘 읽은 위치부터 남겨보세요.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {logs.map((log) => (
            <ReadingLogEntry item={item} key={log.id} log={log} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ReadingLogEntry({
  item,
  log,
}: {
  item: LibraryItemWithBook;
  log: ReadingLog;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(
    updateReadingLogAction,
    idleActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteReadingLogAction,
    idleActionState,
  );

  useEffect(() => {
    if (updateState.status === "success") {
      router.refresh();
    }
    if (deleteState.status === "success") {
      router.refresh();
    }
  }, [deleteState.status, router, updateState.status]);

  return (
    <li className="rounded-md border border-[var(--color-line)] bg-white/70 p-3">
      {!editing ? (
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
            <div className="flex shrink-0 gap-2">
              <Button
                onClick={() => setEditing(true)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Pencil className="size-4" />
                기록 수정
              </Button>
              <form
                action={deleteAction}
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  if (!window.confirm("이 기록을 삭제할까요?")) {
                    event.preventDefault();
                  }
                }}
              >
                <input name="libraryItemId" type="hidden" value={item.id} />
                <input name="logId" type="hidden" value={log.id} />
                <Button
                  disabled={deletePending}
                  size="sm"
                  type="submit"
                  variant="danger"
                >
                  <Trash2 className="size-4" />
                  기록 삭제
                </Button>
              </form>
            </div>
          </div>
          <ActionNotice state={deleteState} />
        </>
      ) : (
        <form action={updateAction} className="grid gap-3 md:grid-cols-3">
          <input name="libraryItemId" type="hidden" value={item.id} />
          <input name="logId" type="hidden" value={log.id} />
          <input name="pageCount" type="hidden" value={item.book.pageCount ?? ""} />
          {item.book.pageCount ? (
            <input
              aria-label="현재 페이지"
              className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
              defaultValue={log.currentPage ?? ""}
              max={item.book.pageCount}
              min="0"
              name="currentPage"
              placeholder="현재 페이지"
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
              placeholder="현재 퍼센트"
              type="number"
            />
          )}
          <input
            aria-label="오늘 읽은 쪽"
            className="h-11 rounded-md border border-[var(--color-line)] bg-white px-3 outline-none focus:border-[var(--color-forest)]"
            defaultValue={log.pagesRead ?? ""}
            min="0"
            name="pagesRead"
            placeholder="오늘 읽은 쪽"
            type="number"
          />
          <div className="flex gap-2">
            <Button disabled={updatePending} type="submit">
              {updatePending ? "저장 중" : "기록 저장"}
            </Button>
            <Button
              onClick={() => setEditing(false)}
              type="button"
              variant="ghost"
            >
              취소
            </Button>
          </div>
          <textarea
            aria-label="메모"
            className="min-h-24 rounded-md border border-[var(--color-line)] bg-white px-3 py-3 outline-none focus:border-[var(--color-forest)] md:col-span-3"
            defaultValue={log.note ?? ""}
            maxLength={500}
            name="note"
            placeholder="한 줄 메모"
          />
          <div className="md:col-span-3">
            <ActionNotice state={updateState} />
          </div>
        </form>
      )}
    </li>
  );
}

function ActionNotice({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className="mt-3 rounded-md border border-[var(--color-line)] bg-white/70 p-3 text-sm leading-6 text-[var(--color-muted)]"
    >
      {state.message}
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
