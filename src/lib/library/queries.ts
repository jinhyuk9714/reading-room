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
import { summarizeReadingRoom } from "@/lib/reading/stats";
import type { ReadingStatus } from "@/lib/reading/types";

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

function rankingBookFromRow(row: RankingItemRow) {
  return Array.isArray(row.books) ? row.books[0] : row.books;
}

export async function getReadingRoom(userId: string) {
  const supabase = await createClient();

  const [{ data: itemRows, error: itemError }, { data: logRows, error: logError }] =
    await Promise.all([
      supabase
        .from("library_items")
        .select(
          "id,user_id,status,current_page,current_percent,started_on,finished_on,rating,reflection,custom_title,custom_authors,custom_page_count,books(id,title,subtitle,authors,cover_url,page_count)",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("reading_logs")
        .select(
          "id,user_id,library_item_id,logged_at,current_page,current_percent,pages_read,note,quote,tags,mood",
        )
        .eq("user_id", userId)
        .order("logged_at", { ascending: false })
        .limit(40),
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

export async function getLibraryItemDetail(userId: string, itemId: string) {
  const supabase = await createClient();

  const { data: itemRow, error: itemError } = await supabase
    .from("library_items")
    .select(
      "id,user_id,status,current_page,current_percent,started_on,finished_on,rating,reflection,custom_title,custom_authors,custom_page_count,books(id,title,subtitle,authors,cover_url,page_count)",
    )
    .eq("user_id", userId)
    .eq("id", itemId)
    .single();

  if (itemError || !itemRow) {
    notFound();
  }

  const { data: logRows, error: logError } = await supabase
    .from("reading_logs")
    .select(
      "id,user_id,library_item_id,logged_at,current_page,current_percent,pages_read,note,quote,tags,mood",
    )
    .eq("user_id", userId)
    .eq("library_item_id", itemId)
    .order("logged_at", { ascending: false });

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
