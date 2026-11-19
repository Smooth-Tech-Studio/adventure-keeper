/**
 * Scénario 12 — Préparer une aventure : la créer avec ses lieux, ennemis et
 * PNJ, gérer son statut et ses participants, puis la modifier et la supprimer.
 */
import type { Locator, Page } from "@playwright/test";

import { addPlayer, createAdventure, createCampaign, createDndCharacter } from "./support/data";
import { adminDb, createTestUser } from "./support/emulator";
import { expect, test } from "./support/fixtures";

/** A collapsible section of the adventure page, by its title. */
function section(page: Page, title: string): Locator {
  return page.locator('[data-slot="card"]').filter({
    has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
  });
}

async function chooseOption(page: Page, combobox: Locator, option: string) {
  await combobox.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("le MJ crée une aventure avec ses lieux, ennemis et PNJ", async ({
  signedInPage: page,
  account: gm,
}) => {
  const campaignId = await createCampaign(gm, "La Crypte");
  await page.goto(`/campaigns/${campaignId}`);
  await page.getByRole("link", { name: "Nouvelle aventure" }).click();

  // Une question par écran : partir de zéro, puis le titre, requis pour avancer.
  const next = page.getByRole("button", { name: /^Suivant/ });
  await next.click();
  await next.click();
  await expect(page.getByRole("alert").getByText("Le titre est requis.")).toBeVisible();
  await page.getByRole("textbox", { name: "Titre" }).fill("L'entrée de la crypte");
  await page
    .getByRole("textbox", { name: "Résumé (facultatif)" })
    .fill("Les héros forcent le portail.");
  await next.click();
  await expect(page.getByRole("heading", { name: "Où se déroule-t-elle ?" })).toBeVisible();

  // Un lieu caché, avec sa carte.
  await page.getByRole("button", { name: "Ajouter un lieu" }).click();
  let dialog = page.getByRole("dialog", { name: "Lieu" });
  await dialog.getByPlaceholder("La crypte scellée").fill("Le portail scellé");
  await dialog.getByRole("textbox").nth(1).fill("Des runes brillent sur la porte.");
  await dialog
    .getByRole("textbox", { name: "Image / carte (lien)" })
    .fill("https://example.com/portail.png");
  await dialog.getByRole("checkbox", { name: /À cacher/ }).check();
  // Un butin prévu : une clé et des pièces.
  await dialog.getByRole("button", { name: "Ajouter un objet" }).click();
  await dialog.getByRole("textbox", { name: "Nom de l'objet" }).fill("Clé du portail");
  await dialog.getByRole("spinbutton", { name: "Pièces d'or" }).fill("12");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();

  await next.click();

  // Un ennemi tiré du bestiaire, rattaché au lieu.
  await page.getByRole("button", { name: "Ajouter un ennemi" }).click();
  dialog = page.getByRole("dialog", { name: "Ennemi" });
  await dialog.getByRole("button", { name: "Depuis un monstre" }).click();
  const picker = page.getByRole("dialog", { name: "Monstres" });
  await picker.getByPlaceholder("Rechercher un monstre…").fill("gobelin");
  await picker.getByRole("button", { name: /^Combattant gobelin P/ }).click();
  await expect(dialog.getByRole("textbox").first()).toHaveValue("Combattant gobelin");
  await chooseOption(page, dialog.getByRole("combobox").last(), "Le portail scellé");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();

  // Un ennemi sur mesure, avec une attaque.
  await page.getByRole("button", { name: "Ajouter un ennemi" }).click();
  dialog = page.getByRole("dialog", { name: "Ennemi" });
  await dialog.getByRole("textbox").first().fill("Chef bandit");
  await dialog.getByRole("button", { name: "Ajouter une attaque" }).click();
  await dialog.getByPlaceholder("Nom (ex. Cimeterre)").fill("Cimeterre");
  // Un butin prévu : une dague (×2) et des pièces.
  await dialog.getByRole("button", { name: "Ajouter un objet" }).click();
  await dialog.getByRole("textbox", { name: "Nom de l'objet" }).fill("Dague");
  await dialog.getByRole("spinbutton", { name: "Quantité" }).fill("2");
  await dialog.getByRole("spinbutton", { name: "Pièces d'argent" }).fill("7");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();

  await next.click();

  // Un PNJ.
  await page.getByRole("button", { name: "Ajouter un personnage" }).click();
  dialog = page.getByRole("dialog", { name: "Personnage (PNJ)" });
  await dialog.getByPlaceholder("Dame Ophélie").fill("Frère Anselme");
  await dialog.getByPlaceholder("Méfiant, avare, loyal envers le baron…").fill("Gardien inquiet");
  await chooseOption(page, dialog.getByRole("combobox").last(), "Le portail scellé");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();

  await next.click();

  // Le récapitulatif, puis la création.
  await expect(page.getByRole("heading", { name: "Prête à jouer ?" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Frère Anselme" })).toBeVisible();
  await page.getByRole("button", { name: "Créer l'aventure" }).click();
  await expect(page.getByText("Aventure créée.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "L'entrée de la crypte", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Les héros forcent le portail.")).toBeVisible();
  await expect(section(page, "Lieux").getByText("Le portail scellé")).toBeVisible();
  await expect(
    section(page, "Ennemis").getByText("Combattant gobelin", { exact: true }),
  ).toBeVisible();
  await expect(section(page, "Ennemis").getByText("Chef bandit", { exact: true })).toBeVisible();
  await expect(section(page, "Personnages").getByText("Frère Anselme")).toBeVisible();
  // Le PNJ et le gobelin portent le lieu auquel ils sont rattachés.
  await expect(section(page, "Personnages").getByText("Le portail scellé")).toBeVisible();
  await expect(section(page, "Ennemis").getByText("Le portail scellé")).toBeVisible();

  // Le butin prévu est enregistré : on le retrouve en rouvrant l'ennemi et le lieu.
  await section(page, "Ennemis")
    .locator(".bg-muted\\/30")
    .filter({ hasText: "Chef bandit" })
    .getByRole("button", { name: "Modifier" })
    .click();
  dialog = page.getByRole("dialog", { name: "Ennemi" });
  await expect(dialog.getByRole("textbox", { name: "Nom de l'objet" })).toHaveValue("Dague");
  await expect(dialog.getByRole("spinbutton", { name: "Quantité" })).toHaveValue("2");
  await expect(dialog.getByRole("spinbutton", { name: "Pièces d'argent" })).toHaveValue("7");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await section(page, "Lieux")
    .locator(".bg-muted\\/30")
    .filter({ hasText: "Le portail scellé" })
    .getByRole("button", { name: "Modifier" })
    .click();
  dialog = page.getByRole("dialog", { name: "Lieu" });
  await expect(dialog.getByRole("textbox", { name: "Nom de l'objet" })).toHaveValue(
    "Clé du portail",
  );
  await expect(dialog.getByRole("spinbutton", { name: "Pièces d'or" })).toHaveValue("12");
  await dialog.getByRole("button", { name: "Annuler" }).click();

  // Nouvelle, l'aventure est un brouillon.
  await expect(page.getByRole("combobox").first()).toHaveText("Brouillon");
  await expect(page.getByText(/Brouillon : invisible pour les joueurs, non jouable/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer la session" })).toHaveCount(0);
});

test("statut, participants et règles optionnelles", async ({
  signedInPage: gmPage,
  account: gm,
  openAs,
}) => {
  const bob = await createTestUser("Bob");
  const campaignId = await createCampaign(gm, "La Crypte");
  await addPlayer(campaignId, bob, await createDndCharacter(bob, "Thorin"));
  const first = await createAdventure(campaignId, gm, "L'entrée de la crypte");
  const second = await createAdventure(campaignId, gm, "Le puits");

  const bobPage = await openAs(bob);
  await bobPage.goto(`/campaigns/${campaignId}`);
  await expect(bobPage.getByText("Aucune aventure pour l'instant.")).toBeVisible();

  await gmPage.goto(`/campaigns/${campaignId}/adventures/${first}`);
  const status = gmPage.getByRole("combobox").first();
  await chooseOption(gmPage, status, "À venir");
  await expect(status).toHaveText("À venir");
  await expect(gmPage.getByRole("button", { name: "Démarrer la session" })).toBeVisible();
  // Un joueur ne voit que les aventures auxquelles il participe.
  await expect(bobPage.getByText("Aucune aventure pour l'instant.")).toBeVisible();

  // Participants : le personnage du joueur en un clic.
  const participants = section(gmPage, "Participants");
  await participants.getByRole("button", { name: "Thorin" }).click();
  await expect(participants.getByRole("button", { name: "Retirer" })).toBeVisible();
  // Il l'ouvre pour lire la chronique ; le contenu attend le direct ou la fin.
  await bobPage.getByRole("link", { name: /L'entrée de la crypte/ }).click();
  await expect(
    bobPage.getByRole("heading", { name: "L'entrée de la crypte", level: 1 }),
  ).toBeVisible();
  await expect(bobPage.getByText("Aucun résumé publié pour l'instant.")).toBeVisible();
  await expect(
    bobPage.getByText(/Le reste de l'aventure .* s'ouvre pendant une séance/),
  ).toBeVisible();
  await expect(section(bobPage, "Lieux")).toHaveCount(0);

  await chooseOption(gmPage, status, "Terminée");
  await expect(status).toHaveText("Terminée");
  await bobPage.reload();
  await expect(bobPage.getByText(/Le reste de l'aventure/)).toHaveCount(0);
  await expect(section(bobPage, "Participants").getByText("Thorin")).toBeVisible();
  // Sans les outils du MJ.
  await expect(bobPage.getByText("Statut")).toHaveCount(0);
  await expect(bobPage.getByRole("button", { name: "Ajouter un lieu" })).toHaveCount(0);
  await expect(bobPage.getByRole("button", { name: "Supprimer l'aventure" })).toHaveCount(0);

  await participants.getByRole("button", { name: "Retirer" }).click();
  await expect(participants.getByText("Aucun participant.")).toBeVisible();

  // Une seule aventure « En cours » par campagne.
  await chooseOption(gmPage, status, "En cours");
  await expect(status).toHaveText("En cours");
  await gmPage.goto(`/campaigns/${campaignId}/adventures/${second}`);
  await chooseOption(gmPage, gmPage.getByRole("combobox").first(), "En cours");
  await expect(
    gmPage.getByText(
      "« L'entrée de la crypte » est déjà en cours. Terminez-la avant d'en lancer une autre.",
    ),
  ).toBeVisible();
  await expect(gmPage.getByRole("combobox").first()).toHaveText("Brouillon");

  // Règles optionnelles : la gestion des états reste cochée.
  const conditions = gmPage.getByRole("checkbox", { name: /Gestion des états/ });
  await conditions.click();
  await expect(conditions).toBeChecked();
  await gmPage.reload();
  await expect(gmPage.getByRole("checkbox", { name: /Gestion des états/ })).toBeChecked();
});

test("une aventure déjà jouée ne repasse pas en brouillon", async ({
  signedInPage: page,
  account: gm,
}) => {
  const campaignId = await createCampaign(gm, "La Crypte");
  const adventureId = await createAdventure(campaignId, gm, "L'entrée", "completed");
  await adminDb
    .doc(`campaigns/${campaignId}/adventures/${adventureId}`)
    .update({ hasPlayedSession: true });

  await page.goto(`/campaigns/${campaignId}/adventures/${adventureId}`);
  await page.getByRole("combobox").first().click();
  await expect(page.getByRole("option", { name: "Brouillon" })).toBeDisabled();
});

test("le MJ modifie le contenu puis supprime l'aventure", async ({
  signedInPage: page,
  account: gm,
}) => {
  const campaignId = await createCampaign(gm, "La Crypte");
  const adventureId = await createAdventure(campaignId, gm, "L'entrée");
  await page.goto(`/campaigns/${campaignId}/adventures/${adventureId}`);

  const locations = section(page, "Lieux");
  await locations.getByRole("button", { name: "Ajouter un lieu" }).click();
  let dialog = page.getByRole("dialog", { name: "Lieu" });
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Nom du lieu requis.")).toBeVisible();
  await dialog.getByPlaceholder("La crypte scellée").fill("La salle des gardes");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(locations.getByText("La salle des gardes")).toBeVisible();

  await locations.getByRole("button", { name: "Modifier" }).click();
  dialog = page.getByRole("dialog", { name: "Lieu" });
  await dialog.getByPlaceholder("La crypte scellée").fill("La salle du trône");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(locations.getByText("La salle du trône")).toBeVisible();

  await locations.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(locations.getByText("Aucun lieu.")).toBeVisible();

  await page.getByRole("button", { name: "Supprimer l'aventure" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Aventure supprimée.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}$`));
  await expect(page.getByText("Aucune aventure pour l'instant.")).toBeVisible();
});
