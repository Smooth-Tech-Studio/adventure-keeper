/**
 * Scénario 7 — La montée de niveau guidée : l'XP débloque le niveau suivant,
 * les points de vie se choisissent, la sous-classe arrive au niveau 3.
 */
import type { Page } from "@playwright/test";

import { createDndCharacter } from "./support/data";
import { adminDb } from "./support/emulator";
import { expect, test } from "./support/fixtures";

async function addXp(page: Page, amount: number) {
  await page.getByRole("button", { name: "Ajouter de l'XP" }).click();
  await page.getByRole("spinbutton", { name: "Ajouter de l'XP" }).fill(String(amount));
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
}

const next = (page: Page) => page.getByRole("button", { name: /^Suivant/ });

test("du niveau 1 au niveau 3, sous-classe comprise", async ({ signedInPage: page, account }) => {
  const id = await createDndCharacter(account, "Thorin");
  await page.goto(`/characters/${id}`);
  // The level-up sits right of the XP bar, even before the XP is reached.
  await expect(page.getByRole("button", { name: "Passer au niveau 2" })).toBeVisible();

  // 300 XP : le niveau 2 est atteint.
  await addXp(page, 300);
  await expect(page.getByText("300 / 300 XP")).toBeVisible();
  await page.getByRole("button", { name: "Passer au niveau 2" }).click();
  await expect(page.getByRole("heading", { name: "Au niveau 2, Thorin gagne…" })).toBeVisible();
  // Le dé n'est pas encore choisi : de 1 à 10, avec CON +2 et Ténacité naine +1.
  await expect(page.getByRole("main")).toContainText(/13\s*→\s*17–26\s*PV max/);
  await next(page).click();
  await expect(
    page.getByRole("heading", { name: "Combien de points de vie gagnez-vous au niveau 2 ?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Moyenne/ }).click();
  await next(page).click();
  await expect(page.getByRole("heading", { name: "Votre personnage au niveau 2" })).toBeVisible();
  await expect(page.getByRole("row", { name: "PV max 13 22" })).toBeVisible();
  await page.getByRole("button", { name: "Valider le niveau 2" }).click();

  await expect(page).toHaveURL(new RegExp(`/characters/${id}$`));
  await expect(page.getByText("Nain · Guerrier · niv. 2 · Soldat · Loyal Bon")).toBeVisible();
  await expect(page.getByText("300 / 900 XP")).toBeVisible();

  // 900 XP : le niveau 3 apporte la sous-classe, à choisir.
  await addXp(page, 600);
  await page.getByRole("button", { name: "Passer au niveau 3" }).click();
  await expect(page.getByText("Archétype martial").first()).toBeVisible();
  await next(page).click();
  // Un jet fait à la table, saisi à la main.
  await page.getByRole("spinbutton", { name: "Jet du dé de vie, niveau 3" }).fill("9");
  // The choice is final: confirmed, it locks the other two.
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await next(page).click();
  await expect(
    page.getByRole("heading", { name: "Archétype martial : à vous de choisir" }),
  ).toBeVisible();
  await next(page).click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "choisissez un élément (0 sur 1)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Champion/ }).click();
  await next(page).click();
  await page.getByRole("button", { name: "Valider le niveau 3" }).click();

  await expect(page.getByText("Nain · Guerrier · niv. 3 · Soldat · Loyal Bon")).toBeVisible();
  const sheet = (await adminDb.doc(`characters/${id}`).get()).data()!;
  // 22 + jet de 9 + 2 (Constitution) + 1 (Ténacité naine)
  expect(sheet).toMatchObject({ level: 3, maxHitPoints: 34 });
});

test("quitter la montée de niveau sans enregistrer", async ({ signedInPage: page, account }) => {
  const id = await createDndCharacter(account, "Thorin");
  await page.goto(`/characters/${id}`);
  await addXp(page, 300);
  await page.getByRole("button", { name: "Passer au niveau 2" }).click();
  await page.getByRole("button", { name: "Quitter sans enregistrer" }).click();
  await expect(page).toHaveURL(new RegExp(`/characters/${id}$`));
  await expect(page.getByText("Nain · Guerrier · niv. 1 · Soldat · Loyal Bon")).toBeVisible();
  expect((await adminDb.doc(`characters/${id}`).get()).data()).toMatchObject({ level: 1 });
});

test("un magicien prépare un sort de plus au niveau 2", async ({ signedInPage: page, account }) => {
  const id = await createDndCharacter(account, "Elminster", { preset: "wizard" });
  await page.goto(`/characters/${id}`);
  await addXp(page, 300);
  await page.getByRole("button", { name: "Passer au niveau 2" }).click();
  await expect(page.getByRole("main")).toContainText("Sorts préparés");
  await next(page).click();
  await page.getByRole("button", { name: /^Moyenne/ }).click();
  await next(page).click();
  await expect(
    page.getByRole("heading", { name: "Quels sorts préparez-vous désormais ?" }),
  ).toBeVisible();
  await expect(page.getByText("Votre main · 4 / 5")).toBeVisible();
  // Sans le cinquième sort, l'écran ne se valide pas.
  await next(page).click();
  await expect(page.getByText("Votre main · 4 / 5")).toBeVisible();
  await page
    .getByRole("button", { name: /Détection de la magie/ })
    .first()
    .click();
  await expect(page.getByText("Votre main · 5 / 5")).toBeVisible();
  await next(page).click();
  await page.getByRole("button", { name: "Valider le niveau 2" }).click();

  await expect(page.getByText("Nain · Magicien · niv. 2 · Criminel · Loyal Bon")).toBeVisible();
  const sheet = (await adminDb.doc(`characters/${id}`).get()).data()!;
  expect(sheet.spells).toContain("detect-magic");
  expect(sheet.spells).toHaveLength(5);
});

test("un druide choisit ses formes sauvages au niveau 2", async ({
  signedInPage: page,
  account,
}) => {
  const id = await createDndCharacter(account, "Sylve", { preset: "druid" });
  await page.goto(`/characters/${id}`);
  await addXp(page, 300);
  await page.getByRole("button", { name: "Passer au niveau 2" }).click();
  await next(page).click();
  await page.getByRole("button", { name: /^Moyenne/ }).click();
  await next(page).click();

  // Quatre bêtes de FP 1/4 au plus, sans vol.
  await expect(
    page.getByRole("heading", { name: "En quelles bêtes pouvez-vous vous changer ?" }),
  ).toBeVisible();
  const forms = page.locator("#wild-shape-forms");
  await expect(forms.getByText("Chouette", { exact: true })).toHaveCount(0);
  await forms.getByText("Loup", { exact: true }).click();
  await forms.getByText("Chat", { exact: true }).click();
  await expect(forms).toContainText("2 / 4");
  // Pas assez de formes : l'écran ne se valide pas.
  await next(page).click();
  await expect(page.getByText("Formes sauvages : 2 sur 4.").first()).toBeVisible();
  const boxes = forms.getByRole("checkbox", { checked: false });
  await boxes.first().click();
  await boxes.first().click();
  await expect(forms).toContainText("4 / 4");
  await expect(forms.getByRole("checkbox", { checked: false }).first()).toBeDisabled();
  await next(page).click();

  // Un sort préparé de plus, puis le niveau.
  await page
    .getByRole("button", { name: /Détection de la magie/ })
    .first()
    .click();
  await next(page).click();
  await page.getByRole("button", { name: "Valider le niveau 2" }).click();
  await expect(page.getByText(/Druide · niv\. 2/)).toBeVisible();
  const sheet = (await adminDb.doc(`characters/${id}`).get()).data()!;
  expect(sheet.wildShapeForms).toHaveLength(4);
  expect(sheet.wildShapeForms).toEqual(expect.arrayContaining(["wolf", "cat"]));
});
