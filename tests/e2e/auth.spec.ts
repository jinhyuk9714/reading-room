import { expect, test } from "@playwright/test";
import {
  collectConsoleFailures,
  expectAuthSurface,
  expectNoFrameworkError,
  findAuthRoute,
  mockSupabaseBrowserRequests,
  parsePathList,
  submitCredentialFormIfPresent,
} from "./helpers";

const authPaths = parsePathList(process.env.E2E_AUTH_PATHS, [
  "/setup",
  "/login",
  "/sign-in",
  "/signin",
  "/auth/login",
  "/auth/sign-in",
]);

test.describe("unauthenticated setup/login", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await mockSupabaseBrowserRequests(page);
  });

  test("renders an unauthenticated setup or login entry without real Supabase credentials", async ({
    page,
  }) => {
    const route = await findAuthRoute(page, authPaths);

    if (!route) {
      test.skip(true, `No auth/setup route found. Checked: ${authPaths.join(", ")}`);
      return;
    }

    const consoleFailures = collectConsoleFailures(page);
    await page.goto(route.path, { waitUntil: "domcontentloaded" });

    expect(route.status).toBeGreaterThanOrEqual(200);
    expect(route.status).toBeLessThan(400);
    await expectAuthSurface(page);
    await expectNoFrameworkError(page);
    consoleFailures.expectClean();
  });

  test("keeps rejected credential submission on a stable unauthenticated surface", async ({
    page,
  }) => {
    const route = await findAuthRoute(page, authPaths);

    if (!route) {
      test.skip(true, `No auth/setup route found. Checked: ${authPaths.join(", ")}`);
      return;
    }

    const consoleFailures = collectConsoleFailures(page);
    await page.goto(route.path, { waitUntil: "domcontentloaded" });

    const submitted = await submitCredentialFormIfPresent(page);

    test.skip(
      !submitted,
      "Auth/setup route has no email and password credential form to submit.",
    );

    await expect(page.locator("body")).toBeVisible();
    await expectAuthSurface(page);
    await expectNoFrameworkError(page);
    expect(new URL(page.url()).origin).toBe(
      new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:3000").origin,
    );
    consoleFailures.expectClean();
  });
});
