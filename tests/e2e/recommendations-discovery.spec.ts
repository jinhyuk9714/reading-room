import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  collectConsoleFailures,
  type DemoReadingRoomState,
  expectNoFrameworkError,
  expectNoHorizontalOverflow,
  mockSupabaseBrowserRequests,
  seedDemoReadingRoom,
} from "./helpers";

const PURPOSE_REGION_PATTERN =
  /추천\s*목적|목적|purpose|기분|무드|분위기|길이|난이도|장르|잠들기 전|가볍게|깊이/i;
const EXCLUDE_ACTION_PATTERN =
  /관심 없음|숨기기|제외|다시 보지 않기|추천 제외|not interested|dismiss|hide|exclude/i;

test.describe("recommendations discovery", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await mockSupabaseBrowserRequests(page);
  });

  test("renders a recommendation feed on desktop and mobile", async ({ page }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page);

    await expect(
      page.getByRole("heading", { name: "내 서재 기반 추천" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "추천 도서" }),
    ).toBeVisible();
    await expect(recommendationCards(page).first()).toBeVisible();
    expect(
      await recommendationCards(page).count(),
      "recommendation feed should show multiple cards",
    ).toBeGreaterThanOrEqual(2);
    await expect(recommendationCards(page).first()).toContainText(/\S/);
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("updates recommendation results when a purpose is selected", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "purpose interaction is covered once on desktop",
    );

    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page);

    const before = await recommendationSnapshot(page);
    expect(before.length, "recommendation feed should start with cards").toBeGreaterThan(
      0,
    );

    await chooseAlternatePurpose(page);

    await expect
      .poll(() => recommendationSnapshot(page), {
        message: "purpose selection should change the visible recommendations",
        timeout: 5_000,
      })
      .not.toEqual(before);
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("excludes a recommendation through the card quick action", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("desktop"),
      "exclude interaction is covered once on desktop",
    );

    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page);

    const card = recommendationCards(page).first();
    await expect(card).toBeVisible();
    const title = await cardTitle(card);

    const excludeButton = card.getByRole("button", {
      name: EXCLUDE_ACTION_PATTERN,
    });
    await expect(
      excludeButton,
      "recommendation cards should expose an exclude/dismiss quick action",
    ).toBeVisible();
    await excludeButton.click();

    await expect(
      recommendationCards(page).filter({ hasText: title }),
      "excluded recommendation should leave the current feed",
    ).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      recommendationCards(page).filter({ hasText: title }),
      "excluded recommendation should stay hidden after reload",
    ).toHaveCount(0);
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });

  test("adds a recommendation to the no-env demo library and routes to detail", async ({
    page,
  }) => {
    const consoleFailures = collectConsoleFailures(page);
    await seedAndOpen(page);

    const card = recommendationCards(page).first();
    await expect(card).toBeVisible();
    const title = await cardTitle(card);
    await card
      .getByRole("button", { name: /서재에 추가|읽고 싶어요|추가/i })
      .click();

    await expect(page).toHaveURL(/\/library\/demo-/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expectNoFrameworkError(page);
    await expectNoHorizontalOverflow(page);
    consoleFailures.expectClean();
  });
});

async function seedAndOpen(page: Page) {
  await seedDemoReadingRoom(page, seededRecommendationState());
  await page.goto("/recommendations", { waitUntil: "domcontentloaded" });
}

function recommendationCards(page: Page) {
  return page.locator("main article");
}

async function recommendationSnapshot(page: Page) {
  return recommendationCards(page).evaluateAll((cards) =>
    cards
      .map((card) => {
        const heading =
          card.querySelector("h2, h3")?.textContent?.trim() ?? "";
        const copy = Array.from(card.querySelectorAll("p"))
          .map((paragraph) => paragraph.textContent?.trim())
          .filter(Boolean)
          .join(" ");

        return `${heading} :: ${copy}`.trim();
      })
      .filter(Boolean),
  );
}

async function cardTitle(card: Locator) {
  return (await card.locator("h2, h3").first().innerText()).trim();
}

async function chooseAlternatePurpose(page: Page) {
  const labelledControl = page.getByLabel(PURPOSE_REGION_PATTERN).first();
  if (await labelledControl.isVisible().catch(() => false)) {
    const tagName = await labelledControl
      .evaluate((element) => element.tagName.toLowerCase())
      .catch(() => "");

    if (tagName === "select") {
      const nextValue = await labelledControl.evaluate((element) => {
        const select = element as HTMLSelectElement;
        const option = Array.from(select.options).find(
          (candidate) => !candidate.disabled && candidate.value !== select.value,
        );

        return option?.value ?? "";
      });

      expect(
        nextValue,
        "purpose selector should offer at least two choices",
      ).not.toBe("");
      await labelledControl.selectOption(nextValue);
      return;
    }
  }

  const purposeRegion = page
    .locator("fieldset, [role='group'], [role='radiogroup'], section, form")
    .filter({ hasText: PURPOSE_REGION_PATTERN })
    .first();
  await expect(
    purposeRegion,
    "recommendations should expose purpose selection controls",
  ).toBeVisible();

  const options = purposeRegion
    .getByRole("button")
    .or(purposeRegion.getByRole("radio"))
    .or(purposeRegion.getByRole("option"));
  await expect(
    options.nth(1),
    "purpose selector should offer at least two choices",
  ).toBeVisible();
  await options.nth(1).click();
}

function seededRecommendationState(): DemoReadingRoomState {
  return {
    items: [
      {
        id: "demo-recommendation-reading",
        userId: "demo-user",
        status: "reading",
        currentPage: 84,
        currentPercent: null,
        startedOn: "2026-05-01",
        finishedOn: null,
        rating: null,
        reflection: null,
        book: {
          id: "demo-book-cloud-atlas",
          title: "구름의 지도",
          subtitle: null,
          authors: ["한서윤"],
          coverUrl: null,
          pageCount: 240,
        },
      },
      {
        id: "demo-recommendation-finished",
        userId: "demo-user",
        status: "finished",
        currentPage: 180,
        currentPercent: null,
        startedOn: "2026-04-22",
        finishedOn: "2026-05-06",
        rating: 5,
        reflection: "짧고 차분한 문장 덕분에 밤에 읽기 좋았다.",
        book: {
          id: "demo-book-night-essay",
          title: "밤의 산책자",
          subtitle: null,
          authors: ["정온"],
          coverUrl: null,
          pageCount: 180,
        },
      },
      {
        id: "demo-recommendation-paused",
        userId: "demo-user",
        status: "paused",
        currentPage: 55,
        currentPercent: null,
        startedOn: "2026-04-15",
        finishedOn: null,
        rating: null,
        reflection: null,
        book: {
          id: "demo-book-deep-work",
          title: "깊은 일의 시간",
          subtitle: null,
          authors: ["민준"],
          coverUrl: null,
          pageCount: 320,
        },
      },
    ],
    logs: [
      {
        id: "demo-recommendation-log-one",
        userId: "demo-user",
        libraryItemId: "demo-recommendation-reading",
        loggedAt: "2026-05-07T09:00:00.000Z",
        currentPage: 84,
        currentPercent: null,
        pagesRead: 24,
        note: "다음에는 더 조용한 흐름의 책을 찾고 싶다.",
      },
      {
        id: "demo-recommendation-log-two",
        userId: "demo-user",
        libraryItemId: "demo-recommendation-finished",
        loggedAt: "2026-05-06T09:00:00.000Z",
        currentPage: 180,
        currentPercent: null,
        pagesRead: 80,
        note: "잠들기 전 읽기 좋은 속도였다.",
      },
    ],
  };
}
