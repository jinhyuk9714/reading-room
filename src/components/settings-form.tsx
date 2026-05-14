"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { updateReaderPreferencesAction } from "@/app/actions/preferences";
import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/inline-notice";
import { idleActionState } from "@/lib/library/validation";
import type { ReaderPreferences } from "@/lib/reading/types";

type SettingsFormProps = {
  preferences: ReaderPreferences;
  readOnly?: boolean;
};

export function SettingsForm({
  preferences,
  readOnly = false,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateReaderPreferencesAction,
    idleActionState,
  );

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
        <h2 className="text-base font-semibold">목표</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            하루 페이지 목표
            <input
              className="mt-1 h-10 w-full rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-forest)] disabled:opacity-60"
              defaultValue={preferences.dailyPageGoal}
              disabled={readOnly}
              max={500}
              min={1}
              name="dailyPageGoal"
              type="number"
            />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            주간 기록 목표
            <input
              className="mt-1 h-10 w-full rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-forest)] disabled:opacity-60"
              defaultValue={preferences.weeklySessionGoal}
              disabled={readOnly}
              max={21}
              min={1}
              name="weeklySessionGoal"
              type="number"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-[var(--color-muted)]">
          기본 기록 방식
          <select
            className="mt-1 h-10 w-full rounded-md border border-[var(--color-line)] bg-white px-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-forest)] disabled:opacity-60"
            defaultValue={preferences.defaultLogMode}
            disabled={readOnly}
            name="defaultLogMode"
          >
            <option value="page">현재 페이지</option>
            <option value="percent">진행률</option>
          </select>
        </label>
      </section>

      <section className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
        <h2 className="text-base font-semibold">선호</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            선호 키워드
            <textarea
              className="mt-1 min-h-36 w-full resize-none rounded-md border border-[var(--color-line)] bg-white p-3 text-sm leading-6 text-[var(--color-ink)] outline-none focus:border-[var(--color-forest)] disabled:opacity-60"
              defaultValue={preferences.favoriteSubjects.join(", ")}
              disabled={readOnly}
              name="favoriteSubjects"
              placeholder="문학, 에세이, 여성 서사"
            />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            차단 키워드
            <textarea
              className="mt-1 min-h-36 w-full resize-none rounded-md border border-[var(--color-line)] bg-white p-3 text-sm leading-6 text-[var(--color-ink)] outline-none focus:border-[var(--color-forest)] disabled:opacity-60"
              defaultValue={preferences.blockedSubjects.join(", ")}
              disabled={readOnly}
              name="blockedSubjects"
              placeholder="제외하고 싶은 주제"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={pending || readOnly} type="submit">
            <Save className="size-4" />
            {pending ? "저장 중" : "설정 저장"}
          </Button>
          {readOnly ? (
            <span className="text-sm text-[var(--color-muted)]">
              로그인 후 개인 설정으로 저장할 수 있습니다.
            </span>
          ) : null}
        </div>
        {state.status === "success" ? (
          <InlineNotice tone="success">{state.message}</InlineNotice>
        ) : null}
        {state.status === "error" ? (
          <InlineNotice tone="error">{state.message}</InlineNotice>
        ) : null}
      </section>
    </form>
  );
}
