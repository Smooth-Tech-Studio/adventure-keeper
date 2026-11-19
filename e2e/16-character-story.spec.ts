/**
 * Scénario 16 — L'histoire d'un personnage : sa personnalité, les chapitres de
 * son passé (pour lui, pour le MJ, pour le groupe), son journal écrit depuis la
 * chronique — que le MJ peut masquer — et ce que le MJ en voit en séance.
 */
import { FieldValue } from "firebase-admin/firestore";
import type { Locator, Page } from "@playwright/test";

import { adminDb, charactersOf } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { prepareTable, startSession, type Table } from "./support/table";

/** A sub-tab of the sheet's « Histoire »: chapters or journal. */
function storyTab(page: Page, title: string): Locator {
  return page.getByRole("tabpanel", { name: new RegExp(`^${title}`) });
}

function section(page: Page, title: string): Locator {
  return page.locator('[data-slot="card"]').filter({
    has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
  });
}

/** A first session already played, its recap published. */
async function playedSession(table: Table) {
  const ref = adminDb
    .collection(`campaigns/${table.campaignId}/adventures/${table.adventureId}/liveSessions`)
    .doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    campaignId: table.campaignId,
    adventureId: table.adventureId,
    status: "ended",
    startedBy: table.gm.uid,
    startedAt: now,
    endedAt: now,
    number: 1,
    recap: "Le groupe a franchi le portail.",
    recapPublishedAt: now,
    attendeeUids: [table.gm.uid, table.bob.uid, table.carol.uid],
    connectedUids: [],
    createdAt: now,
    updatedAt: now,
  });
}

async function addChapter(
  page: Page,
  title: string,
  body: string,
  visibility?: string,
  imageUrl?: string,
) {
  const chapters = storyTab(page, "Chapitres");
  await chapters.getByRole("button", { name: "Ajouter un chapitre" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau chapitre" });
  await dialog.getByLabel("Titre", { exact: true }).fill(title);
  await dialog.getByLabel("Texte").fill(body);
  if (imageUrl) await dialog.getByLabel("Illustration (lien, facultatif)").fill(imageUrl);
  if (visibility) {
    await dialog.getByRole("combobox", { name: "Qui peut lire" }).click();
    await page.getByRole("option", { name: visibility }).click();
  }
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();
  await expect(chapters.getByRole("heading", { name: title })).toBeVisible();
}

test("personnalité, chapitres partagés et journal dans la chronique", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await playedSession(table);
  const thorin = (await charactersOf(table.bob.uid))[0]!;

  // Bob décrit Thorin : sa personnalité, puis trois chapitres.
  const bobPage = await openAs(table.bob);
  await bobPage.goto(`/characters/${thorin.id}`);
  // Personnalité, chapitres et journal vivent dans l'onglet « Histoire » de la fiche.
  await bobPage.getByRole("tab", { name: "Histoire" }).click();
  const personality = section(bobPage, "Personnalité");
  await personality.getByRole("button", { name: "Modifier la personnalité", exact: true }).click();
  await personality.getByLabel("Défauts").fill("Je ne résiste jamais à un pari.");
  await personality.getByRole("button", { name: "Enregistrer" }).click();
  await expect(personality.getByText("Je ne résiste jamais à un pari.")).toBeVisible();

  // Les chapitres ont leur sous-onglet.
  await bobPage.getByRole("tab", { name: /^Chapitres/ }).click();
  await addChapter(bobPage, "La trahison", "Mon frère m'a vendu aux orcs.", "Moi et le MJ");
  await addChapter(
    bobPage,
    "L'enfance",
    "Une forge, des étincelles.",
    "Tout le groupe",
    new URL("/favicon.svg", bobPage.url()).href,
  );
  await addChapter(bobPage, "Mon secret", "Je cherche encore mon frère.");
  const chapters = storyTab(bobPage, "Chapitres");
  await expect(chapters.getByText("MJ · La Crypte")).toBeVisible();
  await expect(chapters.getByText("Groupe · La Crypte")).toBeVisible();
  await expect(chapters.getByRole("img", { name: "L'enfance" })).toBeVisible();

  // Après la séance, Bob écrit le journal de Thorin depuis la chronique.
  await bobPage.goto(table.adventurePath);
  const chronicle = section(bobPage, "Chronique");
  await chronicle.getByRole("tab", { name: /^Journaux/ }).click();
  await chronicle.getByRole("button", { name: "Écrire le journal de Thorin" }).click();
  const dialog = bobPage.getByRole("dialog", { name: "Journal de Thorin — séance 1" });
  await dialog.getByLabel("Texte").fill("Le portail chantait. Je n'ai rien dit aux autres.");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(chronicle.getByText("Journal de Thorin", { exact: true })).toBeVisible();
  await expect(
    chronicle.getByRole("button", { name: "Modifier le journal de Thorin" }),
  ).toBeVisible();

  // Carol le lit dans la chronique.
  const carolPage = await openAs(table.carol);
  await carolPage.goto(table.adventurePath);
  await section(carolPage, "Chronique")
    .getByRole("tab", { name: /^Journaux/ })
    .click();
  await expect(section(carolPage, "Chronique").getByText("Le portail chantait.")).toBeVisible();

  // Le MJ le masque : il quitte la chronique, pas le journal de Thorin.
  await gmPage.goto(table.adventurePath);
  const gmChronicle = section(gmPage, "Chronique");
  await gmChronicle.getByRole("tab", { name: /^Journaux/ }).click();
  await gmChronicle.getByRole("button", { name: "Masquer" }).click();
  await expect(gmChronicle.getByText("Masqué", { exact: true })).toBeVisible();
  await carolPage.reload();
  await expect(
    section(carolPage, "Chronique").getByText("Le groupe a franchi le portail."),
  ).toBeVisible();
  await expect(carolPage.getByText("Le portail chantait.")).toHaveCount(0);

  await bobPage.goto(`/characters/${thorin.id}`);
  await bobPage.getByRole("tab", { name: "Histoire" }).click();
  await bobPage.getByRole("tab", { name: /^Journal/ }).click();
  // One box per adventure, its title on top; the tab counts the adventures.
  await expect(bobPage.getByRole("tab", { name: /^Journal\s*1$/ })).toBeVisible();
  const journal = storyTab(bobPage, "Journal");
  await expect(journal.getByRole("heading", { name: "L'entrée" })).toBeVisible();
  await expect(journal.getByText("Le portail chantait.")).toBeVisible();
  await expect(journal.getByText(/^Séance 1 — /)).toBeVisible();
  // Its title hides the adventure's entries.
  await journal.getByRole("button", { name: "L'entrée" }).click();
  await expect(journal.getByText("Le portail chantait.")).toBeHidden();

  // En séance, le MJ voit ce que Thorin lui a confié, pas son secret.
  await startSession(gmPage, table);
  await gmPage
    .getByRole("dialog", { name: "Précédemment…" })
    .getByRole("button", { name: "C'est parti !" })
    .click();
  await gmPage.getByRole("button", { name: /Thorin 13\/13/ }).click();
  const sheet = gmPage.getByRole("dialog");
  const story = sheet.getByRole("region", { name: "Histoire et journal" });
  await expect(story.getByText("Je ne résiste jamais à un pari.")).toBeVisible();
  await expect(story.getByRole("heading", { name: "La trahison" })).toBeVisible();
  await expect(story.getByRole("heading", { name: "L'enfance" })).toBeVisible();
  await expect(story.getByText("Mon secret")).toHaveCount(0);
});
