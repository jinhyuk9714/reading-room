import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hardeningSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260508001000_harden_reading_room.sql",
  ),
  "utf8",
);
const searchProviderSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260508002000_extend_book_providers_for_search.sql",
  ),
  "utf8",
);
const operationalHardeningSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260508003000_operational_hardening.sql",
  ),
  "utf8",
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
