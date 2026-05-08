import { NextResponse } from "next/server";

import {
  getRecommendations,
  recommendationQueryFromIntent,
} from "@/lib/recommendations/recommendations";
import type {
  RecommendationIntent,
  RecommendationMode,
} from "@/lib/recommendations/types";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
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
    mood: typeof record.mood === "string" ? record.mood : undefined,
    length: typeof record.length === "string" ? record.length : undefined,
    difficulty:
      typeof record.difficulty === "string" ? record.difficulty : undefined,
    genres: parseStringArray(record.genres),
    purpose: typeof record.purpose === "string" ? record.purpose : undefined,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    query?: unknown;
    mode?: unknown;
    intent?: unknown;
    prompt?: unknown;
    previousProviderIds?: unknown;
    hiddenProviderIds?: unknown;
    limit?: unknown;
  };

  const mode = parseMode(body.mode);
  const intent = parseIntent(body.intent);
  const legacyQuery = typeof body.query === "string" ? body.query.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const hasStructuredMode =
    body.mode === "feed" || body.mode === "purpose" || body.mode === "conversation";
  const query =
    legacyQuery ||
    prompt ||
    (body.mode === "purpose"
      ? recommendationQueryFromIntent(intent)
      : hasStructuredMode && mode === "feed"
        ? "국내 독서 추천"
        : "");
  const limit = normalizeLimit(body.limit);

  if (!query) {
    return NextResponse.json(
      { error: "Missing recommendation query." },
      { status: 400 },
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const results = await getRecommendations(query, {
    limit,
    mode,
    intent,
    previousProviderIds: parseStringArray(body.previousProviderIds),
    hiddenProviderIds: parseStringArray(body.hiddenProviderIds),
  });

  return NextResponse.json({ results });
}
