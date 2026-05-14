import { NextResponse } from "next/server";

import type {
  RecommendationCard,
  RecommendationSection,
} from "@/lib/recommendations/types";
import { createClient } from "@/lib/supabase/server";

const EVENT_TYPES = new Set([
  "shown",
  "opened",
  "hidden",
  "dismissed",
  "excluded",
  "saved",
  "added_to_library",
  "feedback",
]);

const SECTION_TYPES = new Set<RecommendationSection>([
  "now",
  "similar",
  "short",
  "expand",
  "purpose",
  "conversation",
]);

type RecommendationEventBody = {
  eventType?: unknown;
  card?: unknown;
  query?: unknown;
  metadata?: unknown;
};

function parseEventType(value: unknown) {
  return typeof value === "string" && EVENT_TYPES.has(value) ? value : null;
}

function parseSection(value: unknown): RecommendationSection | undefined {
  return typeof value === "string" && SECTION_TYPES.has(value as RecommendationSection)
    ? (value as RecommendationSection)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCard(value: unknown): RecommendationCard | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.title !== "string" ||
    !Array.isArray(value.authors) ||
    typeof value.reason !== "string" ||
    typeof value.source !== "string" ||
    typeof value.provider !== "string" ||
    typeof value.providerId !== "string"
  ) {
    return null;
  }

  return {
    title: value.title.slice(0, 300),
    authors: value.authors
      .filter((author): author is string => typeof author === "string")
      .slice(0, 8),
    reason: value.reason.slice(0, 1200),
    reasonTags: Array.isArray(value.reasonTags)
      ? value.reasonTags
          .filter((tag): tag is string => typeof tag === "string")
          .slice(0, 12)
      : undefined,
    matchScore:
      typeof value.matchScore === "number" && Number.isFinite(value.matchScore)
        ? value.matchScore
        : undefined,
    section: parseSection(value.section),
    isFallback: typeof value.isFallback === "boolean" ? value.isFallback : undefined,
    domesticVerified:
      typeof value.domesticVerified === "boolean"
        ? value.domesticVerified
        : undefined,
    source: value.source.slice(0, 80),
    provider: value.provider.slice(0, 40),
    providerId: value.providerId.slice(0, 200),
    coverUrl: typeof value.coverUrl === "string" ? value.coverUrl : null,
    pageCount:
      typeof value.pageCount === "number" && Number.isFinite(value.pageCount)
        ? value.pageCount
        : null,
  };
}

function sanitizeMetadata(value: unknown) {
  return isRecord(value) ? value : {};
}

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RecommendationEventBody;
  const eventType = parseEventType(body.eventType);
  const card = parseCard(body.card);

  if (!eventType || !card) {
    return NextResponse.json(
      { error: "추천 이벤트 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const auth = await getAuthenticatedSupabase();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { error } = await auth.supabase.from("recommendation_events").insert({
    user_id: auth.user.id,
    event_type: eventType,
    provider: card.provider,
    provider_id: card.providerId,
    source: card.source,
    query: typeof body.query === "string" ? body.query.slice(0, 500) : null,
    recommendation: card,
    metadata: sanitizeMetadata(body.metadata),
  });

  if (error) {
    return NextResponse.json(
      { error: "추천 기록을 저장하지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
