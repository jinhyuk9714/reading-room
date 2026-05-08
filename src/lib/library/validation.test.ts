import { describe, expect, it } from "vitest";
import {
  isReadingStatus,
  progressUpdateFields,
  sanitizeDatabaseError,
  statusUpdateFields,
  validateLibraryMetadata,
  validatePageCount,
  validateRating,
} from "@/lib/library/validation";

describe("library validation", () => {
  it("accepts only supported reading statuses", () => {
    expect(isReadingStatus("reading")).toBe(true);
    expect(isReadingStatus("finished")).toBe(true);
    expect(isReadingStatus("archived")).toBe(false);
    expect(isReadingStatus(null)).toBe(false);
  });

  it("validates ratings and page counts", () => {
    expect(validateRating(null)).toBeNull();
    expect(validateRating(5)).toBeNull();
    expect(validateRating(0)).toMatch("별점");
    expect(validateRating(6)).toMatch("별점");
    expect(validatePageCount(null)).toBeNull();
    expect(validatePageCount(320)).toBeNull();
    expect(validatePageCount(0)).toMatch("전체 페이지");
  });

  it("validates editable per-user book metadata", () => {
    expect(
      validateLibraryMetadata({
        title: "작별하지 않는다",
        authors: ["한강"],
        pageCount: 332,
      }),
    ).toEqual([]);

    expect(
      validateLibraryMetadata({
        title: null,
        authors: [],
        pageCount: -1,
      }),
    ).toEqual(["책 제목을 입력해주세요.", "전체 페이지는 1쪽 이상이어야 합니다."]);
  });

  it("sets finished date only while a book is marked finished", () => {
    expect(statusUpdateFields("finished", "2026-05-08")).toEqual({
      status: "finished",
      finished_on: "2026-05-08",
    });
    expect(statusUpdateFields("reading", "2026-05-08")).toEqual({
      status: "reading",
      finished_on: null,
      rating: null,
      reflection: null,
    });
  });

  it("preserves finished status when progress is edited after completion", () => {
    expect(progressUpdateFields("finished", 120, null)).toEqual({
      current_page: 120,
      current_percent: null,
    });
    expect(progressUpdateFields("paused", null, 55)).toEqual({
      status: "reading",
      finished_on: null,
      current_page: null,
      current_percent: 55,
    });
  });

  it("sanitizes raw database errors before showing them to users", () => {
    expect(
      sanitizeDatabaseError({
        message:
          'duplicate key value violates unique constraint "library_items_user_id_book_id_key"',
      }),
    ).toBe("요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.");
    expect(sanitizeDatabaseError(null)).toBe(
      "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  });
});
