import { LogOut, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { RecommendationDiscovery } from "@/components/recommendations/recommendation-discovery";
import { Button, ButtonLink } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/env";
import {
  getAnonymousReadingRankings,
  getReadingRoom,
} from "@/lib/library/queries";
import { buildRecommendationQuery } from "@/lib/recommendation-context";
import { getRecommendations } from "@/lib/recommendations/recommendations";
import { createClient } from "@/lib/supabase/server";

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
  const recommendations = await getRecommendations(query, {
    limit: 9,
    mode: "feed",
  });
  const usingFallback =
    recommendations.length > 0 &&
    recommendations.every((card) => card.source !== "openai");
  const visibleItems = items.filter((item) => item.status !== "abandoned");
  const recommendationContext = {
    activeCount: visibleItems.filter((item) => item.status === "reading").length,
    finishedCount: visibleItems.filter((item) => item.status === "finished")
      .length,
    libraryCount: visibleItems.length,
    rankingCount:
      rankings.popular.length + rankings.rated.length + rankings.active.length,
  };

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
            <ButtonLink href="/search" variant="primary">
              <Plus className="size-4" />
              책 추가
            </ButtonLink>
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

        <RecommendationDiscovery
          context={recommendationContext}
          recommendations={recommendations}
          usingFallback={usingFallback}
        />
      </div>
    </main>
  );
}
