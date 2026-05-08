import { expect, test } from "@playwright/test";
import {
  collectConsoleFailures,
  expectNoFrameworkError,
  expectNoHorizontalOverflow,
  mockSupabaseBrowserRequests,
} from "./helpers";

test.describe("local demo reading flow", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await mockSupabaseBrowserRequests(page);
  });

  test("adds a book, records progress, finishes it, and persists after reload", async ({
    page,
  }) => {
    const consoleFailures = collectConsoleFailures(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "오늘의 독서장" })).toBeVisible();
    await page.getByRole("link", { name: "책 추가" }).click();

    await expect(page).toHaveURL(/\/search$/);
    await page.getByRole("textbox", { exact: true, name: "책 제목" }).fill("데모북");
    await page.getByPlaceholder("저자, 쉼표로 구분").fill("테스터");
    await page.getByPlaceholder("전체 페이지").fill("120");
    await page.getByRole("button", { name: "직접 추가" }).click();

    await expect(page).toHaveURL(/\/library\/demo-/);
    await expect(page.getByRole("heading", { name: "데모북" })).toBeVisible();

    await page.getByPlaceholder("현재 페이지").fill("30");
    await page.getByPlaceholder("오늘 읽은 쪽").fill("30");
    await page.getByPlaceholder("한 줄 메모").fill("첫 기록");
    await page.getByRole("button", { name: "기록 저장" }).click();

    await expect(page.getByText("25% 진행")).toBeVisible();
    await expect(page.getByText("첫 기록")).toBeVisible();

    await page.locator("select[name='rating']").selectOption("5");
    await page.getByPlaceholder("읽고 남은 생각").fill("오래 기억할 문장들이 있었다.");
    await page.getByRole("button", { name: "완독 저장" }).click();

    await expect(page.getByText("상태 완독")).toBeVisible();
    await expect(
      page.locator("p").filter({ hasText: "오래 기억할 문장들이 있었다." }),
    ).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "데모북" })).toBeVisible();
    await expect(page.getByText("첫 기록")).toBeVisible();
    await expect(
      page.locator("p").filter({ hasText: "오래 기억할 문장들이 있었다." }),
    ).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });
});
