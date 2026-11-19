/**
 * Scénario 4 — La fiche standard (hors 5E) : la créer, la voir, la modifier,
 * et l'enregistrer en brouillon.
 */
import { charactersOf } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import type { Page } from "@playwright/test";

async function openStandardForm(page: Page) {
  await page.goto("/characters/new");
  await page.getByRole("radio", { name: /Standard/ }).click();
  await page.getByRole("button", { name: "Créer la fiche" }).click();
  await expect(page.getByRole("textbox", { name: "Nom" })).toBeVisible();
}

test("créer, consulter puis modifier une fiche standard", async ({
  signedInPage: page,
  account,
}) => {
  await openStandardForm(page);

  await page.getByRole("button", { name: "Créer le personnage" }).click();
  await expect(page).toHaveURL(/\/characters\/new/);
  expect(await charactersOf(account.uid)).toHaveLength(0);

  await page.getByRole("textbox", { name: "Nom" }).fill("Inspecteur Legrasse");
  await page.getByRole("spinbutton", { name: "Points de vie max" }).fill("14");
  await page.getByRole("textbox", { name: "Notes" }).fill("Enquête sur un culte dans les bayous.");
  await page.getByRole("button", { name: "Ajouter un objet" }).click();
  const item = page.getByRole("dialog", { name: "Nouvel objet" });
  await item.getByPlaceholder("Corde de chanvre (15 m)").fill("Revolver");
  await item.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Revolver")).toBeVisible();

  await page.getByRole("button", { name: "Créer le personnage" }).click();
  await expect(page.getByText("Personnage créé.")).toBeVisible();
  await expect(page).toHaveURL(/\/characters$/);
  await expect(page.getByText("Standard", { exact: true })).toBeVisible();

  // La fiche.
  await page.getByRole("link", { name: /Inspecteur Legrasse/ }).click();
  await expect(page.getByRole("heading", { name: "Inspecteur Legrasse" })).toBeVisible();
  await expect(page.getByText("Personnage standard")).toBeVisible();
  await expect(page.getByText("14", { exact: true })).toBeVisible();
  await expect(page.getByText("Revolver")).toBeVisible();
  await expect(page.getByText("Enquête sur un culte dans les bayous.")).toBeVisible();

  // La modifier.
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page.getByRole("button", { name: "Enregistrer le brouillon" })).toHaveCount(0);
  await page.getByRole("spinbutton", { name: "Points de vie max" }).fill("9");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("Fiche mise à jour.")).toBeVisible();
  const [stored] = await charactersOf(account.uid);
  expect(stored).toMatchObject({
    system: "standard",
    name: "Inspecteur Legrasse",
    maxHitPoints: 9,
  });
});

test("enregistrer une fiche standard en brouillon puis la terminer", async ({
  signedInPage: page,
}) => {
  await openStandardForm(page);
  await page.getByRole("textbox", { name: "Nom" }).fill("Docteur Armitage");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByText("Brouillon enregistré.")).toBeVisible();

  await page.goto("/characters");
  await expect(page.getByText("Brouillon · Standard")).toBeVisible();
  await page.getByRole("link", { name: /Docteur Armitage/ }).click();
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveValue("Docteur Armitage");
  await page
    .getByRole("button", { name: /Créer le personnage|Enregistrer les modifications/ })
    .click();
  await expect(page.getByText("Personnage créé.")).toBeVisible();
  await page.goto("/characters");
  await expect(page.getByText("Brouillon · Standard")).toHaveCount(0);
  await expect(page.getByText("Standard", { exact: true })).toBeVisible();
});
