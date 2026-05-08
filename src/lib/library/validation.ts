import type { ReadingStatus } from "@/lib/reading/types";

export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const idleActionState: ActionState = {
  status: "idle",
  message: "",
};

export const readingStatuses = [
  "want_to_read",
  "reading",
  "paused",
  "finished",
  "abandoned",
] as const satisfies readonly ReadingStatus[];

export function isReadingStatus(value: unknown): value is ReadingStatus {
  return (
    typeof value === "string" &&
    readingStatuses.includes(value as ReadingStatus)
  );
}

export function validateRating(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return "별점은 1점에서 5점 사이로 남겨주세요.";
  }

  return null;
}

export function validatePageCount(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1) {
    return "전체 페이지는 1쪽 이상이어야 합니다.";
  }

  return null;
}

export function validateLibraryMetadata(input: {
  title: string | null;
  authors: string[];
  pageCount: number | null;
}): string[] {
  const errors: string[] = [];

  if (!input.title) {
    errors.push("책 제목을 입력해주세요.");
  }

  if (input.title && input.title.length > 200) {
    errors.push("책 제목은 200자 이내로 입력해주세요.");
  }

  if (input.authors.some((author) => author.length > 120)) {
    errors.push("저자 이름은 각각 120자 이내로 입력해주세요.");
  }

  const pageCountError = validatePageCount(input.pageCount);
  if (pageCountError) {
    errors.push(pageCountError);
  }

  return errors;
}

export function statusUpdateFields(status: ReadingStatus, today: string) {
  if (status === "finished") {
    return {
      status,
      finished_on: today,
    };
  }

  return {
    status,
    finished_on: null,
    rating: null,
    reflection: null,
  };
}

export function progressUpdateFields(
  currentStatus: ReadingStatus,
  currentPage: number | null,
  currentPercent: number | null,
) {
  if (currentStatus === "finished") {
    return {
      current_page: currentPage,
      current_percent: currentPercent,
    };
  }

  return {
    status: "reading" as const,
    finished_on: null,
    current_page: currentPage,
    current_percent: currentPercent,
  };
}

export function actionError(message: string): ActionState {
  return { status: "error", message };
}

export function actionSuccess(message: string): ActionState {
  return { status: "success", message };
}

export function sanitizeDatabaseError(
  error: { message?: string } | null | undefined,
) {
  void error;
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}
