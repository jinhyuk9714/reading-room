import { Lightbulb, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { RecommendationAddForm } from "@/components/add-book-forms";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { BookCover } from "@/components/ui/book-cover";
import { Button, ButtonLink } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/env";
import {
  getAnonymousReadingRankings,
  getReadingRoom,
} from "@/lib/library/queries";
import { buildRecommendationQuery } from "@/lib/recommendation-context";
import { getRecommendations } from "@/lib/recommendations/recommendations";
import type { RecommendationCard } from "@/lib/recommendations/types";
import { createClient } from "@/lib/supabase/server";
import { formatAuthors } from "@/lib/utils";

export default async function RecommendationsPage() {
  if (!hasSupabaseEnv()) {
    return <DemoReadingRoom initialView="recommendations" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ items }, { rankings }] = await Promise.all([
    getReadingRoom(user.id),
    getAnonymousReadingRankings(user.id),
  ]);
  const query = buildRecommendationQuery(items, rankings);
  const recommendations = await getRecommendations(query, { limit: 6 });
  const usingFallback =
    recommendations.length > 0 &&
    recommendations.every((card) => card.source !== "openai");

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--color-ink)] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Reading Room</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              내 서재 기반 추천
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/" variant="secondary">
              독서장
            </ButtonLink>
            <ButtonLink href="/rankings" variant="secondary">
              랭킹
            </ButtonLink>
            <form action={signOut}>
              <Button type="submit" variant="ghost">
                <LogOut className="size-4" />
                로그아웃
              </Button>
            </form>
          </div>
        </header>

        {usingFallback ? (
          <p className="rounded-md border border-[var(--color-line)] bg-white/70 p-3 text-sm leading-6 text-[var(--color-muted)]">
            검색 기반 추천으로 표시했습니다. `OPENAI_API_KEY`와
            `OPENAI_RECOMMENDATIONS_MODEL`을 서버 환경 변수로 설정하면 AI가
            추천 이유를 더 세밀하게 다듬습니다.
          </p>
        ) : null}

        <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-md bg-[var(--color-soft)] text-[var(--color-forest)]">
              <Lightbulb className="size-5" />
            </span>
            <h2 className="text-xl font-semibold">추천 도서</h2>
          </div>
          {recommendations.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--color-line)] bg-white/50 p-5 text-sm leading-6 text-[var(--color-muted)]">
              추천을 만들 기록이 아직 없습니다. 책을 한 권 추가하면 여기에서
              다음 책을 제안합니다.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((card) => (
                <RecommendationArticle
                  card={card}
                  key={`${card.provider}:${card.providerId}`}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function RecommendationArticle({ card }: { card: RecommendationCard }) {
  return (
    <article className="rounded-md border border-[var(--color-line)] bg-white/70 p-3">
      <div className="flex gap-3">
        <BookCover
          authors={card.authors}
          className="w-24 shrink-0"
          coverUrl={card.coverUrl}
          title={card.title}
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold">{card.title}</h3>
          <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
            {formatAuthors(card.authors)}
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            {card.pageCount ? `${card.pageCount}쪽 · ` : ""}
            {card.source === "openai" ? "AI 추천" : "검색 기반"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {card.reason}
      </p>
      <RecommendationAddForm card={card} />
    </article>
  );
}
