import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapLibraryItem,
  mapReadingLog,
  type LibraryItemRow,
  type ReadingLogRow,
} from "@/lib/library/mappers";
import {
  aggregateAnonymousRankings,
  type ReadingRankings,
  type RankingLibraryItem,
  type RankingReadingLog,
} from "@/lib/rankings";
import { sanitizeDatabaseError } from "@/lib/library/validation";
import { defaultReaderPreferences } from "@/lib/reader-preferences";
import { summarizeReadingRoom } from "@/lib/reading/stats";
import type { ReaderPreferences, ReadingStatus } from "@/lib/reading/types";

type RankingBookRow = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  cover_url: string | null;
  page_count: number | null;
};

type RankingItemRow = {
  id: string;
  status: ReadingStatus;
  rating: number | null;
  books: RankingBookRow | RankingBookRow[] | null;
};

type RankingLogRow = {
  library_item_id: string;
  logged_at: string;
};

type ReaderPreferenceRow = {
  daily_page_goal: number | null;
  weekly_session_goal: number | null;
  default_log_mode: string | null;
  favorite_subjects: string[] | null;
  blocked_subjects: string[] | null;
};

const READING_LOG_COLUMNS =
  "id,user_id,library_item_id,logged_at,current_page,current_percent,pages_read,note,quote,tags,mood";
const LEGACY_READING_LOG_COLUMNS =
  "id,user_id,library_item_id,logged_at,current_page,current_percent,pages_read,note";
const LIBRARY_ITEM_COLUMNS =
  "id,user_id,status,current_page,current_percent,started_on,finished_on,rating,reflection,custom_title,custom_authors,custom_page_count,books(id,title,subtitle,authors,cover_url,page_count)";
const LEGACY_LIBRARY_ITEM_COLUMNS =
  "id,user_id,status,current_page,current_percent,started_on,finished_on,rating,reflection,books(id,title,subtitle,authors,cover_url,page_count)";

function rankingBookFromRow(row: RankingItemRow) {
  return Array.isArray(row.books) ? row.books[0] : row.books;
}

function canRetryLegacySelect(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42703" ||
    error?.code === "42P01" ||
    /column .* does not exist|relation .* does not exist/i.test(
      error?.message ?? "",
    )
  );
}

