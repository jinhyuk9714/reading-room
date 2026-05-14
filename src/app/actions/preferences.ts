"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  actionError,
  actionSuccess,
  type ActionState,
  sanitizeDatabaseError,
} from "@/lib/library/validation";
import {
  parsePreferenceText,
  validateReaderPreferenceDraft,
} from "@/lib/reader-preferences";
import type { ReaderLogMode, ReaderPreferenceDraft } from "@/lib/reading/types";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

function numberOrFallback(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parseLogMode(value: FormDataEntryValue | null): ReaderLogMode {
  return value === "percent" ? "percent" : value === "page" ? "page" : "page";
}

function draftFromFormData(formData: FormData): ReaderPreferenceDraft {
  return {
    dailyPageGoal: numberOrFallback(formData.get("dailyPageGoal"), 20),
    weeklySessionGoal: numberOrFallback(formData.get("weeklySessionGoal"), 4),
    defaultLogMode: parseLogMode(formData.get("defaultLogMode")),
    favoriteSubjects: parsePreferenceText(
      typeof formData.get("favoriteSubjects") === "string"
        ? (formData.get("favoriteSubjects") as string)
        : "",
    ),
    blockedSubjects: parsePreferenceText(
      typeof formData.get("blockedSubjects") === "string"
        ? (formData.get("blockedSubjects") as string)
        : "",
    ),
  };
}

export async function updateReaderPreferencesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const draft = draftFromFormData(formData);
  const errors = validateReaderPreferenceDraft(draft);

  if (errors.length > 0) {
    return actionError(errors.join(" "));
  }

  const { error } = await supabase.from("reader_preferences").upsert(
    {
      user_id: user.id,
      daily_page_goal: draft.dailyPageGoal,
      weekly_session_goal: draft.weeklySessionGoal,
      default_log_mode: draft.defaultLogMode,
      favorite_subjects: draft.favoriteSubjects,
      blocked_subjects: draft.blockedSubjects,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return actionError(sanitizeDatabaseError(error));
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/recommendations");
  revalidatePath("/insights");

  return actionSuccess("독서 설정을 저장했습니다.");
}
