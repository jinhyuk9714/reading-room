import { BarChart3, BookCheck, Flame, LogOut, Trophy } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { BookCover } from "@/components/ui/book-cover";
import { Button, ButtonLink } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/env";
import { getAnonymousReadingRankings } from "@/lib/library/queries";
import type { RankingBook } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";
import { formatAuthors } from "@/lib/utils";

export default async function RankingsPage() {
  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom initialView="rankings" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { rankings, source } = await getAnonymousReadingRankings(user.id);

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Reading Room</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              익명 독서 랭킹
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/" variant="secondary">
              독서장
            </ButtonLink>
            <ButtonLink href="/recommendations" variant="primary">
              추천
            </ButtonLink>
            <form action={signOut}>
              <Button type="submit" variant="ghost">
                <LogOut className="size-4" />
                로그아웃
              </Button>
            </form>
          </div>
        </header>

        {source === "personal" ? (
          <p className="rounded-md border border-[var(--color-line)] bg-white/70 p-3 text-sm leading-6 text-[var(--color-muted)]">
            서버 전용 Supabase service role 키가 없어서 현재 로그인한 사용자의
            기록으로만 랭킹을 계산했습니다. 배포 환경에 키를 넣으면 전체
            익명 집계로 전환됩니다.
          </p>
        ) : null}

        <RankingSection
          books={rankings.popular}
          icon={<Trophy className="size-5" />}
          metric="libraryCount"
          title="인기 도서"
        />
        <RankingSection
          books={rankings.rated}
          icon={<BookCheck className="size-5" />}
          metric="averageRating"
          title="높은 별점 책"
        />
        <RankingSection
          books={rankings.active}
          icon={<Flame className="size-5" />}
          metric="recentLogCount"
          title="최근 많이 읽은 책"
        />
      </div>
    </main>
  );
}

function RankingSection({
  books,
  icon,
  metric,
  title,
}: {
  books: RankingBook[];
  icon: React.ReactNode;
  metric: "libraryCount" | "averageRating" | "recentLogCount";
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
          {icon}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {books.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--color-line)] bg-white/50 p-5 text-sm leading-6 text-[var(--color-muted)]">
          아직 집계할 기록이 없습니다.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {books.map((book, index) => (
            <article
              className="rounded-md border border-[var(--color-line)] bg-white/70 p-3"
              key={`${title}-${book.bookId}`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-forest)]">
                <BarChart3 className="size-4" />
                {index + 1}위 · {rankingMetricLabel(book, metric)}
              </div>
              <BookCover
                authors={book.authors}
                className="mt-3 w-full"
                coverUrl={book.coverUrl}
                title={book.title}
              />
              <h3 className="mt-3 line-clamp-2 font-semibold">{book.title}</h3>
              <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                {formatAuthors(book.authors)}
              </p>
              {book.pageCount ? (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {book.pageCount}쪽
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function rankingMetricLabel(
  book: RankingBook,
  metric: "libraryCount" | "averageRating" | "recentLogCount",
) {
  if (metric === "averageRating") {
    return `평균 ${(book.averageRating ?? 0).toFixed(1)}점 · ${book.ratingCount}명`;
  }

  return `${book[metric]}회`;
}