async function getReadingLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  options: { itemId?: string; limit?: number } = {},
) {
  let query = supabase
    .from("reading_logs")
    .select(READING_LOG_COLUMNS)
    .eq("user_id", userId);

  if (options.itemId) {
    query = query.eq("library_item_id", options.itemId);
  }

  query = query.order("logged_at", { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const result = await query;

  if (!result.error || !canRetryLegacySelect(result.error)) {
    return result;
  }

  let legacyQuery = supabase
    .from("reading_logs")
    .select(LEGACY_READING_LOG_COLUMNS)
    .eq("user_id", userId);

  if (options.itemId) {
    legacyQuery = legacyQuery.eq("library_item_id", options.itemId);
  }

  legacyQuery = legacyQuery.order("logged_at", { ascending: false });

  if (options.limit) {
    legacyQuery = legacyQuery.limit(options.limit);
  }

  return legacyQuery;
}

async function getLibraryItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const result = await supabase
    .from("library_items")
    .select(LIBRARY_ITEM_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (!result.error || !canRetryLegacySelect(result.error)) {
    return result;
  }

  return supabase
    .from("library_items")
    .select(LEGACY_LIBRARY_ITEM_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
}

async function getLibraryItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: string,
) {
  const result = await supabase
    .from("library_items")
    .select(LIBRARY_ITEM_COLUMNS)
    .eq("user_id", userId)
    .eq("id", itemId)
    .single();

  if (!result.error || !canRetryLegacySelect(result.error)) {
    return result;
  }

  return supabase
    .from("library_items")
    .select(LEGACY_LIBRARY_ITEM_COLUMNS)
    .eq("user_id", userId)
    .eq("id", itemId)
    .single();
}

export async function getReadingRoom(userId: string) {
  const supabase = await createClient();

  const [{ data: itemRows, error: itemError }, { data: logRows, error: logError }] =
    await Promise.all([
      getLibraryItems(supabase, userId),
      getReadingLogs(supabase, userId, { limit: 40 }),
    ]);

  if (itemError) {
    throw new Error(sanitizeDatabaseError(itemError));
  }
  if (logError) {
    throw new Error(sanitizeDatabaseError(logError));
  }

  const items = ((itemRows ?? []) as LibraryItemRow[]).map(mapLibraryItem);
  const logs = ((logRows ?? []) as ReadingLogRow[]).map(mapReadingLog);

  return {
    items,
    logs,
    summary: summarizeReadingRoom({ items, logs }),
  };
}

export async function getReaderPreferences(
  userId: string,
): Promise<ReaderPreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reader_preferences")
    .select(
      "daily_page_goal,weekly_session_goal,default_log_mode,favorite_subjects,blocked_subjects",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return defaultReaderPreferences;
  }

  return mapReaderPreferences(data as ReaderPreferenceRow | null);
}

export async function getLibraryItemDetail(userId: string, itemId: string) {
  const supabase = await createClient();

  const { data: itemRow, error: itemError } = await getLibraryItem(
    supabase,
    userId,
    itemId,
  );

  if (itemError || !itemRow) {
    notFound();
  }

  const { data: logRows, error: logError } = await getReadingLogs(supabase, userId, {
    itemId,
  });

  if (logError) {
    throw new Error(sanitizeDatabaseError(logError));
  }

  return {
    item: mapLibraryItem(itemRow as LibraryItemRow),
    logs: ((logRows ?? []) as ReadingLogRow[]).map(mapReadingLog),
  };
}

export async function getAnonymousReadingRankings(userId?: string): Promise<{
  rankings: ReadingRankings;
  source: "global" | "personal" | "empty";
}> {
  const admin = createAdminClient();

  if (admin) {
    const [{ data: itemRows, error: itemError }, { data: logRows, error: logError }] =
      await Promise.all([
        admin
          .from("library_items")
          .select(
            "id,status,rating,books(id,title,subtitle,authors,cover_url,page_count)",
          ),
        admin
          .from("reading_logs")
          .select("library_item_id,logged_at")
          .order("logged_at", { ascending: false })
          .limit(500),
      ]);

    if (itemError) {
      throw new Error(sanitizeDatabaseError(itemError));
    }
    if (logError) {
      throw new Error(sanitizeDatabaseError(logError));
    }

    return {
      rankings: aggregateAnonymousRankings({
        items: ((itemRows ?? []) as unknown as RankingItemRow[])
          .map((row) => ({ row, book: rankingBookFromRow(row) }))
          .filter(({ book }) => book)
          .map(
            ({ row, book }): RankingLibraryItem => ({
              id: row.id,
              status: row.status,
              rating: row.rating,
              book: {
                id: book!.id,
                title: book!.title,
                subtitle: book!.subtitle,
                authors: book!.authors,
                coverUrl: book!.cover_url,
                pageCount: book!.page_count,
              },
            }),
          ),
        logs: ((logRows ?? []) as unknown as RankingLogRow[]).map(
          (row): RankingReadingLog => ({
            libraryItemId: row.library_item_id,
            loggedAt: row.logged_at,
          }),
        ),
        minimumSampleSize: 2,
      }),
      source: "global",
    };
  }

  if (!userId) {
    return {
      rankings: aggregateAnonymousRankings({ items: [], logs: [] }),
      source: "empty",
    };
  }

  const { items, logs } = await getReadingRoom(userId);
  return {
    rankings: aggregateAnonymousRankings({ items, logs }),
    source: "personal",
  };
}

function mapReaderPreferences(row: ReaderPreferenceRow | null): ReaderPreferences {
  if (!row) {
    return defaultReaderPreferences;
  }

  return {
    dailyPageGoal:
      typeof row.daily_page_goal === "number"
        ? row.daily_page_goal
        : defaultReaderPreferences.dailyPageGoal,
    weeklySessionGoal:
      typeof row.weekly_session_goal === "number"
        ? row.weekly_session_goal
        : defaultReaderPreferences.weeklySessionGoal,
    defaultLogMode:
      row.default_log_mode === "percent" ? "percent" : "page",
    favoriteSubjects: row.favorite_subjects ?? [],
    blockedSubjects: row.blocked_subjects ?? [],
  };
}
