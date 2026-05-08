import {
  BookMarked,
  CalendarDays,
  Library,
  LogOut,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { BookCover } from "@/components/ui/book-cover";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getReadingRoom } from "@/lib/library/queries";
import { calculateProgress } from "@/lib/reading/progress";
import { createClient } from "@/lib/supabase/server";
import { formatAuthors, formatDate } from "@/lib/utils";
import { hasSupabaseEnv } from "@/lib/env";

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

  const { items, summary } = await getReadingRoom(user.id);
  const visibleItems = items.filter((item) => item.status !== "abandoned");

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">
              Reading Room
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              오늘의 독서장
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/search" variant="primary">
              <Plus className="size-4" />
              책 추가
            </ButtonLink>
            <ButtonLink href="/rankings" variant="secondary">
              랭킹
            </ButtonLink>
            <ButtonLink href="/recommendations" variant="secondary">
              추천
            </ButtonLink>
            <ButtonLink href="/archive" variant="ghost">
              보관함
            </ButtonLink>
            <form action={signOut}>
              <Button type="submit" variant="ghost">
                <LogOut className="size-4" />
                로그아웃
              </Button>
            </form>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <StatCard
            icon={<BookMarked className="size-5" />}
            label="읽는 중"
            value={`${summary.activeCount}권`}
          />
          <StatCard
            icon={<Library className="size-5" />}
            label="완독"
            value={`${summary.finishedCount}권`}
          />
          <StatCard
            icon={<CalendarDays className="size-5" />}
            label="최근 7일"
            value={`${summary.weeklyPages}쪽`}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">지금 읽는 책</h2>
              <ButtonLink href="/search" size="sm" variant="secondary">
                검색
              </ButtonLink>
            </div>

            {summary.currentlyReading.length === 0 ? (
              <EmptyState
                title="아직 읽는 중인 책이 없습니다."
                body="책을 하나 추가하면 첫 기록을 바로 남길 수 있어요."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.currentlyReading.map((item) => {
                  const progress =
                    item.currentPercent ??
                    calculateProgress({
                      currentPage: item.currentPage,
                      pageCount: item.book.pageCount,
                    });

                  return (
                    <Link
                      className="rounded-md border border-[var(--color-line)] bg-white/70 p-3 transition hover:border-[var(--color-forest)]"
                      href={`/library/${item.id}`}
                      key={item.id}
                    >
                      <div className="flex gap-3">
                        <BookCover
                          className="w-20 shrink-0"
                          title={item.book.title}
                          authors={item.book.authors}
                          coverUrl={item.book.coverUrl}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-semibold">
                            {item.book.title}
                          </h3>
                          <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                            {formatAuthors(item.book.authors)}
                          </p>
                          <ProgressBar className="mt-4" value={progress} />
                          <p className="mt-2 text-xs text-[var(--color-muted)]">
                            {progress}% 진행
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
            <h2 className="text-xl font-semibold">최근 기록</h2>
            {summary.recentLogs.length === 0 ? (
              <EmptyState
                title="이번 주 기록이 비어 있습니다."
                body="짧은 메모 하나면 충분합니다. 오늘 읽은 흔적을 남겨보세요."
              />
            ) : (
              <ol className="mt-4 space-y-3">
                {summary.recentLogs.map((log) => (
                  <li
                    className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
                    key={log.id}
                  >
                    <p className="text-sm font-medium">
                      {formatDate(log.loggedAt)}
                      {log.pagesRead ? ` · ${log.pagesRead}쪽` : null}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                      {log.note ?? "메모 없이 진행만 기록했습니다."}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <h2 className="text-xl font-semibold">내 서재</h2>
          {visibleItems.length === 0 ? (
            <EmptyState
              title="서재가 아직 비어 있습니다."
              body="읽고 있는 책을 검색해 첫 번째 책장을 만들어보세요."
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visibleItems.map((item) => (
                <Link
                  className="rounded-md border border-[var(--color-line)] bg-white/70 p-3 transition hover:border-[var(--color-forest)]"
                  href={`/library/${item.id}`}
                  key={item.id}
                >
                  <BookCover
                    className="mb-3 w-full"
                    title={item.book.title}
                    authors={item.book.authors}
                    coverUrl={item.book.coverUrl}
                  />
                  <h3 className="line-clamp-2 font-semibold">
                    {item.book.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                    {formatAuthors(item.book.authors)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
        {icon}
      </div>
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-md border border-dashed border-[var(--color-line)] bg-white/50 p-5">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{body}</p>
    </div>
  );
}
