import { expect, type Page } from "@playwright/test";
import type {
  LibraryItemWithBook,
  ReadingLog,
} from "@/lib/reading/types";

const AUTH_SURFACE_PATTERN =
  /log in|login|sign in|sign up|setup|set up|create account|email|password|로그인|회원가입|설정|이메일|비밀번호/i;

const FRAMEWORK_ERROR_PATTERN =
  /Unhandled Runtime Error|Build Error|Application error|Hydration failed|This page could not be found/i;

const DEMO_STORAGE_KEY = "reading-room-demo-v1";

export type DemoReadingRoomState = {
  items: LibraryItemWithBook[];
  logs: Array<
    Omit<ReadingLog, "quote" | "tags" | "mood"> & {
      quote?: string | null;
      tags?: string[];
      mood?: string | null;
    }
  >;
};

export function parsePathList(value: string | undefined, fallback: string[]) {
  return (value ?? fallback.join(","))
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => (path.startsWith("/") ? path : `/${path}`));
}

export function collectConsoleFailures(page: Page) {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console error: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    failures.push(`page error: ${error.message}`);
  });

  return {
    expectClean() {
      expect(failures).toEqual([]);
    },
  };
}

export async function seedDemoReadingRoom(
  page: Page,
  state: DemoReadingRoomState,
) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
      window.sessionStorage.clear();
    },
    { key: DEMO_STORAGE_KEY, value: state },
  );
}

export async function mockSupabaseBrowserRequests(page: Page) {
  await page.route(
    (url) =>
      url.hostname.endsWith(".supabase.co") ||
      (["127.0.0.1", "localhost"].includes(url.hostname) &&
        url.port === "54321") ||
      url.pathname.startsWith("/auth/v1/") ||
      url.pathname.startsWith("/rest/v1/"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = {
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-origin": "*",
        "content-type": "application/json",
      };

      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers, body: "" });
        return;
      }

      if (url.pathname.includes("/auth/v1/token")) {
        await route.fulfill({
          status: 400,
          headers,
          json: {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
            msg: "Invalid login credentials",
          },
        });
        return;
      }

      if (url.pathname.includes("/auth/v1/user")) {
        await route.fulfill({
          status: 401,
          headers,
          json: { message: "No active session" },
        });
        return;
      }

      if (url.pathname.startsWith("/rest/v1/")) {
        await route.fulfill({ status: 200, headers, json: [] });
        return;
      }

      await route.fulfill({ status: 200, headers, json: {} });
    },
  );
}

export async function expectNoFrameworkError(page: Page) {
  await expect(page.locator("body")).not.toContainText(FRAMEWORK_ERROR_PATTERN);
  const frameworkPortal = page.locator("nextjs-portal");

  if ((await frameworkPortal.count()) > 0) {
    await expect(frameworkPortal).not.toContainText(FRAMEWORK_ERROR_PATTERN);
  }
}

export async function findAuthRoute(page: Page, paths: string[]) {
  for (const path of paths) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const isNotFound =
      status === 404 || /This page could not be found|404/i.test(bodyText);

    if (!isNotFound && AUTH_SURFACE_PATTERN.test(bodyText)) {
      return { path, status };
    }
  }

  return null;
}

export async function expectAuthSurface(page: Page) {
  await expect(page.locator("main, [role='main'], body").first()).toContainText(
    AUTH_SURFACE_PATTERN,
  );
}

export async function submitCredentialFormIfPresent(page: Page) {
  const emailInput = page
    .locator(
      [
        "input[type='email']",
        "input[name*='email' i]",
        "input[autocomplete='email']",
        "input[placeholder*='email' i]",
        "input[placeholder*='이메일' i]",
      ].join(","),
    )
    .first();
  const passwordInput = page.locator("input[type='password']").first();

  const hasEmailInput = await emailInput.isVisible().catch(() => false);
  const hasPasswordInput = await passwordInput.isVisible().catch(() => false);

  if (!hasEmailInput || !hasPasswordInput) {
    return false;
  }

  await emailInput.fill("reader@example.test");
  await passwordInput.fill("invalid-password");

  const namedSubmit = page
    .getByRole("button", {
      name: /log in|login|sign in|continue|start|save|create|로그인|계속|시작|저장|만들기/i,
    })
    .first();
  const fallbackSubmit = page
    .locator("button[type='submit'], input[type='submit'], form button")
    .first();
  const submitButton = (await namedSubmit.isVisible().catch(() => false))
    ? namedSubmit
    : fallbackSubmit;

  if (!(await submitButton.isVisible().catch(() => false))) {
    return false;
  }

  await submitButton.click();
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
  return true;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const viewportWidth = documentElement.clientWidth;
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      })
      .filter(
        ({ left, right, width }) =>
          width > 0 && (left < -1 || right > viewportWidth + 1),
      )
      .slice(0, 5);

    return {
      clientWidth: viewportWidth,
      scrollWidth: documentElement.scrollWidth,
      offenders,
    };
  });

  expect(overflow, JSON.stringify(overflow.offenders, null, 2)).toMatchObject({
    scrollWidth: expect.any(Number),
    clientWidth: expect.any(Number),
    offenders: [],
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}
