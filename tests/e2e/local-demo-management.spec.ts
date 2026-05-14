import { expect, type Page, test } from "@playwright/test";
import {
  collectConsoleFailures,
  type DemoReadingRoomState,
  expectNoFrameworkError,
  expectNoHorizontalOverflow,
  mockSupabaseBrowserRequests,
  seedDemoReadingRoom,
} from "./helpers";

const DEMO_ITEM_ID = "demo-acceptance-item";
const SECOND_DEMO_ITEM_ID = "demo-acceptance-second-item";
const DEMO_LOG_ID = "demo-acceptance-log";

test.describe("local demo reading room management acceptance", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await mockSupabaseBrowserRequests(page);
  });

  test("edits book metadata from the library detail page", async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), `/library/${DEMO_ITEM_ID}`);

    await expect(page.getByRole("heading", { name: "원본 제목" })).toBeVisible();
    const editMetadataButton = page.getByRole("button", {
      name: /책 정보 수정|메타데이터 수정|편집/i,
    });
    await expect(editMetadataButton).toBeVisible({ timeout: 5_000 });
    await editMetadataButton.click();

    await page.getByLabel(/책 제목|제목/i).fill("수정된 제목");
    await page.getByLabel(/저자/i).fill("수정 저자");
    await page.getByLabel(/전체 페이지|페이지 수/i).fill("260");
    await page
      .locator("aside")
      .getByRole("button", { name: /저장|변경 사항 저장/i })
      .click();

    await expect(page.getByRole("heading", { name: "수정된 제목" })).toBeVisible();
    await expect(page.getByText("수정 저자").first()).toBeVisible();
    await expect(page.getByText(/260쪽|전체 페이지 260/i)).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("edits and deletes a reading log from the timeline", async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), `/library/${DEMO_ITEM_ID}`);

    const logEntry = page.locator("li").filter({ hasText: "고치기 전 기록" });
    await expect(logEntry).toBeVisible();
    const editLogButton = logEntry.getByRole("button", {
      name: /기록 수정|수정|편집/i,
    });
    await expect(editLogButton).toBeVisible({ timeout: 5_000 });
    await editLogButton.click();

    await page.getByLabel(/메모|한 줄 메모/i).fill("고친 기록");
    await page.getByLabel(/현재 페이지/i).fill("90");
    await page.getByLabel(/오늘 읽은 쪽/i).fill("20");
    await logEntry.getByRole("button", { name: /기록 저장|저장/i }).click();

    await expect(page.getByText("고친 기록")).toBeVisible();
    await expect(page.getByText("고치기 전 기록")).toHaveCount(0);

    await page
      .locator("li")
      .filter({ hasText: "고친 기록" })
      .getByRole("button", { name: /기록 삭제|삭제/i })
      .click();
    await expect(page.getByRole("dialog", { name: /기록 삭제/i })).toBeVisible();
    await page.getByRole("button", { name: /삭제 확인/i }).click();

    await expect(page.getByText("고친 기록")).toHaveCount(0);
    await expect(page.getByText(/아직 기록이 없습니다|기록이 비어/i)).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("keeps a finished book finished when editing or deleting logs", async ({
    page,
  }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), `/library/${SECOND_DEMO_ITEM_ID}`);

    await expect(page.getByText("상태 완독")).toBeVisible();
    const logEntry = page.locator("li").filter({ hasText: "완독 기록" });
    await logEntry.getByRole("button", { name: /기록 수정|수정|편집/i }).click();
    await page.getByLabel(/메모|한 줄 메모/i).fill("완독 후 수정");
    await logEntry.getByRole("button", { name: /기록 저장|저장/i }).click();

    await expect(page.getByText("완독 후 수정")).toBeVisible();
    await expect(page.getByText("상태 완독")).toBeVisible();

    await page
      .locator("li")
      .filter({ hasText: "완독 후 수정" })
      .getByRole("button", { name: /기록 삭제|삭제/i })
      .click();
    await page.getByRole("button", { name: /삭제 확인/i }).click();

    await expect(page.getByText("상태 완독")).toBeVisible();

    await page.getByRole("button", { name: /완독 취소/i }).click();
    await expect(page.getByText("상태 읽는 중")).toBeVisible();
    await expect(page.getByText("추천 기준이 되는 회고")).toHaveCount(0);
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("archives and deletes a library item from the demo library", async ({
    page,
  }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), `/library/${DEMO_ITEM_ID}`);

    const archiveButton = page.getByRole("button", { name: /보관|아카이브/i });
    await expect(archiveButton).toBeVisible({ timeout: 5_000 });
    await archiveButton.click();
    await expect(page.getByRole("dialog", { name: /보관함으로 이동/i })).toBeVisible();
    await page.getByRole("button", { name: /취소/i }).click();
    await expect(page).toHaveURL(new RegExp(`/library/${DEMO_ITEM_ID}$`));
    await expect(page.getByRole("heading", { name: "원본 제목" })).toBeVisible();

    await archiveButton.click();
    await page.getByRole("button", { name: /보관 확인/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("원본 제목")).not.toBeVisible();

    await page.getByRole("link", { name: /보관함|아카이브/i }).click();
    await expect(page.getByText("원본 제목").first()).toBeVisible();

    await page
      .locator("article")
      .filter({ hasText: "원본 제목" })
      .getByRole("button", { name: /복원/i })
      .click();
    await page.getByRole("link", { name: /독서장/i }).click();
    await expect(page.getByText("원본 제목").first()).toBeVisible();

    await page.goto(`/library/${DEMO_ITEM_ID}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /보관|아카이브/i }).click();
    await page.getByRole("button", { name: /보관 확인/i }).click();
    await page.getByRole("link", { name: /보관함|아카이브/i }).click();

    await page
      .locator("article")
      .filter({ hasText: "원본 제목" })
      .getByRole("button", { name: /영구 삭제|삭제/i })
      .click();
    await page.getByRole("button", { name: /삭제 확인/i }).click();

    await expect(page.getByText("원본 제목")).toHaveCount(0);
    await expect(page.getByText(/서재가 아직 비어|보관한 책이 없습니다/i)).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("shows demo rankings based on local reading history", async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), "/rankings");

    expect(await page.locator("body").innerText()).not.toMatch(
      /This page could not be found|404/i,
    );
    await expect(page.getByRole("heading", { name: /랭킹|순위/i })).toBeVisible();
    await expect(page.getByText("높은 별점 책")).toBeVisible();
    await expect(page.getByText("최근 많이 읽은 책")).toBeVisible();
    await expect(page.getByText("원본 제목").first()).toBeVisible();
    await expect(page.getByText("두 번째 책").first()).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("filters the local library by status workspace", async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), "/");
    const libraryPanel = page.getByRole("region", { name: "내 서재" });

    await expect(page.getByRole("heading", { name: "내 서재" })).toBeVisible();
    await page.getByRole("button", { name: "완독" }).click();
    await expect(libraryPanel.getByText("두 번째 책").first()).toBeVisible();
    await expect(libraryPanel.getByText("원본 제목")).toHaveCount(0);

    await page.getByRole("button", { name: "읽는 중" }).click();
    await expect(libraryPanel.getByText("원본 제목").first()).toBeVisible();
    await expect(libraryPanel.getByText("두 번째 책")).toHaveCount(0);
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("shows a demo insights fallback page from local reading data", async ({
    page,
  }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), "/insights");

    expect(await page.locator("body").innerText()).not.toMatch(
      /This page could not be found|404/i,
    );
    await expect(page.getByRole("heading", { name: /인사이트/i })).toBeVisible();
    await expect(page.getByText("기록한 페이지")).toBeVisible();
    await expect(page.getByText("110쪽")).toBeVisible();
    await expect(page.getByText("추천 기준이 되는 회고")).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("shows demo recommendations and can add one to the library", async ({
    page,
  }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page, seededLibraryState(), "/recommendations");

    expect(await page.locator("body").innerText()).not.toMatch(
      /This page could not be found|404/i,
    );
    await expect(
      page.getByRole("heading", { name: "내 서재 기반 추천" }),
    ).toBeVisible();
    await expect(page.getByText(/원본 제목|두 번째 책/).first()).toBeVisible();

    const recommendation = page.locator("article").first();
    await expect(recommendation).toContainText(/\S/);
    await recommendation
      .getByRole("button", { name: /서재에 추가|읽고 싶어요|추가/i })
      .click();

    await expect(page).toHaveURL(/\/library\/demo-/);
    await page.getByRole("link", { name: /독서장|내 서재|서재/i }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("로컬 맞춤 후보").first()).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });
});

async function seedAndOpen(
  page: Page,
  state: DemoReadingRoomState,
  path: string,
) {
  await seedDemoReadingRoom(page, state);
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

function seededLibraryState(): DemoReadingRoomState {
  return {
    items: [
      {
        id: DEMO_ITEM_ID,
        userId: "demo-user",
        status: "reading",
        currentPage: 70,
        currentPercent: null,
        startedOn: "2026-05-01",
        finishedOn: null,
        rating: null,
        reflection: null,
        book: {
          id: "demo-book-acceptance",
          title: "원본 제목",
          subtitle: null,
          authors: ["원본 저자"],
          coverUrl: null,
          pageCount: 200,
        },
      },
      {
        id: SECOND_DEMO_ITEM_ID,
        userId: "demo-user",
        status: "finished",
        currentPage: 180,
        currentPercent: null,
        startedOn: "2026-04-20",
        finishedOn: "2026-05-06",
        rating: 5,
        reflection: "추천 기준이 되는 회고",
        book: {
          id: "demo-book-second",
          title: "두 번째 책",
          subtitle: null,
          authors: ["추천 저자"],
          coverUrl: null,
          pageCount: 180,
        },
      },
    ],
    logs: [
      {
        id: DEMO_LOG_ID,
        userId: "demo-user",
        libraryItemId: DEMO_ITEM_ID,
        loggedAt: "2026-05-07T09:00:00.000Z",
        currentPage: 70,
        currentPercent: null,
        pagesRead: 30,
        note: "고치기 전 기록",
      },
      {
        id: "demo-second-log",
        userId: "demo-user",
        libraryItemId: SECOND_DEMO_ITEM_ID,
        loggedAt: "2026-05-06T09:00:00.000Z",
        currentPage: 180,
        currentPercent: null,
        pagesRead: 80,
        note: "완독 기록",
      },
    ],
  };
}
