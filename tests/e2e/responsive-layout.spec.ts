import { expect, test } from "@playwright/test";
import {
  collectConsoleFailures,
  expectNoFrameworkError,
  expectNoHorizontalOverflow,
  mockSupabaseBrowserRequests,
  parsePathList,
} from "./helpers";

const smokePaths = parsePathList(process.env.E2E_SMOKE_PATHS, [
  "/",
  "/search",
  "/rankings",
  "/recommendations",
]);

test.describe("responsive layout smoke", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseBrowserRequests(page);
  });

  for (const path of smokePaths) {
    test(`${path} renders meaningful content without layout overflow`, async ({
      page,
    }) => {
      const consoleFailures = collectConsoleFailures(page);
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(
        response?.status(),
        `${path} should return a page response`,
      ).toBeTruthy();
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
      await expect(
        page.locator("main, [role='main'], body").first(),
      ).toContainText(/\S/);
      await expectNoFrameworkError(page);
      await expectNoHorizontalOverflow(page);
      consoleFailures.expectClean();
    });
  }
});
