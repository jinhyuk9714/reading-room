import { describe, expect, it } from "vitest";
import {
  defaultReaderPreferences,
  parsePreferenceText,
  validateReaderPreferenceDraft,
} from "@/lib/reader-preferences";

describe("reader preferences", () => {
  it("validates goal ranges and default log mode", () => {
    expect(
      validateReaderPreferenceDraft({
        dailyPageGoal: 30,
        weeklySessionGoal: 5,
        defaultLogMode: "page",
        favoriteSubjects: ["소설"],
        blockedSubjects: ["원서"],
      }),
    ).toEqual([]);

    expect(
      validateReaderPreferenceDraft({
        dailyPageGoal: 0,
        weeklySessionGoal: 99,
        defaultLogMode: "chapter" as never,
        favoriteSubjects: [],
        blockedSubjects: [],
      }),
    ).toEqual([
      "하루 목표는 1쪽에서 500쪽 사이로 설정해주세요.",
      "주간 기록 목표는 1회에서 21회 사이로 설정해주세요.",
      "기본 기록 방식이 올바르지 않습니다.",
    ]);
  });

  it("parses compact Korean keyword text into a bounded unique list", () => {
    expect(parsePreferenceText("소설, 에세이\\n소설 / 철학")).toEqual([
      "소설",
      "에세이",
      "철학",
    ]);
  });

  it("provides stable defaults for users without a preference row", () => {
    expect(defaultReaderPreferences).toMatchObject({
      dailyPageGoal: 20,
      weeklySessionGoal: 4,
      defaultLogMode: "page",
    });
  });
});
