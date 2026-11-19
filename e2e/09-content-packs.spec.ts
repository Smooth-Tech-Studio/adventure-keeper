/**
 * Scénario 9 — Les packs de contenu : importer un fichier (valide ou non), le
 * remplacer, le consulter, l'exporter, le partager par e-mail et par lien,
 * le retirer et le supprimer.
 */
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

import { EXAMPLE_PACK } from "./support/data";
import { createTestUser } from "./support/emulator";
import { expect, test } from "./support/fixtures";

/** Picks a file through « Importer un pack » (or « Remplacer »), as a player would. */
async function pickFile(page: Page, button: string, name: string, content: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: button }).first().click(),
  ]);
  await chooser.setFiles({ name, mimeType: "application/json", buffer: Buffer.from(content) });
}

const examplePack = () => readFileSync(EXAMPLE_PACK, "utf8");

function packRow(page: Page, name: string) {
  return page.locator("li, [data-slot=card]").filter({ hasText: name }).last();
}

test("importer, consulter, exporter, remplacer et supprimer un pack", async ({
  signedInPage: page,
}) => {
  await page.goto("/packs");
  await expect(page.getByRole("heading", { name: "Packs de contenu" })).toBeVisible();

  // Un fichier invalide est refusé, avec ses erreurs.
  await pickFile(page, "Importer un pack", "faux.json", '{"format":"autre-chose"}');
  const errors = page.getByRole("alert").filter({ hasText: "Ce fichier n'a pas pu être importé" });
  await expect(errors).toBeVisible();
  await errors.getByRole("button", { name: "Fermer" }).click();
  await expect(errors).toBeHidden();

  await pickFile(page, "Importer un pack", "brumes-du-nord.json", examplePack());
  await expect(page.getByText("Pack importé.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Les Brumes du Nord" })).toBeVisible();

  // Son contenu.
  await page.getByRole("link", { name: "Les Brumes du Nord" }).click();
  await expect(page.getByText("brumes-du-nord · v1.0.0")).toBeVisible();
  for (const entry of [
    "Veilleur des brumes",
    "Sylvain des brumes",
    "Passeur",
    "Loup des brumes",
    "Voile de brume",
  ]) {
    await expect(page.getByText(entry).first()).toBeVisible();
  }
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/brumes-du-nord.*\.json$/);
  await page.getByRole("link", { name: "Voir mes packs" }).click();

  // Le réimporter propose de le remplacer.
  const newer = examplePack().replace('"version": "1.0.0"', '"version": "1.1.0"');
  await pickFile(page, "Importer un pack", "brumes-du-nord.json", newer);
  const replace = page.getByRole("dialog", { name: "Remplacer le pack existant ?" });
  await replace.getByRole("button", { name: "Remplacer" }).click();
  await expect(page.getByText("Pack remplacé.")).toBeVisible();
  await page.getByRole("link", { name: "Les Brumes du Nord" }).click();
  await expect(page.getByText("brumes-du-nord · v1.1.0")).toBeVisible();
  await page.goBack();

  await page.getByRole("button", { name: "Supprimer Les Brumes du Nord" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Supprimer/ })
    .click();
  await expect(page.getByText("Pack supprimé.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Les Brumes du Nord" })).toHaveCount(0);
});

test("partager un pack par e-mail, puis par lien", async ({ signedInPage: page, openAs }) => {
  const bob = await createTestUser("Bob");
  const carol = await createTestUser("Carol");
  await page.goto("/packs");
  await pickFile(page, "Importer un pack", "brumes-du-nord.json", examplePack());
  await expect(page.getByText("Pack importé.")).toBeVisible();

  // Par e-mail, à Bob.
  await packRow(page, "Les Brumes du Nord").getByRole("button", { name: "Partager" }).click();
  const share = page.getByRole("dialog", { name: "Partager « Les Brumes du Nord »" });
  await share.getByPlaceholder("joueur@exemple.com").fill(bob.email);
  await share.getByRole("button", { name: "Partager" }).click();
  await expect(page.getByText("Pack partagé avec Bob.")).toBeVisible();

  const bobPage = await openAs(bob);
  await bobPage.goto("/packs");
  const bobRow = packRow(bobPage, "Les Brumes du Nord");
  await expect(bobRow).toContainText("partagé par Testeur");
  await bobRow.getByRole("button", { name: "Retirer" }).click();
  await bobPage.getByRole("dialog").getByRole("button", { name: "Retirer" }).click();
  await expect(bobPage.getByText("Pack retiré de votre bibliothèque.")).toBeVisible();
  await expect(bobPage.getByRole("link", { name: "Les Brumes du Nord" })).toHaveCount(0);

  // Par lien, à Carol.
  // Saved first, then ticked: a click, not `check()`.
  const linkSharing = share.getByRole("checkbox", { name: "Partager par lien" });
  await linkSharing.click();
  await expect(linkSharing).toBeChecked();
  const link = share.getByRole("textbox", { name: "Lien de partage" });
  await expect(link).toHaveValue(/\/packs\/shared\/.+/);
  const sharedPath = new URL(await link.inputValue()).pathname;

  const carolPage = await openAs(carol);
  await carolPage.goto(sharedPath);
  await carolPage.getByRole("button", { name: "Ajouter à ma bibliothèque" }).click();
  await expect(
    carolPage.getByText("« Les Brumes du Nord » est dans votre bibliothèque."),
  ).toBeVisible();
  await expect(carolPage).toHaveURL(/\/packs$/);
  await expect(packRow(carolPage, "Les Brumes du Nord")).toContainText("partagé par Testeur");
});

test("le guide du format pour créer un pack", async ({ signedInPage: page }) => {
  await page.goto("/packs");
  await page.getByRole("link", { name: "Créer un pack" }).click();
  await expect(page).toHaveURL(/\/packs\/format$/);
  await expect(page.getByRole("heading", { name: "Créer un pack", level: 1 })).toBeVisible();
});
