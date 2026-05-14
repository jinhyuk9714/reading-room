import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { DemoReadingRoom } from "@/components/demo-reading-room";
import { RecommendationDiscovery } from "@/components/recommendations/recommendation-discovery";
import { AppShell } from "@/components/ui/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { hasSupabaseEnv } from "@/lib/env";
import {
  getAnonymousReadingRankings,
  getReaderPreferences,
  getReadingRoom,
} from "@/lib/library/queries";
import { buildRecommendationQuery } from "@/lib/recommendation-context";
import { getRecommendations } from "@/lib/recommendations/recommendations";
import type {
  RecommendationEventSignal,
  RecommendationIntent,
} from "@/lib/recommendations/types";
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

  const [{ items }, { rankings }, preferences, recommendationEvents] =
    await Promise.all([
    getReadingRoom(user.id),
    getAnonymousReadingRankings(user.id),
    getReaderPreferences(user.id),
    getRecommendationEvents(user.id),
  ]);
  const query = buildRecommendationQuery(items, rankings);
  const preferenceIntent: RecommendationIntent = {
    daily_page_goal: preferences.dailyPageGoal,
    default_log_mode: preferences.defaultLogMode,
    genres: preferences.favoriteSubjects,
    blockedSubjects: preferences.blockedSubjects,
  };
  const recommendations = await getRecommendations(query, {
    limit: 9,
    mode: "feed",
    intent: preferenceIntent,
    recommendationEvents,
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
    <AppShell activeHref="/recommendations">
      <div className="flex flex-col gap-4">
        <PageHeader
          actions={
            <>
            <ButtonLink href="/search" variant="primary">
              <Plus className="size-4" />
              책 추가
            </ButtonLink>
            <ButtonLink href="/rankings" variant="secondary">
              랭킹
            </ButtonLink>
            </>
          }
          meta={`${recommendationContext.libraryCount}권 서재 · 후보 ${recommendations.length}권`}
          title="발견"
        />

        <RecommendationDiscovery
          context={recommendationContext}
          recommendations={recommendations}
          usingFallback={usingFallback}
        />
      </div>
    </AppShell>
  );
}

async function getRecommendationEvents(
  userId: string,
): Promise<RecommendationEventSignal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recommendation_events")
    .select("event_type,provider,provider_id,recommendation")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => ({
      eventType: typeof row.event_type === "string" ? row.event_type : "",
      provider: typeof row.provider === "string" ? row.provider : null,
      providerId: typeof row.provider_id === "string" ? row.provider_id : null,
      recommendation:
        row.recommendation &&
        typeof row.recommendation === "object" &&
        !Array.isArray(row.recommendation)
          ? (row.recommendation as RecommendationEventSignal["recommendation"])
          : null,
    }))
    .filter((event) => event.eventType);
}
