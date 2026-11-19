/**
 * Scénario 15 — La chronique : le MJ prévoit un événement, le révèle en
 * séance, écrit le résumé (brouillon puis publication) ; le joueur le lit
 * entre deux séances, puis le retrouve en « Précédemment… ».
 */
import type { Locator, Page } from "@playwright/test";

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

async function endSession(gmPage: Page, table: Table) {
  await gmPage.getByRole("button", { name: "En direct" }).click();
  await gmPage.getByRole("menuitem", { name: "Terminer la session" }).click();
  const confirm = gmPage.getByRole("dialog", { name: "Terminer la session ?" });
  await confirm.getByRole("button", { name: "Terminer la session" }).click();
  await expect(gmPage).toHaveURL(new RegExp(`${table.adventurePath}$`));
}

test("du temps fort révélé en séance au résumé publié", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);

  // Le MJ prévoit un événement sur la page de l'aventure.
  await gmPage.goto(table.adventurePath);
  const events = section(gmPage, "Événements");
  await events.getByRole("button", { name: "Ajouter un événement" }).click();
  let dialog = gmPage.getByRole("dialog", { name: "Événement" });
  await dialog.getByLabel("Titre").fill("L'embuscade au gué");
  await dialog.getByLabel("Déclencheur (facultatif)").fill("Quand le groupe traverse");
  await dialog.getByLabel("Jour", { exact: true }).fill("1");
  await dialog.getByLabel("Heure", { exact: true }).fill("22:00");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(events.getByText("L'embuscade au gué")).toBeVisible();
  await expect(events.getByText("Prévu : Jour 1, 22:00")).toBeVisible();

  // En séance : un lieu montré, l'événement coché.
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);
  await showLocation(gmPage, "Le portail");

  // L'horloge du MJ arrive à l'heure prévue : le panneau le dit.
  await gmPage.getByRole("button", { name: "Régler le jour et l'heure" }).click();
  await gmPage.getByRole("textbox", { name: "Heure" }).fill("21:30");
  await gmPage.keyboard.press("Enter");
  await gmTab(gmPage, "Récit");
  const story = gmPage.locator("#gm-story");
  await expect(story.getByText(/prévu Jour 1, 22:00/)).toBeVisible();
  await expect(story.getByText(/C'est l'heure/)).toHaveCount(0);
  // L'heure avance depuis l'onglet Scène.
  await gmTab(gmPage, "Scène");
  const clock = gmPage.locator("#gm-scene-clock");
  await expect(clock.getByText("Jour 1 · 21:30")).toBeVisible();
  await clock.getByRole("button", { name: "+1 h" }).click();
  // L'heure est venue : l'onglet Récit le compte, l'événement sonne.
  await expect(gmPage.getByRole("tab", { name: /^Récit\s*1/ })).toBeVisible();
  await gmTab(gmPage, "Récit");
  await expect(story.getByText("C'est l'heure").first()).toBeVisible();

  const beat = gmPage.getByRole("button", { name: "Révéler « L'embuscade au gué » aux joueurs" });
  await beat.click();
  await expect(
    gmPage.getByRole("button", { name: "Cacher « L'embuscade au gué » à nouveau" }),
  ).toHaveAttribute("aria-pressed", "true");
  await endSession(gmPage, table);

  // Le résumé : pré-rempli avec ce que l'app sait, gardé en brouillon.
  const chronicle = section(gmPage, "Chronique");
  await expect(chronicle.getByText("Séance 1")).toBeVisible();
  await expect(chronicle.getByText("À publier")).toBeVisible();
  await chronicle.getByRole("button", { name: "Écrire le résumé" }).click();
  dialog = gmPage.getByRole("dialog", { name: "Résumé de la séance 1" });
  await dialog.getByRole("button", { name: "Pré-remplir" }).click();
  const body = dialog.getByLabel("Résumé", { exact: true });
  await expect(body).toHaveValue(/\*\*Présents :\*\* Thorin\n/);
  await expect(body).toHaveValue(/\*\*Lieux :\*\* Le portail/);
  await expect(body).toHaveValue(/- L'embuscade au gué/);
  await body.fill("Le groupe a passé le gué **sous les flèches**.");
  await dialog.getByLabel("Titre (facultatif)").fill("Le gué");
  await dialog.getByLabel("Notes du MJ (privées)").fill("Le chef gobelin a fui vers le nord.");
  await dialog.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(dialog).toBeHidden();

  // Le joueur ouvre l'aventure entre deux séances : rien de publié.
  await bobPage.goto(table.adventurePath);
  await expect(bobPage.getByText("Aucun résumé publié pour l'instant.")).toBeVisible();

  // Le brouillon est retrouvé, puis publié.
  await chronicle.getByRole("button", { name: "Écrire le résumé" }).click();
  dialog = gmPage.getByRole("dialog", { name: "Résumé de la séance 1" });
  await expect(dialog.getByLabel("Titre (facultatif)")).toHaveValue("Le gué");
  await dialog.getByRole("button", { name: "Publier" }).click();
  await expect(gmPage.getByText("Résumé publié : les joueurs peuvent le lire.")).toBeVisible();
  await expect(chronicle.getByText("Publié", { exact: true })).toBeVisible();

  // Le joueur est prévenu sur la campagne, puis lit la chronique.
  await bobPage.goto(`/campaigns/${table.campaignId}`);
  const adventureLink = bobPage.getByRole("link", { name: /L'entrée/ });
  await expect(adventureLink.getByText("Nouveau résumé")).toBeVisible();
  await adventureLink.click();
  const bobChronicle = section(bobPage, "Chronique");
  await expect(bobChronicle.getByText(/^Séance 1/)).toBeVisible();
  await expect(bobChronicle.getByRole("heading", { name: "Le gué" })).toBeVisible();
  await expect(bobChronicle.getByText("sous les flèches")).toBeVisible();
  // Les temps forts sont dans le carnet de la séance.
  await bobChronicle.getByRole("tab", { name: /^Carnet/ }).click();
  await expect(bobChronicle.getByText("L'embuscade au gué")).toBeVisible();
  await expect(bobPage.getByText("Le chef gobelin a fui")).toHaveCount(0);
  await bobPage.goto(`/campaigns/${table.campaignId}`);
  await expect(bobPage.getByRole("link", { name: /L'entrée/ })).toBeVisible();
  await expect(bobPage.getByText("Nouveau résumé")).toHaveCount(0);

  // Séance suivante : « Précédemment… » pour toute la table.
  await startSession(gmPage, table);
  const gmPreviously = gmPage.getByRole("dialog", { name: "Précédemment…" });
  await expect(gmPreviously.getByText("Séance 1 : Le gué")).toBeVisible();
  await gmPreviously.getByRole("button", { name: "C'est parti !" }).click();
  await bobPage.goto(table.adventurePath);
  await bobPage.getByRole("link", { name: /En direct — rejoindre/ }).click();
  const previously = bobPage.getByRole("dialog", { name: "Précédemment…" });
  await expect(previously.getByText("sous les flèches")).toBeVisible();
  await previously.getByRole("button", { name: "C'est parti !" }).click();
  await expect(previously).toBeHidden();
});
