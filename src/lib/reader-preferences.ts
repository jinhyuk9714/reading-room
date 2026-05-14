import type { ReaderPreferenceDraft, ReaderPreferences } from "@/lib/reading/types";

export const defaultReaderPreferences: ReaderPreferences = {
  dailyPageGoal: 20,
  weeklySessionGoal: 4,
  defaultLogMode: "page",
  favoriteSubjects: [],
  blockedSubjects: [],
};

export function parsePreferenceText(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .replaceAll("\\n", "\n")
    .split(/[,\n/]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    })
    .slice(0, 20);
}

export function validateReaderPreferenceDraft(
  draft: ReaderPreferenceDraft,
): string[] {
  const errors: string[] = [];

  if (
    !Number.isInteger(draft.dailyPageGoal) ||
    draft.dailyPageGoal < 1 ||
    draft.dailyPageGoal > 500
  ) {
    errors.push("하루 목표는 1쪽에서 500쪽 사이로 설정해주세요.");
  }

  if (
    !Number.isInteger(draft.weeklySessionGoal) ||
    draft.weeklySessionGoal < 1 ||
    draft.weeklySessionGoal > 21
  ) {
    errors.push("주간 기록 목표는 1회에서 21회 사이로 설정해주세요.");
  }

  if (draft.defaultLogMode !== "page" && draft.defaultLogMode !== "percent") {
    errors.push("기본 기록 방식이 올바르지 않습니다.");
  }

  if (
    [...draft.favoriteSubjects, ...draft.blockedSubjects].some(
      (subject) => subject.length > 60,
    )
  ) {
    errors.push("선호 키워드는 각각 60자 이내로 입력해주세요.");
  }

  return errors;
}
