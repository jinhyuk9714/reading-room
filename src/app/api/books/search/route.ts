import { NextResponse } from "next/server";
import { searchBooks } from "@/lib/books/search";

const SEARCH_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
};

const ERROR_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=30",
};

function normalizeLimit(value: string | null) {
  const parsed = Number(value ?? 12);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 20) : 12;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limit = normalizeLimit(searchParams.get("limit"));

  if (!query) {
    return NextResponse.json({ error: "Missing search query." }, { status: 400 });
  }

  if (query.length > 120) {
    return NextResponse.json(
      { error: "검색어는 120자 이내로 입력해주세요." },
      { status: 400, headers: ERROR_CACHE_HEADERS },
    );
  }

  try {
    const results = await searchBooks(query, { limit });
    return NextResponse.json({ results }, { headers: SEARCH_CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "검색에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 503, headers: ERROR_CACHE_HEADERS },
    );
  }
}
