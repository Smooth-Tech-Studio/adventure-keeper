/**
 * Scénario 8 — La liste des personnages : vide, puis remplie, avec ses accès
 * à la fiche, à la modification et à la suppression.
 */
import { createDndCharacter } from "./support/data";
import { charactersOf } from "./support/emulator";
import { expect, test } from "./support/fixtures";

test("liste vide, puis fiches avec leurs actions", async ({ signedInPage: page, account }) => {
  await page.goto("/characters");
  await expect(page.getByText("Aucun personnage pour l'instant")).toBeVisible();
  await page.getByRole("link", { name: "Créer un personnage" }).click();
  await expect(page).toHaveURL(/\/characters\/new$/);

  await createDndCharacter(account, "Thorin");
  await createDndCharacter(account, "Mira");
  await page.goto("/characters");
  await expect(page.getByRole("link", { name: "Nouveau personnage" })).toBeVisible();
  await expect(page.getByText("Nain · Guerrier · niv. 1")).toHaveCount(2);

  // La fiche, et la modification.
  await page.getByRole("link", { name: /Thorin/ }).click();
  await expect(page).toHaveURL(/\/characters\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /Thorin/ }).first()).toBeVisible();
  await page.goBack();
  const thorinCard = page.locator('[data-slot="card"]').filter({ hasText: "Thorin" });
  await thorinCard.getByRole("link", { name: "Modifier" }).click();
  await expect(page).toHaveURL(/\/characters\/[^/]+\/edit$/);
  await page.goBack();

  // La suppression demande confirmation.
  const miraCard = page.locator('[data-slot="card"]').filter({ hasText: "Mira" });
  await miraCard.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("dialog", { name: "Supprimer « Mira » ?" });
  await expect(dialog.getByText(/Cette fiche sera définitivement perdue/)).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(miraCard).toBeVisible();

  await miraCard.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Personnage supprimé.")).toBeVisible();
  await expect(miraCard).toHaveCount(0);
  expect((await charactersOf(account.uid)).map((c) => (c as { name?: string }).name)).toEqual([
    "Thorin",
  ]);
});
