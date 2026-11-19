/**
 * Scénario 11 — Le joueur choisit son personnage pour la campagne : depuis la
 * notification, en en créant un, en gérant plusieurs fiches, et avec les packs
 * que la campagne autorise.
 */
import type { Page } from "@playwright/test";

import {
  addPlayer,
  createCampaign,
  allowPackInCampaign,
  createDndCharacter,
  importExamplePack,
  memberDoc,
  TEST_IMAGE_ORIGIN,
} from "./support/data";
import { charactersOf, createTestUser } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { prepareTable } from "./support/table";
import { Wizard } from "./support/wizard";

function card(page: Page, text: string | RegExp) {
  return page.locator('[data-slot="card"]').filter({ hasText: text });
}
// « Mes personnages » once the player has more than one.
const myCharacter = (page: Page) => card(page, /Mon personnage|Mes personnages/);
// « Le groupe » for the GM, « Mes compagnons » for a player.
const members = (page: Page) => card(page, /Le groupe|Mes compagnons/);

test("la notification mène au choix du personnage", async ({
  signedInPage: page,
  account: player,
  openAs,
}) => {
  const gm = await createTestUser("MJ");
  const campaignId = await createCampaign(gm, "La Crypte");
  await addPlayer(campaignId, player);
  const mira = await createDndCharacter(player, "Mira");

  await page.reload();
  await page.getByRole("button", { name: "Notifications (1)" }).click();
  await page.getByRole("link", { name: /Choisissez votre personnage pour « La Crypte »/ }).click();
  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}#my-character$`));

  await expect(
    myCharacter(page).getByText(/Choisissez le personnage que vous jouerez/),
  ).toBeVisible();
  await myCharacter(page).getByRole("button", { name: /Mira/ }).click();
  await expect(myCharacter(page).getByRole("link", { name: "Voir la fiche" })).toBeVisible();
  await expect.poll(async () => (await memberDoc(campaignId, player.uid))?.characterId).toBe(mira);

  // Plus rien à faire : la notification disparaît.
  await page.reload();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

  const gmPage = await openAs(gm);
  await gmPage.goto(`/campaigns/${campaignId}`);
  await expect(members(gmPage).getByText("Mira", { exact: true })).toBeVisible();
});

