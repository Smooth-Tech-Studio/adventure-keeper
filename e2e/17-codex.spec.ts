/**
 * Scénario 17 — Le codex : le MJ écrit des fiches (avec leurs secrets), en
 * révèle une en séance, montre un document à la table ; un lieu montré entre
 * de lui-même au codex ; les mentions [[Nom]] d'un résumé mènent aux fiches
 * connues des joueurs.
 */
import type { Locator, Page } from "@playwright/test";

import { TEST_IMAGE_ORIGIN } from "./support/data";
import { expect, test } from "./support/fixtures";
import {
  gmTab,
  joinSession,
  prepareTable,
  showLocation,
  startSession,
  type Table,
} from "./support/table";

function section(page: Page, title: string): Locator {
  return page.locator('[data-slot="card"]').filter({
    has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
  });
}

async function newEntry(
  page: Page,
  values: { name: string; kind?: string; summary: string; secret?: string; imageUrl?: string },
) {
  await page.getByRole("button", { name: "Nouvelle fiche" }).click();
  const form = page.getByRole("dialog", { name: "Nouvelle fiche" });
  await form.getByLabel("Nom").fill(values.name);
  if (values.kind) {
    await form.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: values.kind, exact: true }).click();
  }
  await form.getByLabel("Ce que les joueurs savent").fill(values.summary);
  if (values.imageUrl) await form.getByLabel("Image (lien)").fill(values.imageUrl);
  if (values.secret) await form.getByLabel("Secret du MJ").fill(values.secret);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  // The new entry opens.
  const entry = page.getByRole("dialog", { name: values.name });
  await expect(entry).toBeVisible();
  await entry.press("Escape");
  await expect(entry).toBeHidden();
}

async function endSession(gmPage: Page, table: Table) {
  await gmPage.getByRole("button", { name: "En direct" }).click();
  await gmPage.getByRole("menuitem", { name: "Terminer la session" }).click();
  const confirm = gmPage.getByRole("dialog", { name: "Terminer la session ?" });
  await confirm.getByRole("button", { name: "Terminer la session" }).click();
  await expect(gmPage).toHaveURL(new RegExp(`${table.adventurePath}$`));
}

