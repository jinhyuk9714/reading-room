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

function createQuery(table: string) {
  const query = {
    insert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    select: vi.fn(() => query),
    single: vi.fn(async () => ({
      data: { id: table === "books" ? "book-1" : "item-1" },
      error: null,
    })),
    upsert: vi.fn(() => query),
    eq: vi.fn(() => query),
  };

  return query;
}

describe("library actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
