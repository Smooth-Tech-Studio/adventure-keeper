import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

import { TEST_IMAGE_ORIGIN } from "./data";
import { createTestUser, type TestUser } from "./emulator";

/** A plain map for every test image: a grid, so the page has something to draw. */
const MAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<rect width="800" height="600" fill="#d6c7a1"/><path d="M0 0H800M0 100H800M0 200H800M0 300H800M0 400H800M0 500H800M0 0V600M100 0V600M200 0V600M300 0V600M400 0V600M500 0V600M600 0V600M700 0V600" stroke="#8b7b55"/></svg>`;

async function serveTestImages(context: BrowserContext) {
  await context.route(`${TEST_IMAGE_ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: MAP_SVG }),
  );
}

/** Signs in through the login page, as a player would. */
export async function signIn(page: Page, user: TestUser, { from = "/" } = {}) {
  await page.goto(from === "/" ? "/login" : from);
  await expect(page.getByText("Connexion", { exact: true })).toBeVisible();
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Menu du compte" })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Menu du compte" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page.getByRole("link", { name: "Se connecter" }).first()).toBeVisible();
}

interface Fixtures {
  /** A fresh account, not signed in. */
  account: TestUser;
  /** A page already signed in with `account`. */
  signedInPage: Page;
  /**
   * A page signed in as someone else, in its own browser context — another
   * person at the table. Closed with the test.
   */
  openAs: (user: TestUser) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  account: async ({}, use) => {
    await use(await createTestUser("Testeur"));
  },
  context: async ({ context }, use) => {
    await serveTestImages(context);
    await use(context);
  },
  signedInPage: async ({ page, account }, use) => {
    await signIn(page, account);
    await use(page);
  },
  openAs: async ({ browser, baseURL, locale }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (user) => {
      const context = await browser.newContext({ baseURL, locale });
      contexts.push(context);
      await serveTestImages(context);
      const page = await context.newPage();
      await signIn(page, user);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect };
