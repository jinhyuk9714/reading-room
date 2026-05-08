import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(path: string) {
  const absolutePath = join(process.cwd(), path);

  if (!existsSync(absolutePath)) {
    return "";
  }

  return readFileSync(absolutePath, "utf8");
}

const hardeningSql = readMigration(
  "supabase/migrations/20260508001000_harden_reading_room.sql",
);
const searchProviderSql = readMigration(
  "supabase/migrations/20260508002000_extend_book_providers_for_search.sql",
);
const operationalHardeningSql = readMigration(
  "supabase/migrations/20260508003000_operational_hardening.sql",
);
const recommendationDiscoverySql = readMigration(
  "supabase/migrations/20260508004000_recommendation_discovery.sql",
);

describe("Supabase hardening migration", () => {
  it("removes shared book metadata updates from authenticated users", () => {
    expect(hardeningSql).toContain(
      'drop policy if exists "books authenticated update" on public.books',
    );
    expect(hardeningSql).not.toContain("on public.books for update");
  });

  it("requires reading logs to point at a library item owned by the same user", () => {
    expect(hardeningSql).toContain("ensure_reading_log_library_owner");
    expect(hardeningSql).toContain("create schema if not exists private");
    expect(hardeningSql).toContain("new.library_item_id");
    expect(hardeningSql).toContain("and user_id = new.user_id");
    expect(hardeningSql).toContain("logs insert own library item");
  });

  it("adds updated_at triggers and stricter book/library constraints", () => {
    expect(hardeningSql).toContain("create trigger books_set_updated_at");
    expect(hardeningSql).toContain("create trigger library_items_set_updated_at");
    expect(hardeningSql).toContain("books_page_count_positive");
    expect(hardeningSql).toContain("library_items_finished_date_matches_status");
    expect(hardeningSql).toContain("library_items_custom_page_count_positive");
  });

  it("allows Korean book providers through the books insert policy", () => {
    expect(searchProviderSql).toContain(
      "provider in ('google', 'open-library', 'manual', 'kakao', 'naver')",
    );
    expect(operationalHardeningSql).toContain(
      "provider in ('google', 'manual', 'kakao', 'naver')",
    );
    expect(operationalHardeningSql).not.toContain(
      "provider in ('google', 'open-library', 'manual', 'kakao', 'naver')",
    );
  });

  it("narrows privileged function search paths and grants Data API access explicitly", () => {
    expect(operationalHardeningSql).toContain("set search_path = pg_catalog");
    expect(operationalHardeningSql).toContain(
      "revoke all on function private.ensure_reading_log_library_owner() from authenticated",
    );
    expect(operationalHardeningSql).toContain(
      "grant select, insert, update, delete on public.library_items to authenticated",
    );
  });
});

describe("Supabase recommendation discovery migration", () => {
  it("creates reader preferences as one row per authenticated user", () => {
    expect(recommendationDiscoverySql).toContain(
      "create table if not exists public.reader_preferences",
    );
    expect(recommendationDiscoverySql).toContain(
      "user_id uuid primary key references auth.users(id) on delete cascade",
    );
    expect(recommendationDiscoverySql).toContain(
      "preferred_languages text[] not null default array['ko']::text[]",
    );
    expect(recommendationDiscoverySql).toContain(
      "excluded_providers text[] not null default '{}'::text[]",
    );
    expect(recommendationDiscoverySql).toContain(
      "signals jsonb not null default '{}'::jsonb",
    );
  });

  it("creates recommendation events as append-friendly user-owned rows", () => {
    expect(recommendationDiscoverySql).toContain(
      "create table if not exists public.recommendation_events",
    );
    expect(recommendationDiscoverySql).toContain(
      "id uuid primary key default gen_random_uuid()",
    );
    expect(recommendationDiscoverySql).toContain(
      "event_type text not null",
    );
    expect(recommendationDiscoverySql).toContain(
      "recommendation jsonb not null default '{}'::jsonb",
    );
    expect(recommendationDiscoverySql).toContain(
      "constraint recommendation_events_event_type_allowed",
    );
    expect(recommendationDiscoverySql).toContain(
      "event_type ~ '^[a-z][a-z0-9_]{1,63}$'",
    );
    expect(recommendationDiscoverySql).toContain(
      "create index if not exists recommendation_events_user_created_at_idx",
    );
  });

  it("enables RLS and restricts both tables to explicit authenticated user ownership", () => {
    expect(recommendationDiscoverySql).toContain(
      "alter table public.reader_preferences enable row level security",
    );
    expect(recommendationDiscoverySql).toContain(
      "alter table public.recommendation_events enable row level security",
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "reader preferences select own"',
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "reader preferences insert own"',
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "reader preferences update own"',
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "reader preferences delete own"',
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "recommendation events select own"',
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "recommendation events insert own"',
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "recommendation events update own"',
    );
    expect(recommendationDiscoverySql).toContain(
      'create policy "recommendation events delete own"',
    );
    expect(recommendationDiscoverySql).toContain(
      "using ((select auth.uid()) = user_id)",
    );
    expect(recommendationDiscoverySql).toContain(
      "with check ((select auth.uid()) = user_id)",
    );
  });

  it("exposes recommendation discovery tables through authenticated Data API grants only", () => {
    expect(recommendationDiscoverySql).toContain(
      "grant select, insert, update, delete on public.reader_preferences to authenticated",
    );
    expect(recommendationDiscoverySql).toContain(
      "grant select, insert, update, delete on public.recommendation_events to authenticated",
    );
    expect(recommendationDiscoverySql).toContain(
      "revoke all on public.reader_preferences from public",
    );
    expect(recommendationDiscoverySql).toContain(
      "revoke all on public.recommendation_events from public",
    );
    expect(recommendationDiscoverySql).toContain(
      "revoke all on public.reader_preferences from anon",
    );
    expect(recommendationDiscoverySql).toContain(
      "revoke all on public.recommendation_events from anon",
    );
    expect(recommendationDiscoverySql).not.toContain(
      "on public.reader_preferences to anon",
    );
    expect(recommendationDiscoverySql).not.toContain(
      "on public.recommendation_events to anon",
    );
    expect(recommendationDiscoverySql.toLowerCase()).not.toContain(
      "security definer",
    );
  });
});