test("sans fiche, le joueur en crée une et revient à la campagne", async ({
  signedInPage: page,
  account: player,
}) => {
  const gm = await createTestUser("MJ");
  const campaignId = await createCampaign(gm, "La Crypte");
  await addPlayer(campaignId, player);

  await page.goto(`/campaigns/${campaignId}`);
  await myCharacter(page).getByRole("link", { name: "Créer un nouveau personnage" }).click();
  const wizard = new Wizard(page);
  await wizard.expectQuestion("Quelle classe voulez-vous jouer ?");
  await wizard.createFighter("Brunhild");
  await wizard.validate();

  await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}$`));
  await myCharacter(page)
    .getByRole("button", { name: /Brunhild/ })
    .click();
  await expect(myCharacter(page).getByRole("link", { name: "Voir la fiche" })).toBeVisible();
});

test("le joueur gère plusieurs personnages dans la campagne", async ({
  signedInPage: page,
  account: player,
}) => {
  const gm = await createTestUser("MJ");
  const campaignId = await createCampaign(gm, "La Crypte");
  const thorin = await createDndCharacter(player, "Thorin");
  const mira = await createDndCharacter(player, "Mira");
  await addPlayer(campaignId, player, thorin);

  await page.goto(`/campaigns/${campaignId}`);
  await myCharacter(page).getByRole("button", { name: "Ajouter un personnage" }).click();
  await myCharacter(page).getByRole("button", { name: /Mira/ }).click();
  await expect(myCharacter(page).getByText("Actif", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await memberDoc(campaignId, player.uid))?.characterIds)
    .toEqual([thorin, mira]);

  // Thorin redevient le personnage actif.
  await myCharacter(page).getByRole("button", { name: "Rendre actif" }).click();
  await expect(page.getByText("Thorin est maintenant actif.")).toBeVisible();
  await expect
    .poll(async () => (await memberDoc(campaignId, player.uid))?.characterId)
    .toBe(thorin);

  await myCharacter(page).getByRole("button", { name: "Retirer Mira de la campagne" }).click();
  await expect(page.getByText("Mira a quitté la campagne.")).toBeVisible();
  await expect(myCharacter(page).getByText("Mira", { exact: true })).toHaveCount(0);
  await expect
    .poll(async () => (await memberDoc(campaignId, player.uid))?.characterIds)
    .toEqual([thorin]);
});

test("les packs de la campagne s'ajoutent à la création", async ({
  signedInPage: page,
  account: player,
}) => {
  const gm = await createTestUser("MJ");
  const campaignId = await createCampaign(gm, "La Crypte");
  await addPlayer(campaignId, player);
  await allowPackInCampaign(campaignId, await importExamplePack(gm), gm);
  const wizard = new Wizard(page);
  const packSpecies = page.getByRole("button", { name: "Sylvain des brumes", exact: true });

  // Hors campagne, l'espèce du pack n'est pas proposée…
  await wizard.open();
  await wizard.fighterClassStep("Sylvane");
  await expect(page.getByRole("button", { name: "Nain", exact: true })).toBeVisible();
  await expect(packSpecies).toHaveCount(0);

  // … depuis la campagne, si.
  await page.goto(`/campaigns/${campaignId}`);
  await expect(card(page, "Packs autorisés").getByText("Les Brumes du Nord")).toBeVisible();
  await page.getByRole("link", { name: "Créer un personnage avec ces packs" }).click();
  // Si la création précédente est restée sur l'appareil, on repart de zéro.
  const restart = page.getByRole("button", { name: "Recommencer" });
  const firstQuestion = page.getByRole("heading", { name: "Quelle classe voulez-vous jouer ?" });
  await expect(restart.or(firstQuestion)).toBeVisible();
  if (await restart.isVisible()) await restart.click();
  await wizard.expectQuestion("Quelle classe voulez-vous jouer ?");
  await wizard.fighterClassStep("Sylvane");
  await wizard.chooseCard("Sylvain des brumes");
  await expect(
    page.getByRole("complementary").getByText("Sylvain des brumes").first(),
  ).toBeVisible();
});

test("une classe venue d'un pack se crée comme une classe du SRD", async ({
  signedInPage: page,
  account: player,
}) => {
  const gm = await createTestUser("MJ");
  const campaignId = await createCampaign(gm, "Les Cols");
  await addPlayer(campaignId, player);
  const illustration = `${TEST_IMAGE_ORIGIN}/veilleur.png`;
  const packId = await importExamplePack(gm, (pack) => {
    pack.content.classes[0].imageUrl = illustration;
  });
  await allowPackInCampaign(campaignId, packId, gm);
  const wizard = new Wizard(page);

  await page.goto(`/campaigns/${campaignId}`);
  await page.getByRole("link", { name: "Créer un personnage avec ces packs" }).click();
  const restart = page.getByRole("button", { name: "Recommencer" });
  const firstQuestion = page.getByRole("heading", { name: "Quelle classe voulez-vous jouer ?" });
  await expect(restart.or(firstQuestion)).toBeVisible();
  if (await restart.isVisible()) await restart.click();

  // L'illustration fournie par le pack remplace le carré teinté.
  await page.getByRole("button", { name: "Veilleur des brumes", exact: true }).click();
  await expect(page.locator(`img[src="${illustration}"]`).first()).toBeVisible();
  await wizard.chooseCard("Veilleur des brumes");
  await wizard.expectQuestion("Comment s'appelle votre personnage ?");
  await page.getByRole("textbox", { name: "Nom du personnage" }).fill("Ysolde");
  await wizard.next();
  await wizard.expectQuestion("Quelles 2 compétences maîtrisez-vous ?");
  await wizard.choose("Discrétion");
  await wizard.choose("Survie");
  await wizard.next();
  await wizard.expectQuestion("Avec quel équipement partez-vous ?");
  await wizard.choose("Paquetage du veilleur");
  await wizard.next();
  await wizard.expectQuestion("Quelles bottes d'armes connaissez-vous ?");
  await wizard.check("Arc long");
  await wizard.check("Épée courte");
  await wizard.next();
  // Vos aptitudes : celles de la classe du pack.
  await expect(page.getByText("Pas feutré").first()).toBeVisible();
  await wizard.next();

  await wizard.dwarfSoldierOrigin();
  await wizard.standardArrayAbilities();
  await wizard.equipmentWithCandle();
  await wizard.validate();

  // De retour à la campagne : la fiche porte la classe et ses aptitudes.
  await myCharacter(page).getByText("Ysolde", { exact: true }).click();
  await myCharacter(page).getByRole("link", { name: "Voir la fiche" }).click();
  await expect(page.getByRole("heading", { name: "Ysolde" })).toBeVisible();
  await expect(page.getByText(/Veilleur des brumes/).first()).toBeVisible();
  // d10 + Con +2 + Ténacité naine ; 9 m + Pas feutré.
  await expect(page.getByText("PV max").locator("..")).toContainText("13");
  await expect(page.getByText("Vitesse", { exact: true }).locator("..")).toContainText("12 m");
  await page.getByRole("tab", { name: "Capacités" }).click();
  await expect(page.getByText("Pas feutré").first()).toBeVisible();
});

test("la fiche d'un compagnon s'ouvre depuis la campagne, pas pour un inconnu", async ({
  account: gm,
  openAs,
}) => {
  const table = await prepareTable(gm);
  const thorin = (await charactersOf(table.bob.uid))[0]!;

  // Carol ouvre la fiche de Thorin depuis ses compagnons : sans l'XP de Bob.
  const carolPage = await openAs(table.carol);
  await carolPage.goto(`/campaigns/${table.campaignId}`);
  await members(carolPage).getByRole("link", { name: "Thorin", exact: true }).click();
  await expect(carolPage).toHaveURL(new RegExp(`/characters/${thorin.id}\\?campaign=`));
  await expect(carolPage.getByRole("heading", { name: "Thorin" })).toBeVisible();
  await expect(carolPage.getByText(/\bXP\b/)).toHaveCount(0);

  // Un compte hors de la campagne ne la lit pas.
  const stranger = await openAs(await createTestUser("Inconnu"));
  await stranger.goto(`/characters/${thorin.id}`);
  await expect(stranger.getByText("Personnage introuvable.")).toBeVisible();
});