test("fiches, révélations, document montré et mentions", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  const codexPath = `/campaigns/${table.campaignId}/codex`;

  // Le MJ prépare deux fiches, cachées.
  await gmPage.goto(`/campaigns/${table.campaignId}`);
  await gmPage.getByRole("link", { name: "Tout voir" }).click();
  await expect(gmPage).toHaveURL(new RegExp(`${codexPath}$`));
  await newEntry(gmPage, {
    name: "Garrick",
    summary: "Le forgeron du village.",
    secret: "Il travaille pour la Main noire.",
  });
  await newEntry(gmPage, {
    name: "La lettre scellée",
    kind: "Document",
    summary: "Une lettre au sceau brisé.",
    imageUrl: `${TEST_IMAGE_ORIGIN}/lettre.svg`,
  });
  await expect(gmPage.getByText("Cachée")).toHaveCount(2);

  const bobPage = await openAs(table.bob);
  await bobPage.goto(codexPath);
  await expect(bobPage.getByText("Rien d'appris pour l'instant.")).toBeVisible();

  // En séance : un lieu montré, une fiche révélée, un document montré.
  await startSession(gmPage, table);
  await joinSession(bobPage, table);
  await showLocation(gmPage, "Le portail");
  // Une seule action « Révéler » dans l'onglet Récit, pour les fiches aussi.
  await gmTab(gmPage, "Récit");
  const story = gmPage.locator("#gm-story");
  await story.getByRole("button", { name: "Révéler « Garrick » aux joueurs" }).click();
  await expect(story.getByRole("button", { name: "Cacher « Garrick » à nouveau" })).toBeVisible();
  // La fiche ouverte : le secret reste au MJ, le document part à l'écran.
  await story.getByRole("button", { name: "Garrick", exact: true }).click();
  const garrick = gmPage.getByRole("dialog", { name: "Garrick" });
  await expect(garrick.getByText("Il travaille pour la Main noire.")).toBeVisible();
  await garrick.press("Escape");
  await story.getByRole("button", { name: "La lettre scellée", exact: true }).click();
  const letter = gmPage.getByRole("dialog", { name: "La lettre scellée" });
  await letter.getByRole("button", { name: "Montrer à l'écran" }).click();
  await expect(letter.getByRole("button", { name: "Retirer de l'écran" })).toBeVisible();
  await letter.press("Escape");
  await gmTab(gmPage, "Scène");
  await expect(gmPage.getByText("À l'écran : La lettre scellée")).toBeVisible();

  const handout = bobPage.getByRole("dialog", { name: "La lettre scellée" });
  await expect(handout.getByRole("img", { name: "La lettre scellée" })).toBeVisible();
  await handout.getByRole("button", { name: "Fermer" }).last().click();
  await expect(handout).toBeHidden();
  await gmPage.locator("#gm-scene-document").getByRole("button", { name: "Retirer" }).click();
  await expect(gmPage.getByText("À l'écran : La lettre scellée")).toHaveCount(0);

  // Le résumé mentionne une fiche connue et une qui ne l'est pas.
  await endSession(gmPage, table);
  const chronicle = section(gmPage, "Chronique");
  await chronicle.getByRole("button", { name: "Écrire le résumé" }).click();
  const recap = gmPage.getByRole("dialog", { name: "Résumé de la séance 1" });
  await recap
    .getByLabel("Résumé", { exact: true })
    .fill("Nous avons rencontré [[Garrick]]. Le [[Roi-Liche]] nous observe.");
  await recap.getByRole("button", { name: "Publier" }).click();
  await expect(recap).toBeHidden();

  await bobPage.goto(table.adventurePath);
  const bobChronicle = section(bobPage, "Chronique");
  await expect(bobChronicle.getByText("Roi-Liche")).toBeVisible();
  await expect(bobChronicle.getByRole("link", { name: "Roi-Liche" })).toHaveCount(0);

  // Le document remis s'ouvre sur place, sans quitter l'aventure.
  await bobChronicle.getByRole("tab", { name: /^Carnet/ }).click();
  await bobChronicle.getByRole("button", { name: "La lettre scellée" }).click();
  const sentLetter = bobPage.getByRole("dialog", { name: "La lettre scellée" });
  await expect(sentLetter.getByRole("img", { name: "La lettre scellée" })).toBeVisible();
  // Montrée pendant que le portail était à l'écran : c'est là qu'elle a été trouvée.
  await expect(sentLetter.getByText("Trouvé : Le portail")).toBeVisible();
  await expect(sentLetter.getByRole("link", { name: "Voir dans le codex" })).toBeVisible();
  await expect(bobPage).toHaveURL(new RegExp(`${table.adventurePath}$`));
  await sentLetter.getByRole("button", { name: "Fermer" }).last().click();
  await expect(sentLetter).toBeHidden();
  await bobChronicle.getByRole("tab", { name: /^Récit/ }).click();
  await bobChronicle.getByRole("link", { name: "Garrick" }).click();

  // La fiche : ce que le groupe sait, pas le secret, et où elle apparaît.
  const entry = bobPage.getByRole("dialog", { name: "Garrick" });
  await expect(entry.getByText("Le forgeron du village.")).toBeVisible();
  await expect(entry.getByText("Il travaille pour la Main noire.")).toHaveCount(0);
  await expect(entry.getByRole("link", { name: "Séance 1 · L'entrée" })).toBeVisible();
  await entry.press("Escape");

  // Le codex du joueur : ce qu'il a appris, rien de plus.
  await expect(bobPage.getByRole("button", { name: "Garrick" })).toBeVisible();
  await expect(bobPage.getByRole("button", { name: "La lettre scellée" })).toBeVisible();
  await expect(bobPage.getByRole("button", { name: "Le portail" })).toBeVisible();
  await expect(bobPage.getByRole("button", { name: "Nouvelle fiche" })).toHaveCount(0);
  await expect(bobPage.getByText("Cachée")).toHaveCount(0);
});
