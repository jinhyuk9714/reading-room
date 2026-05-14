import {
  BarChart3,
  BookCheck,
  CalendarDays,
  NotebookText,
  Target,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { AppShell } from "@/components/ui/app-shell";
import { BookCard } from "@/components/ui/book-card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricStrip } from "@/components/ui/metric-strip";
import { PageHeader } from "@/components/ui/page-header";
import { hasSupabaseEnv } from "@/lib/env";
import { getReaderPreferences, getReadingRoom } from "@/lib/library/queries";
import { buildReadingGoalProgress } from "@/lib/reading/goals";
import { buildReadingInsightSummary } from "@/lib/reading/insights";
import type {
  CountSummary,
  LibraryItemWithBook,
  ReadingLog,
} from "@/lib/reading/types";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function InsightsPage() {
  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom initialView="insights" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ items, logs }, preferences] = await Promise.all([
    getReadingRoom(user.id),
    getReaderPreferences(user.id),
  ]);
  const insightSummary = buildReadingInsightSummary({ items, logs });
  const goalProgress = buildReadingGoalProgress({ items, logs, preferences });
  const insights = shapeInsights({ items, logs, insightSummary });

  return (
    <AppShell activeHref="/insights">
      <div className="flex flex-col gap-4">
        <PageHeader
          meta={`${insights.libraryCount}권 · 기록 ${logs.length}개`}
          title="인사이트"
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
              detail: `${insights.weeklyPages}쪽 · ${goalProgress.weeklySessionPercent}%`,
              icon: <CalendarDays className="size-4" />,
            },
            {
              label: "연속 기록",
              value: `${insights.streakDays}일`,
              detail: insights.lastLoggedAt
                ? `마지막 ${formatDate(insights.lastLoggedAt)}`
                : "기록 없음",
              icon: <BarChart3 className="size-4" />,
            },
            {
              label: "완독률",
              value: `${insights.finishRate}%`,
              detail: `${insights.finishedCount}/${insights.libraryCount || 0}권`,
              icon: <BookCheck className="size-4" />,
            },
            {
              label: "메모",
              value: `${insights.noteCount}개`,
              detail: "전체 기록",
              icon: <NotebookText className="size-4" />,
            },
          ]}
        />

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <h2 className="mb-3 text-base font-semibold">상태 분포</h2>
            <div className="space-y-3">
              {insights.statusRows.map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span>{row.label}</span>
                    <span className="text-[var(--color-muted)]">{row.count}권</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-soft)]">
                    <div
                      className="h-2 rounded-full bg-[var(--color-forest)]"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">최근 메모 흐름</h2>
              <Link
                className="text-sm font-medium text-[var(--color-forest)] hover:underline"
                href="/"
                prefetch={false}
              >
                독서장
              </Link>
            </div>
            {insights.recentNotes.length === 0 ? (
              <EmptyState title="아직 메모가 없습니다." />
            ) : (
              <ol className="divide-y divide-[var(--color-line)]">
                {insights.recentNotes.map((log) => (
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

        <section className="grid gap-4 lg:grid-cols-3">
          <SummaryPanel title="독서 페이스">
            {insights.paceRows.length === 0 ? (
              <EmptyState title="페이스를 계산할 읽는 중 책이 없습니다." />
            ) : (
              <div className="space-y-2">
                {insights.paceRows.map((row) => (
                  <div
                    className="rounded-md border border-[var(--color-line)] bg-white/60 p-3 text-sm"
                    key={row.libraryItemId}
                  >
                    <p className="font-medium">{row.title}</p>
                    <p className="mt-1 text-[var(--color-muted)]">
                      {row.remainingPages}쪽 남음 ·{" "}
                      {row.estimatedDaysToFinish
                        ? `${row.estimatedDaysToFinish}일 예상`
                        : "기록을 더 남기면 예상일을 계산합니다"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SummaryPanel>
          <SummaryPanel title="태그와 기분">
            <CountList emptyTitle="아직 태그가 없습니다." rows={insights.topTags} />
            <div className="mt-3">
              <CountList emptyTitle="아직 기분 기록이 없습니다." rows={insights.moodCounts} />
            </div>
          </SummaryPanel>
          <SummaryPanel title="최근 인용문">
            {insights.recentQuotes.length === 0 ? (
              <EmptyState title="아직 인용문이 없습니다." />
            ) : (
              <ol className="space-y-2">
                {insights.recentQuotes.map((log) => (
                  <li
                    className="rounded-md border border-[var(--color-line)] bg-white/60 p-3 text-sm leading-6"
                    key={log.id}
                  >
                    “{log.quote}”
                  </li>
                ))}
              </ol>
            )}
          </SummaryPanel>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <h2 className="mb-3 text-base font-semibold">다시 잡을 책</h2>
            {insights.pausedItems.length === 0 ? (
              <EmptyState title="멈춘 책이 없습니다." />
            ) : (
              <div className="space-y-2">
                {insights.pausedItems.map((item) => (
                  <BookCard compact item={item} key={item.id} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
            <h2 className="mb-3 text-base font-semibold">최근 완독</h2>
            {insights.recentFinished.length === 0 ? (
              <EmptyState title="최근 완독한 책이 없습니다." />
            ) : (
              <div className="space-y-2">
                {insights.recentFinished.map((item) => (
                  <BookCard compact item={item} key={item.id} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function shapeInsights({
  items,
  logs,
  insightSummary,
}: {
  items: LibraryItemWithBook[];
  logs: ReadingLog[];
  insightSummary: ReturnType<typeof buildReadingInsightSummary>;
}) {
  const visibleItems = items.filter((item) => item.status !== "abandoned");
  const finishedItems = visibleItems.filter((item) => item.status === "finished");
  const libraryCount = visibleItems.length;
  const statusRows = [
    statusRow("읽는 중", libraryCount, insightSummary.statusCounts.reading),
    statusRow("읽고 싶음", libraryCount, insightSummary.statusCounts.want_to_read),
    statusRow("멈춤", libraryCount, insightSummary.statusCounts.paused),
    statusRow("완독", libraryCount, insightSummary.statusCounts.finished),
  ];

  return {
    libraryCount,
    weeklyPages: insightSummary.weeklyPages,
    finishedCount: finishedItems.length,
    finishRate:
      libraryCount === 0 ? 0 : Math.round((finishedItems.length / libraryCount) * 100),
    noteCount: logs.filter((log) => log.note?.trim()).length,
    streakDays: insightSummary.recentStreakDays,
    lastLoggedAt: logs[0]?.loggedAt ?? null,
    statusRows,
    recentNotes: logs.filter((log) => log.note?.trim()).slice(0, 5),
    recentQuotes: logs.filter((log) => log.quote?.trim()).slice(0, 5),
    paceRows: insightSummary.pace.slice(0, 5),
    topTags: insightSummary.topTags.slice(0, 5),
    moodCounts: insightSummary.moodCounts.slice(0, 5),
    pausedItems: visibleItems.filter((item) => item.status === "paused").slice(0, 4),
    recentFinished: finishedItems
      .sort(
        (a, b) =>
          new Date(b.finishedOn ?? 0).getTime() -
          new Date(a.finishedOn ?? 0).getTime(),
      )
      .slice(0, 4),
  };
}

function SummaryPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white/35 p-3">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function CountList({
  emptyTitle,
  rows,
}: {
  emptyTitle: string;
  rows: CountSummary[];
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} />;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-line)] bg-white/60 px-3 py-2 text-sm"
          key={row.label}
        >
          <span>{row.label}</span>
          <span className="font-medium text-[var(--color-forest)]">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function statusRow(
  label: string,
  total: number,
  count: number,
) {
  return {
    label,
    count,
    percent: total === 0 ? 0 : Math.round((count / total) * 100),
  };
}
