import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  },
  from(table: string) {
    return createQuery(table);
  },
};

const databaseCalls = {
  inserts: [] as Array<{ table: string; payload: unknown }>,
  updates: [] as Array<{ table: string; payload: unknown }>,
};

function createQuery(table: string) {
  const query = {
    insert: vi.fn((payload: unknown) => {
      databaseCalls.inserts.push({ table, payload });
      return query;
    }),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    select: vi.fn(() => query),
    single: vi.fn(async () => ({
      data:
        table === "books"
          ? { id: "book-1" }
          : table === "library_items"
            ? { id: "item-1", status: "reading" }
            : { id: "log-1" },
      error: null,
    })),
    update: vi.fn((payload: unknown) => {
      databaseCalls.updates.push({ table, payload });
      return query;
    }),
    delete: vi.fn(() => query),
    upsert: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
  };

  return query;
}

describe("library actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseCalls.inserts = [];
    databaseCalls.updates = [];
  });

  it("clears the app router cache after adding a book so the reading room shows it", async () => {
    const { addManualBookState } = await import("@/app/actions/library");
    const formData = new FormData();
    formData.set("title", "새 책");
    formData.set("authorsText", "저자");
    formData.set("status", "reading");

    await expect(addManualBookState({ status: "idle", message: "" }, formData))
      .rejects.toThrow("NEXT_REDIRECT:/library/item-1");

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/library/item-1");
  });

  it("adds quote, trimmed tags, and mood to reading log payloads", async () => {
    const { addReadingLogAction } = await import("@/app/actions/library");
    const formData = new FormData();
    formData.set("libraryItemId", "item-1");
    formData.set("pageCount", "240");
    formData.set("currentPage", "42");
    formData.set("pagesRead", "12");
    formData.set("note", "  좋은 장면  ");
    formData.set("quote", "  문장 하나  ");
    formData.set("tags", " 인물,  ,전환점,인물  ");
    formData.set("mood", "  차분함  ");

    await expect(
      addReadingLogAction({ status: "idle", message: "" }, formData),
    ).resolves.toMatchObject({ status: "success" });

    expect(databaseCalls.inserts).toContainEqual({
      table: "reading_logs",
      payload: expect.objectContaining({
        note: "좋은 장면",
        quote: "문장 하나",
        tags: ["인물", "전환점", "인물"],
        mood: "차분함",
      }),
    });
  });

  it("rejects reading log quotes longer than 1000 characters", async () => {
    const { addReadingLogAction } = await import("@/app/actions/library");
    const formData = new FormData();
    formData.set("libraryItemId", "item-1");
    formData.set("quote", "x".repeat(1001));

    await expect(
      addReadingLogAction({ status: "idle", message: "" }, formData),
    ).resolves.toMatchObject({
      status: "error",
      message: "인용문은 1000자 이내로 남겨주세요.",
    });

    expect(databaseCalls.inserts).not.toContainEqual(
      expect.objectContaining({ table: "reading_logs" }),
    );
  });

  it("updates quote, trimmed tags, and mood on reading log payloads", async () => {
    const { updateReadingLogAction } = await import("@/app/actions/library");
    const formData = new FormData();
    formData.set("libraryItemId", "item-1");
    formData.set("logId", "log-1");
    formData.set("currentPercent", "55");
    formData.set("quote", "  다시 볼 문장  ");
    formData.set("tags", "  핵심, , 질문  ");
    formData.set("mood", "  날카로움 ");

    await expect(
      updateReadingLogAction({ status: "idle", message: "" }, formData),
    ).resolves.toMatchObject({ status: "success" });

    expect(databaseCalls.updates).toContainEqual({
      table: "reading_logs",
      payload: expect.objectContaining({
        quote: "다시 볼 문장",
        tags: ["핵심", "질문"],
        mood: "날카로움",
      }),
    });
  });
});
