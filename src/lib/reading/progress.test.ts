import { describe, expect, it } from "vitest";
import { calculateProgress, validateReadingLog } from "@/lib/reading/progress";

describe("reading progress", () => {
  it("calculates bounded percent progress from current page and total pages", () => {
    expect(calculateProgress({ currentPage: 40, pageCount: 200 })).toBe(20);
    expect(calculateProgress({ currentPage: 240, pageCount: 200 })).toBe(100);
    expect(calculateProgress({ currentPage: -10, pageCount: 200 })).toBe(0);
  });

  it("allows percent-only logs when a book has no page count", () => {
    const result = validateReadingLog({
      pageCount: null,
      currentPage: null,
      currentPercent: 33,
      pagesRead: null,
      note: "오늘은 조금 천천히 읽었다.",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects invalid page and note values", () => {
    expect(
      validateReadingLog({
        pageCount: 120,
        currentPage: 121,
        currentPercent: null,
        pagesRead: 8,
        note: "x".repeat(501),
      }),
    ).toEqual({
      ok: false,
      errors: [
        "현재 페이지는 전체 페이지를 넘을 수 없습니다.",
        "메모는 500자 이내로 남겨주세요.",
      ],
    });
  });

  it("rejects invalid quick log quote, mood, and tags", () => {
    expect(
      validateReadingLog({
        pageCount: 120,
        currentPage: 40,
        currentPercent: null,
        pagesRead: 8,
        note: null,
        quote: "x".repeat(1001),
        mood: " ",
        tags: ["insight", ""],
      }),
    ).toEqual({
      ok: false,
      errors: [
        "인용문은 1000자 이내로 남겨주세요.",
        "기분은 비워둘 수 없습니다.",
        "태그는 빈 값 없이 입력해주세요.",
      ],
    });
  });
});
