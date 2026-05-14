import type { QuickLogDraft } from "@/lib/reading/types";

type ProgressInput = {
  currentPage: number | null;
  pageCount: number | null;
};

export type ReadingLogDraft = QuickLogDraft;

export type ValidationResult =
  | { ok: true; errors?: never }
  | { ok: false; errors: string[] };

export function calculateProgress({
  currentPage,
  pageCount,
}: ProgressInput): number {
  if (!pageCount || pageCount <= 0 || currentPage === null) {
    return 0;
  }

  const boundedPage = Math.min(Math.max(currentPage, 0), pageCount);
  return Math.round((boundedPage / pageCount) * 100);
}

export function validateReadingLog(draft: ReadingLogDraft): ValidationResult {
  const errors: string[] = [];
  const noteLength = draft.note?.trim().length ?? 0;

  if (
    draft.currentPage !== null &&
    draft.pageCount !== null &&
    draft.currentPage > draft.pageCount
  ) {
    errors.push("현재 페이지는 전체 페이지를 넘을 수 없습니다.");
  }

  if (draft.currentPage !== null && draft.currentPage < 0) {
    errors.push("현재 페이지는 0보다 작을 수 없습니다.");
  }

  if (
    draft.currentPercent !== null &&
    (draft.currentPercent < 0 || draft.currentPercent > 100)
  ) {
    errors.push("퍼센트는 0에서 100 사이여야 합니다.");
  }

  if (draft.pagesRead !== null && draft.pagesRead < 0) {
    errors.push("읽은 페이지 수는 0보다 작을 수 없습니다.");
  }

  if (noteLength > 500) {
    errors.push("메모는 500자 이내로 남겨주세요.");
  }

  if ((draft.quote?.length ?? 0) > 1000) {
    errors.push("인용문은 1000자 이내로 남겨주세요.");
  }

  if (
    draft.mood !== null &&
    draft.mood !== undefined &&
    draft.mood.trim().length === 0
  ) {
    errors.push("기분은 비워둘 수 없습니다.");
  }

  if (draft.tags?.some((tag) => tag.length === 0)) {
    errors.push("태그는 빈 값 없이 입력해주세요.");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
