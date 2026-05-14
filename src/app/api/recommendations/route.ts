import { NextResponse } from "next/server";

import {
  getRecommendations,
  recommendationQueryFromIntent,
} from "@/lib/recommendations/recommendations";
import { defaultReaderPreferences } from "@/lib/reader-preferences";
import type {
  RecommendationEventSignal,
  RecommendationIntent,
  RecommendationMode,
} from "@/lib/recommendations/types";
import { createClient } from "@/lib/supabase/server";

type AuthenticatedSupabase = Awaited<ReturnType<typeof createClient>>;

type PreferenceIntentRow = {
  daily_page_goal: number | null;
  default_log_mode: string | null;
  favorite_subjects: string[] | null;
  blocked_subjects: string[] | null;
};

async function getAuthenticatedSupabase() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return { supabase, user };
  } catch {
    return null;
  }
}

function normalizeLimit(limit: unknown) {
  return typeof limit === "number" && Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 12)
    : 6;
}

function parseMode(value: unknown): RecommendationMode {
  return value === "purpose" || value === "conversation" || value === "feed"
    ? value
    : "feed";
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseIntent(value: unknown): RecommendationIntent | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.mood === "string" ? { mood: record.mood } : {}),
    ...(typeof record.length === "string" ? { length: record.length } : {}),
    ...(typeof record.difficulty === "string"
      ? { difficulty: record.difficulty }
      : {}),
    ...(Array.isArray(record.genres)
      ? { genres: parseStringArray(record.genres) }
      : {}),
    ...(Array.isArray(record.blockedSubjects)
      ? { blockedSubjects: parseStringArray(record.blockedSubjects) }
      : {}),
    ...(typeof record.purpose === "string" ? { purpose: record.purpose } : {}),
    ...((typeof record.daily_page_goal === "number" &&
      Number.isFinite(record.daily_page_goal))
      ? { daily_page_goal: record.daily_page_goal }
      : {}),
    ...(typeof record.default_log_mode === "string"
      ? { default_log_mode: record.default_log_mode }
      : {}),
  };
}

function mergeIntent(
  preferenceIntent: RecommendationIntent,
  requestIntent: RecommendationIntent | undefined,
): RecommendationIntent {
  if (!requestIntent) {
    return preferenceIntent;
  }

  const genres = [
    ...(preferenceIntent.genres ?? []),
    ...(requestIntent.genres ?? []),
  ].filter((genre, index, values) => values.indexOf(genre) === index);
  const blockedSubjects = [
    ...(preferenceIntent.blockedSubjects ?? []),
    ...(requestIntent.blockedSubjects ?? []),
  ].filter((subject, index, values) => values.indexOf(subject) === index);
  const purpose = [preferenceIntent.purpose, requestIntent.purpose]
    .filter(Boolean)
    .join(" · ");

  return {
    ...preferenceIntent,
    ...requestIntent,
    ...(genres.length > 0 ? { genres } : {}),
    ...(blockedSubjects.length > 0 ? { blockedSubjects } : {}),
    ...(purpose ? { purpose } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recommendationEventFromRow(row: unknown): RecommendationEventSignal | null {
  if (!isRecord(row) || typeof row.event_type !== "string") {
    return null;
  }

  return {
    eventType: row.event_type,
    provider: typeof row.provider === "string" ? row.provider : null,
    providerId: typeof row.provider_id === "string" ? row.provider_id : null,
    recommendation: isRecord(row.recommendation) ? row.recommendation : null,
  };
}

async function getRecommendationEventSignals(
  supabase: AuthenticatedSupabase,
  userId: string,
): Promise<RecommendationEventSignal[]> {
  try {
    const { data, error } = await supabase
      .from("recommendation_events")
      .select("event_type, provider, provider_id, recommendation")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data
      .map(recommendationEventFromRow)
      .filter((event): event is RecommendationEventSignal => event !== null);
  } catch {
    return [];
  }
}

async function getRecommendationPreferenceIntent(
  supabase: AuthenticatedSupabase,
  userId: string,
): Promise<RecommendationIntent> {
  try {
    const { data, error } = await supabase
      .from("reader_preferences")
      .select(
        "daily_page_goal,default_log_mode,favorite_subjects,blocked_subjects",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return {
        daily_page_goal: defaultReaderPreferences.dailyPageGoal,
        default_log_mode: defaultReaderPreferences.defaultLogMode,
      };
    }

    const row = data as PreferenceIntentRow;
    return {
      daily_page_goal:
        typeof row.daily_page_goal === "number"
          ? row.daily_page_goal
          : defaultReaderPreferences.dailyPageGoal,
      default_log_mode:
        row.default_log_mode === "percent" ? "percent" : "page",
      genres: row.favorite_subjects ?? [],
      blockedSubjects: row.blocked_subjects ?? [],
    };
  } catch {
    return {
      daily_page_goal: defaultReaderPreferences.dailyPageGoal,
      default_log_mode: defaultReaderPreferences.defaultLogMode,
    };
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    query?: unknown;
    mode?: unknown;
    intent?: unknown;
    prompt?: unknown;
    previousProviderIds?: unknown;
    hiddenProviderIds?: unknown;
    excludedProviderIds?: unknown;
    limit?: unknown;
  };

  const mode = parseMode(body.mode);
  const requestIntent = parseIntent(body.intent);
  const legacyQuery = typeof body.query === "string" ? body.query.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const hasStructuredMode =
    body.mode === "feed" || body.mode === "purpose" || body.mode === "conversation";
  const limit = normalizeLimit(body.limit);

  if (!legacyQuery && !prompt && !hasStructuredMode) {
    return NextResponse.json(
      { error: "Missing recommendation query." },
      { status: 400 },
    );
  }

  const auth = await getAuthenticatedSupabase();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const preferenceIntent = await getRecommendationPreferenceIntent(
    auth.supabase,
    auth.user.id,
  );
  const intent = mergeIntent(preferenceIntent, requestIntent);
  const query =
    legacyQuery ||
    prompt ||
    (body.mode === "purpose"
      ? recommendationQueryFromIntent(intent)
      : hasStructuredMode && mode === "feed"
        ? "국내 독서 추천"
        : "");

  if (!query) {
    return NextResponse.json(
      { error: "Missing recommendation query." },
      { status: 400 },
    );
  }

  const recommendationEvents = await getRecommendationEventSignals(
    auth.supabase,
    auth.user.id,
  );

  const results = await getRecommendations(query, {
    limit,
    mode,
    intent,
    previousProviderIds: parseStringArray(body.previousProviderIds),
    hiddenProviderIds: parseStringArray(body.hiddenProviderIds),
    excludedProviderIds: parseStringArray(body.excludedProviderIds),
    recommendationEvents,
  });

  return NextResponse.json({ results });
}
