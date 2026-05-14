import { BarChart3, CalendarDays, CheckCircle2, Plus, Target } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { AppShell } from "@/components/ui/app-shell";
import { BookCard } from "@/components/ui/book-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricStrip } from "@/components/ui/metric-strip";
import { PageHeader } from "@/components/ui/page-header";
import { hasSupabaseEnv } from "@/lib/env";
import { getReaderPreferences, getReadingRoom } from "@/lib/library/queries";
import { buildReadingGoalProgress } from "@/lib/reading/goals";
import type { ReadingLog } from "@/lib/reading/types";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function Home() {
  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom initialView="home" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ items, logs, summary }, preferences] = await Promise.all([
    getReadingRoom(user.id),
    getReaderPreferences(user.id),
  ]);
  const goalProgress = buildReadingGoalProgress({ items, logs, preferences });
  const currentlyReading = summary.currentlyReading.slice(0, 4);
  const primaryBook = currentlyReading[0];
  const wantToRead = items
    .filter((item) => item.status === "want_to_read")
    .slice(0, 5);
  const recentNotes = logs.filter((log) => log.note?.trim()).slice(0, 4);
  const visibleCount = items.filter((item) => item.status !== "abandoned").length;
  const streakDays = calculateReadingStreak(logs);

  return (
    <AppShell activeHref="/">
      <div className="flex flex-col gap-4">
        <PageHeader
          actions={
            <>
              <ButtonLink href="/search" size="sm" variant="primary">
                <Plus className="size-4" />
                책 추가
              </ButtonLink>
              <ButtonLink href="/recommendations" size="sm" variant="secondary">
                추천 보기
              </ButtonLink>
            </>
          }
          meta={`${visibleCount}권 · 최근 기록 ${summary.recentLogs.length}개`}
          title="오늘의 독서장"
        />

        <MetricStrip
          items={[
            {
              label: "오늘 목표",
              value: `${goalProgress.dailyPages}/${goalProgress.dailyPageGoal}쪽`,
              detail: `${goalProgress.dailyPercent}% 진행`,
              icon: <Target className="size-4" />,
            },
            {
              label: "주간 목표",
              value: `${goalProgress.weeklySessions}/${goalProgress.weeklySessionGoal}회`,
              detail: `${goalProgress.weeklyPages}쪽 · ${goalProgress.weeklySessionPercent}%`,
              icon: <CalendarDays className="size-4" />,
            },
            {
              label: "연속 기록",
              value: `${streakDays}일`,
              detail: streakDays > 0 ? "오늘 기준" : "이번 주 기록 없음",
              icon: <BarChart3 className="size-4" />,
            },
            {
              label: "완독",
              value: `${summary.finishedCount}권`,
              detail: "전체 누적",
              icon: <CheckCircle2 className="size-4" />,
            },
            {
              label: "읽는 중",
              value: `${summary.activeCount}권`,
              detail:
                summary.pausedCount > 0 ? `멈춘 책 ${summary.pausedCount}권` : "진행 중",
              icon: <CheckCircle2 className="size-4" />,
            },
          ]}
        />

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">이어 읽기</h2>
              {primaryBook ? (
                <ButtonLink
                  href={`/library/${primaryBook.id}`}
                  size="sm"
                  variant="secondary"
                >
                  1분 기록
                </ButtonLink>
              ) : null}
            </div>
            {currentlyReading.length === 0 ? (
              <EmptyState
                action={
                  <ButtonLink href="/search" size="sm" variant="secondary">
                    책 찾기
                  </ButtonLink>
                }
                body="읽는 중 상태로 책을 추가하면 이곳에서 바로 기록할 수 있습니다."
                title="오늘 이어 읽을 책이 없습니다."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {currentlyReading.map((item) => (
                  <BookCard item={item} key={item.id} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">읽고 싶은 책</h2>
              <Link
                className="text-sm font-medium text-[var(--color-forest)] hover:underline"
                href="/library#want_to_read"
              >
                전체
              </Link>
            </div>
            {wantToRead.length === 0 ? (
              <EmptyState title="대기열이 비어 있습니다." />
            ) : (
              <div className="space-y-2">
                {wantToRead.map((item) => (
                  <BookCard compact item={item} key={item.id} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">오늘 기록 안 한 책</h2>
              <Link
                className="text-sm font-medium text-[var(--color-forest)] hover:underline"
                href="/settings"
              >
                목표 설정
              </Link>
            </div>
            {goalProgress.unloggedToday.length === 0 ? (
              <EmptyState title="오늘의 진행 기록이 채워졌습니다." />
            ) : (
              <div className="space-y-2">
                {goalProgress.unloggedToday.slice(0, 4).map((item) => (
                  <BookCard compact item={item} key={item.id} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">추천</h2>
              <Link
                className="text-sm font-medium text-[var(--color-forest)] hover:underline"
                href="/recommendations"
              >
                발견으로 이동
              </Link>
            </div>
            <p className="text-sm leading-6 text-[var(--color-muted)]">
              지금 서재의 진행 상태와 완독 기록을 기준으로 다음 책을 고릅니다.
            </p>
          </div>

          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">최근 메모</h2>
              <Link
                className="text-sm font-medium text-[var(--color-forest)] hover:underline"
                href="/insights"
              >
                흐름 보기
              </Link>
            </div>
            {recentNotes.length === 0 ? (
              <EmptyState title="최근 메모가 없습니다." />
            ) : (
              <ol className="divide-y divide-[var(--color-line)]">
                {recentNotes.map((log) => (
                  <li className="py-2 first:pt-0 last:pb-0" key={log.id}>
                    <p className="text-xs font-medium text-[var(--color-muted)]">
                      {formatDate(log.loggedAt)}
                      {log.pagesRead ? ` · ${log.pagesRead}쪽` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6">
                      {log.note}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function calculateReadingStreak(logs: ReadingLog[]) {
  const loggedDays = new Set(
    logs.map((log) => new Date(log.loggedAt).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();

  while (loggedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
