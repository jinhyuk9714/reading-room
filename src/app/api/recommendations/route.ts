import { NextResponse } from "next/server";

import { getRecommendations } from "@/lib/recommendations/recommendations";
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    query?: unknown;
    limit?: unknown;
  };

  const query = typeof body.query === "string" ? body.query.trim() : "";
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

  const results = await getRecommendations(query, { limit });

  return NextResponse.json({ results });
}
