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

const databaseCalls = {
  upserts: [] as Array<{ table: string; payload: unknown }>,
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  },
  from(table: string) {
    return {
      upsert(payload: unknown) {
        databaseCalls.upserts.push({ table, payload });
        return Promise.resolve({ error: null });
      },
    };
  },
};

describe("reader preference actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseCalls.upserts = [];
  });

  it("validates and stores reader goals and keyword preferences", async () => {
    const { updateReaderPreferencesAction } = await import(
      "@/app/actions/preferences"
    );
    const formData = new FormData();
    formData.set("dailyPageGoal", "35");
    formData.set("weeklySessionGoal", "6");
    formData.set("defaultLogMode", "percent");
    formData.set("favoriteSubjects", "한국 소설, 에세이");
    formData.set("blockedSubjects", "원서");

    await expect(
      updateReaderPreferencesAction({ status: "idle", message: "" }, formData),
    ).resolves.toEqual({
      status: "success",
      message: "독서 설정을 저장했습니다.",
    });

    expect(databaseCalls.upserts).toContainEqual({
      table: "reader_preferences",
      payload: expect.objectContaining({
        user_id: "user-1",
        daily_page_goal: 35,
        weekly_session_goal: 6,
        default_log_mode: "percent",
        favorite_subjects: ["한국 소설", "에세이"],
        blocked_subjects: ["원서"],
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/insights");
  });
});
