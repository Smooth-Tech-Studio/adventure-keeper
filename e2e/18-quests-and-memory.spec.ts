/**
 * Scénario 18 — Quêtes et mémoire de séance : le tableau de quêtes, ce que la
 * séance retient (date du monde, notes rapides, butin, citations), la
 * chronique lue comme un livre et exportée, l'attitude d'une faction.
 */
import { readFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";

import { adminDb, readDocAs } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { gmTab, joinSession, prepareTable, startSession, type Table } from "./support/table";

function section(page: Page, title: string): Locator {
  return page.locator('[data-slot="card"]').filter({
    has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
  });
}

/** A card of the campaign page, found by its title. */
function card(page: Page, title: string): Locator {
  return page.locator('[data-slot="card"]').filter({ has: page.getByText(title, { exact: true }) });
}

async function endSession(gmPage: Page, table: Table) {
  await gmPage.getByRole("button", { name: "En direct" }).click();
  await gmPage.getByRole("menuitem", { name: "Terminer la session" }).click();
  const confirm = gmPage.getByRole("dialog", { name: "Terminer la session ?" });
  await confirm.getByRole("button", { name: "Terminer la session" }).click();
  await expect(gmPage).toHaveURL(new RegExp(`${table.adventurePath}$`));
}

test("quêtes, mémoire de séance et chronique exportée", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  const campaignPath = `/campaigns/${table.campaignId}`;

  // Le MJ note une rumeur, encore cachée.
  await gmPage.goto(campaignPath);
  const quests = card(gmPage, "Quêtes");
  await quests.getByRole("button", { name: "Nouvelle quête" }).click();
  const form = gmPage.getByRole("dialog", { name: "Nouvelle quête" });
  await form.getByLabel("Titre").fill("Le dragon d'Ashmoor");
  await form.getByLabel("Ce que le groupe sait").fill("Un dragon dormirait sous la colline.");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(quests.getByText("Le dragon d'Ashmoor")).toBeVisible();
  await expect(quests.getByText("Cachée")).toBeVisible();

  const bobPage = await openAs(table.bob);
  await bobPage.goto(campaignPath);
  await expect(card(bobPage, "Quêtes").getByText("Aucune quête pour l'instant.")).toBeVisible();

  // En séance : la quête avance, la séance retient date, note, butin, citation.
  await startSession(gmPage, table);
  await joinSession(bobPage, table);
  await gmTab(gmPage, "Récit");
  const story = gmPage.locator("#gm-story");
  await story.getByRole("button", { name: "Révéler « Le dragon d'Ashmoor » aux joueurs" }).click();
  await story.getByRole("button", { name: "Le dragon d'Ashmoor", exact: true }).click();
  const quest = gmPage.getByRole("dialog", { name: "Le dragon d'Ashmoor" });
  await quest.getByRole("button", { name: "En cours" }).click();
  await quest.press("Escape");

  // La mémoire de séance, dans l'onglet Notes.
  await gmTab(gmPage, "Notes");

  await gmPage.getByLabel("Date dans le monde").fill("12 du mois des Brumes");
  await gmPage.getByLabel("Date dans le monde").press("Enter");
  await expect(bobPage.getByText("12 du mois des Brumes")).toBeVisible();
  await gmPage.getByLabel("Note rapide (pour le résumé)").fill("Thorin a promis de revenir");
  await gmPage.getByLabel("Note rapide (pour le résumé)").press("Enter");
  await gmPage.getByLabel("Butin").fill("Épée elfique");
  await gmPage.getByLabel("Quantité").fill("2");
  await gmPage.getByLabel("Où ?").fill("dans la crypte");
  await gmPage.getByLabel("Quantité").press("Enter");
  await expect(gmPage.getByText("Épée elfique ×2 (dans la crypte)")).toBeVisible();

  await bobPage.getByRole("button", { name: "Épingler une citation" }).click();
  const quote = bobPage.getByRole("dialog", { name: "Épingler une citation" });
  await quote.getByLabel("Citation").fill("On court !");
  await quote.getByLabel("Qui l'a dit (facultatif)").fill("Thorin");
  await quote.getByRole("button", { name: "Épingler" }).click();
  await expect(bobPage.getByText("Citation épinglée.")).toBeVisible();

  // Le résumé reprend la note rapide et le butin.
  await endSession(gmPage, table);
  await section(gmPage, "Chronique").getByRole("button", { name: "Écrire le résumé" }).click();
  const recap = gmPage.getByRole("dialog", { name: "Résumé de la séance 1" });
  await recap.getByRole("button", { name: "Ajouter au résumé" }).click();
  await recap.getByRole("button", { name: "Pré-remplir" }).click();
  const body = recap.getByLabel("Résumé", { exact: true });
  await expect(body).toHaveValue(/- Thorin a promis de revenir/);
  await expect(body).toHaveValue(/\*\*Butin :\*\* Épée elfique ×2 \(dans la crypte\)/);
  await expect(body).toHaveValue(/- Le dragon d'Ashmoor : révélée, acceptée/);
  await recap.getByRole("button", { name: "Publier" }).click();
  await expect(recap).toBeHidden();

  // La cloche du joueur annonce le résumé.
  await bobPage.goto(campaignPath);
  await bobPage.getByRole("button", { name: /^Notifications/ }).click();
  await expect(bobPage.getByText(/Nouveau résumé dans « L'entrée »/)).toBeVisible();
  await bobPage.keyboard.press("Escape");

  // Le joueur lit la chronique, puis le livre, et l'exporte.
  await bobPage.goto(table.adventurePath);
  const chronicle = section(bobPage, "Chronique");
  await expect(chronicle.getByText("12 du mois des Brumes")).toBeVisible();
  await expect(chronicle.getByText("On court !")).toBeVisible();
  await chronicle.getByRole("tab", { name: /^Carnet/ }).click();
  await expect(chronicle.getByText("Épée elfique ×2")).toBeVisible();
  await chronicle.getByRole("link", { name: "Lire d'une traite / exporter" }).click();
  await expect(bobPage.getByRole("heading", { name: "L'entrée", level: 1 })).toBeVisible();
  await expect(bobPage.getByRole("heading", { name: "Séance 1", level: 2 })).toBeVisible();
  // La frise, en tête du livre.
  const timeline = bobPage.getByRole("region", { name: "Frise" });
  await expect(timeline).toContainText("12 du mois des Brumes");
  await expect(timeline).toContainText("Le dragon d'Ashmoor : révélée, acceptée");
  await expect(timeline).toContainText("Épée elfique ×2 (dans la crypte)");
  const downloading = bobPage.waitForEvent("download");
  await bobPage.getByRole("button", { name: "Télécharger (.md)" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("L'entrée.md");
  const markdown = await readFile((await download.path())!, "utf8");
  expect(markdown).toContain("## Séance 1");
  expect(markdown).toContain("> « On court ! » — Thorin");

  // La quête est en cours pour le joueur.
  await bobPage.goto(campaignPath);
  const bobQuests = card(bobPage, "Quêtes");
  await expect(
    bobQuests
      .getByRole("listitem")
      .filter({ hasText: "Le dragon d'Ashmoor" })
      .getByRole("img", { name: "En cours" }),
  ).toBeVisible();
  await expect(bobQuests).toContainText(
    "Révélée en séance 1 (L'entrée) · Acceptée en séance 1 (L'entrée)",
  );
  // Le résumé est lu : la cloche ne l'annonce plus.
  await bobPage.getByRole("button", { name: /^Notifications/ }).click();
  await expect(bobPage.getByText(/Nouveau résumé dans/)).toHaveCount(0);
  await bobPage.keyboard.press("Escape");

  // Le livre de toute la campagne.
  await card(bobPage, "Aventures").getByRole("link", { name: "Livre de la campagne" }).click();
  await expect(bobPage.getByRole("heading", { name: "La Crypte", level: 1 })).toBeVisible();
  await expect(bobPage.getByRole("heading", { name: "L'entrée", level: 2 })).toBeVisible();
  await expect(bobPage.getByRole("heading", { name: "Séance 1", level: 3 })).toBeVisible();
  const downloadingBook = bobPage.waitForEvent("download");
  await bobPage.getByRole("button", { name: "Télécharger (.md)" }).click();
  const book = await readFile((await (await downloadingBook).path())!, "utf8");
  expect(book).toContain("# La Crypte");
  expect(book).toContain("### Séance 1");

  // L'attitude d'une faction, réglée par le MJ, lue par le joueur.
  await gmPage.goto(`${campaignPath}/codex`);
  await gmPage.getByRole("button", { name: "Nouvelle fiche" }).click();
  const entry = gmPage.getByRole("dialog", { name: "Nouvelle fiche" });
  await entry.getByLabel("Nom").fill("La Main noire");
  await entry.getByRole("combobox", { name: "Type" }).click();
  await gmPage.getByRole("option", { name: "Faction", exact: true }).click();
  await entry.getByRole("button", { name: "Enregistrer" }).click();
  const opened = gmPage.getByRole("dialog", { name: "La Main noire" });
  await opened.getByRole("combobox", { name: "Attitude envers le groupe" }).click();
  await gmPage.getByRole("option", { name: "Hostile" }).click();
  await opened.press("Escape");
  await gmPage.getByRole("button", { name: "Révéler « La Main noire »" }).click();

  await bobPage.goto(`${campaignPath}/codex`);
  await expect(bobPage.getByText("Hostile")).toBeVisible();
});

test("un joueur écrit ses propres quêtes, personnelles ou partagées", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);
  const carolPage = await openAs(table.carol);
  await joinSession(carolPage, table);

  // Depuis l'onglet « Quêtes et notes », Bob (Thorin) écrit un but personnel.
  await bobPage.getByRole("tab", { name: "Quêtes et notes" }).click();
  const bobQuests = bobPage.locator("#session-quests");
  await bobQuests.getByRole("button", { name: "Nouvelle quête" }).click();
  let dialog = bobPage.getByRole("dialog", { name: "Nouvelle quête" });
  await dialog.getByRole("textbox", { name: "Titre" }).fill("Venger mon frère");
  await dialog.getByRole("textbox", { name: "Ce que le groupe sait" }).fill("Un orc borgne.");
  await expect(dialog.getByRole("checkbox", { name: "Partager avec le groupe" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();
  const mine = bobQuests.getByRole("listitem").filter({ hasText: "Venger mon frère" });
  await expect(mine).toContainText("Personnelle");
  await expect(mine).toContainText("En cours");

  // Personnelle : le MJ la voit, signée ; Carol non — même en lisant le document.
  const quest = (await adminDb.collection(`campaigns/${table.campaignId}/quests`).get()).docs.find(
    (d) => d.data().title === "Venger mon frère",
  )!;
  expect(quest.data()).toMatchObject({ ownerUid: table.bob.uid, ownerName: "Thorin" });
  const questPath = `campaigns/${table.campaignId}/quests/${quest.id}`;
  expect((await readDocAs(table.carol, questPath)).status).toBe(403);
  await carolPage.getByRole("tab", { name: "Quêtes et notes" }).click();
  const carolQuests = carolPage.locator("#session-quests");
  await expect(carolQuests).toBeVisible();
  await expect(carolQuests.getByText("Venger mon frère")).toHaveCount(0);
  const gmCampaign = await openAs(account);
  await gmCampaign.goto(`/campaigns/${table.campaignId}`);
  const board = card(gmCampaign, "Quêtes").getByRole("listitem").filter({ hasText: "Venger" });
  await expect(board).toContainText("Quête de Thorin");
  await expect(board).toContainText("Personnelle");

  // Partagée : tout le groupe la voit. Carol ne peut pas la modifier.
  await mine.getByRole("button", { name: "Modifier « Venger mon frère »" }).click();
  dialog = bobPage.getByRole("dialog", { name: "Modifier la quête" });
  await dialog.getByRole("checkbox", { name: "Partager avec le groupe" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(mine).toContainText("Partagée");
  const shared = carolQuests.getByRole("listitem").filter({ hasText: "Venger mon frère" });
  await expect(shared).toContainText("Quête de Thorin");
  await expect(shared.getByRole("button", { name: /Modifier/ })).toHaveCount(0);

  // Bob la supprime : elle disparaît chez Carol.
  await mine.getByRole("button", { name: "Supprimer « Venger mon frère »" }).click();
  await bobPage
    .getByRole("dialog", { name: /Supprimer « Venger mon frère »/ })
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(shared).toHaveCount(0);
});
