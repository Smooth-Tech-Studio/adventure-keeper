/**
 * Scénario 10 — Créer et animer une campagne : création, renommage,
 * invitations (e-mail et lien), carnet du MJ (notes et ressources),
 * packs autorisés, suppression.
 */
import type { Page } from "@playwright/test";

import {
  addPlayer,
  campaignDoc,
  createCampaign,
  createDndCharacter,
  importExamplePack,
} from "./support/data";
import { createTestUser, TEST_PASSWORD, uniqueEmail } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { Wizard } from "./support/wizard";

/** A card of the campaign page, found by its description line. */
function card(page: Page, description: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: description });
}

const members = (page: Page) => card(page, "Le groupe");

/** The GM's « Inviter » button opens the invitations (e-mail, link). */
async function openInvite(page: Page) {
  await members(page).getByRole("button", { name: "Inviter", exact: true }).click();
  return page.getByRole("dialog", { name: "Inviter des joueurs" });
}

/** « Préparation » opens the notebook and the resources in a side panel. */
async function openPrep(page: Page, name: "Carnet du MJ" | "Ressources du MJ") {
  await card(page, "Préparation")
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  return page.getByRole("dialog", { name });
}

/** An entry of the campaign's ⋮ menu. */
async function campaignMenu(page: Page, item: string) {
  await page.getByRole("button", { name: "Actions de la campagne" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("le MJ crée, renomme puis supprime une campagne", async ({ signedInPage: page }) => {
  await page.goto("/campaigns");
  await expect(page.getByRole("heading", { name: "Mes campagnes" })).toBeVisible();
  await expect(page.getByText("Aucune campagne pour l'instant")).toBeVisible();
  await page.getByRole("link", { name: "Nouvelle campagne" }).first().click();

  // Une question par écran : partir de zéro, puis le nom, requis pour avancer.
  const next = page.getByRole("button", { name: /^Suivant/ });
  await expect(
    page.getByRole("heading", { name: "Comment voulez-vous commencer ?" }),
  ).toBeVisible();
  await next.click();
  await next.click();
  await expect(page.getByRole("alert").getByText("Nom requis")).toBeVisible();

  await page.getByLabel("Nom de la campagne").fill("La Crypte oubliée");
  await page.getByLabel("Le pitch (facultatif)").fill("Une descente dans les catacombes.");
  await next.click();
  await expect(page.getByRole("heading", { name: "À quoi allez-vous jouer ?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Compatible 5E \(2024\)/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Un seul choix : le jeu décide aussi des fiches.
  await expect(page.getByRole("heading", { name: "Quelles fiches de personnage ?" })).toHaveCount(
    0,
  );
  await next.click();
  // Sans pack dans la bibliothèque, pas d'écran des packs : le récapitulatif.
  await expect(page.getByRole("heading", { name: "On y va ?" })).toBeVisible();
  await expect(page.getByText("Une descente dans les catacombes.")).toBeVisible();
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await expect(page.getByText("Campagne créée — vous en êtes le Maître du jeu.")).toBeVisible();

  // Puis les invitations, avant d'ouvrir la campagne.
  await expect(page.getByRole("heading", { name: "Invitez vos joueurs" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Inviter par e-mail" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Précédent" })).toBeDisabled();
  await page.getByRole("button", { name: "Ouvrir la campagne" }).click();
  await expect(page.getByRole("heading", { name: "La Crypte oubliée", level: 1 })).toBeVisible();
  await expect(page.getByText(/vous êtes le Maître du jeu/)).toBeVisible();
  await expect(page.getByText("Une descente dans les catacombes.")).toBeVisible();

  await campaignMenu(page, "Renommer la campagne");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom de la campagne").fill("La Crypte retrouvée");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Campagne renommée.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "La Crypte retrouvée", level: 1 })).toBeVisible();

  await campaignMenu(page, "Supprimer la campagne");
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Campagne supprimée.")).toBeVisible();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByText("Aucune campagne pour l'instant")).toBeVisible();
});

test("invitation par e-mail : le joueur accepte depuis ses notifications", async ({
  signedInPage: gmPage,
  account: gm,
  openAs,
}) => {
  const bob = await createTestUser("Bob");
  await createDndCharacter(bob, "Thorin");
  const campaignId = await createCampaign(gm, "La Crypte");
  await gmPage.goto(`/campaigns/${campaignId}`);

  // Une adresse sans compte est refusée.
  const dialog = await openInvite(gmPage);
  const invite = dialog.getByRole("textbox", { name: "Inviter par e-mail" });
  await invite.fill(uniqueEmail("personne"));
  await dialog.getByRole("button", { name: "Inviter", exact: true }).click();
  await expect(gmPage.getByText(/Aucun compte avec cette adresse/)).toBeVisible();

  await invite.fill(bob.email);
  await dialog.getByRole("button", { name: "Inviter", exact: true }).click();
  await expect(gmPage.getByText("Invitation envoyée à Bob.")).toBeVisible();
  await expect(dialog.getByText("Invitation envoyée")).toBeVisible();

  // Une seconde invitation est refusée tant que la première attend.
  await invite.fill(bob.email);
  await dialog.getByRole("button", { name: "Inviter", exact: true }).click();
  await expect(gmPage.getByText("Bob a déjà une invitation en attente.")).toBeVisible();
  await gmPage.keyboard.press("Escape");
  await expect(members(gmPage).getByText("Invitation envoyée")).toBeVisible();

  const bobPage = await openAs(bob);
  await bobPage.getByRole("button", { name: "Notifications (1)" }).click();
  await expect(bobPage.getByText(/vous invite à rejoindre/)).toContainText("« La Crypte »");
  await bobPage.getByRole("button", { name: "Accepter" }).click();

  await expect(bobPage.getByText("Choisissez votre personnage")).toBeVisible();
  const join = bobPage.getByRole("button", { name: "Rejoindre la campagne" });
  await expect(join).toBeDisabled();
  await bobPage.getByRole("button", { name: /Thorin/ }).click();
  await join.click();
  await expect(bobPage.getByText("Bienvenue dans « La Crypte » !")).toBeVisible();
  await expect(bobPage.getByRole("heading", { name: "La Crypte", level: 1 })).toBeVisible();

  // La liste des membres est lue à l'ouverture de la page.
  await gmPage.reload();
  await expect(members(gmPage).getByText("Thorin", { exact: true })).toBeVisible();
  expect((await campaignDoc(campaignId))?.memberIds).toContain(bob.uid);
});

test("un joueur refuse une invitation", async ({ signedInPage: gmPage, account: gm, openAs }) => {
  const carol = await createTestUser("Carol");
  const campaignId = await createCampaign(gm, "La Crypte");
  await gmPage.goto(`/campaigns/${campaignId}`);
  const dialog = await openInvite(gmPage);
  await dialog.getByRole("textbox", { name: "Inviter par e-mail" }).fill(carol.email);
  await dialog.getByRole("button", { name: "Inviter", exact: true }).click();
  await expect(gmPage.getByText("Invitation envoyée à Carol.")).toBeVisible();
  await gmPage.keyboard.press("Escape");

  const carolPage = await openAs(carol);
  await carolPage.getByRole("button", { name: "Notifications (1)" }).click();
  await carolPage.getByRole("button", { name: "Refuser" }).click();
  await expect(carolPage.getByText("Invitation à « La Crypte » refusée.")).toBeVisible();
  await expect(carolPage.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

  await expect(members(gmPage).getByText("A refusé")).toBeVisible();
  await members(gmPage).getByRole("button", { name: "Retirer" }).click();
  await expect(members(gmPage).getByText("A refusé")).toHaveCount(0);
});

test("lien d'invitation : un nouveau venu crée compte et personnage en chemin", async ({
  signedInPage: gmPage,
  account: gm,
  browser,
  baseURL,
}) => {
  const campaignId = await createCampaign(gm, "La Crypte");
  await gmPage.goto(`/campaigns/${campaignId}`);
  // Le bouton porte le libellé du champ : « Lien d'invitation ».
  let dialog = await openInvite(gmPage);
  await dialog.getByRole("button", { name: "Lien d'invitation" }).click();
  const link = dialog.getByRole("textbox", { name: "Lien d'invitation" });
  await expect(link).toHaveValue(/\/join\/.+/);
  const joinPath = new URL(await link.inputValue()).pathname;

  // Sans compte : le lien mène à la connexion, puis à l'inscription.
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(joinPath);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Créer un compte" }).last().click();
  await page.getByLabel("Nom affiché").fill("Dana");
  await page.getByLabel("E-mail").fill(uniqueEmail("dana"));
  await page.getByLabel("Mot de passe", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(new RegExp(`${joinPath}$`));

  // Pas encore de personnage : on le crée, et la création ramène à l'invitation.
  await expect(page.getByText("Choisissez votre personnage")).toBeVisible();
  await page.getByRole("link", { name: /Créer/ }).first().click();
  const wizard = new Wizard(page);
  await wizard.expectQuestion("Quelle classe voulez-vous jouer ?");
  await wizard.createFighter("Dana la Brave");
  await wizard.validate();
  await expect(page).toHaveURL(new RegExp(`${joinPath}$`));
  await page.getByRole("button", { name: /Dana la Brave/ }).click();
  await page.getByRole("button", { name: "Rejoindre la campagne" }).click();
  await expect(page.getByText("Bienvenue dans « La Crypte » !")).toBeVisible();
  await gmPage.reload();
  await expect(members(gmPage).getByText("Dana la Brave", { exact: true })).toBeVisible();

  // Le lien désactivé ne fonctionne plus.
  dialog = await openInvite(gmPage);
  await dialog.getByRole("button", { name: "Désactiver" }).click();
  await expect(dialog.getByRole("button", { name: "Lien d'invitation" })).toBeVisible();
  const late = await createTestUser("Retardataire");
  await page.getByRole("button", { name: "Menu du compte" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(late.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(late.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Menu du compte" })).toBeVisible();
  await page.goto(joinPath);
  await expect(page.getByText("Invitation expirée")).toBeVisible();
  await context.close();
});

test("le carnet du MJ : notes et ressources que les joueurs ne voient pas", async ({
  signedInPage: gmPage,
  account: gm,
  openAs,
}) => {
  const bob = await createTestUser("Bob");
  const campaignId = await createCampaign(gm, "La Crypte");
  await addPlayer(campaignId, bob, await createDndCharacter(bob, "Thorin"));

  let notes = gmPage.getByRole("dialog", { name: "Carnet du MJ" });
  async function addNote(title: string) {
    await notes.getByRole("button", { name: "Nouvelle note" }).click();
    await notes.getByPlaceholder("Titre").fill(title);
    await notes.getByPlaceholder("Contenu de la note…").fill(`Contenu de ${title}`);
    await notes.getByRole("button", { name: "Créer" }).click();
    await expect(notes.getByText(title, { exact: true })).toBeVisible();
  }

  await gmPage.goto(`/campaigns/${campaignId}`);
  notes = await openPrep(gmPage, "Carnet du MJ");
  await addNote("Le traître");
  await addNote("Le trésor");

  // Une note épinglée passe en tête.
  const firstNote = notes.locator("div.rounded-md").first();
  await expect(firstNote).not.toContainText("Le traître");
  await notes
    .locator("div.rounded-md")
    .filter({ hasText: "Le traître" })
    .getByRole("button", { name: "Épingler" })
    .click();
  await expect(firstNote).toContainText("Le traître");

  // Modifier puis supprimer.
  const note = notes.locator("div.rounded-md").filter({ hasText: "Le traître" });
  await note.getByRole("button", { name: "Modifier" }).click();
  await notes.getByPlaceholder("Titre").fill("Le traître démasqué");
  await notes.getByRole("button", { name: "Enregistrer" }).click();
  await expect(notes.getByText("Le traître démasqué", { exact: true })).toBeVisible();
  await notes
    .locator("div.rounded-md")
    .filter({ hasText: "Le traître démasqué" })
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(notes.getByText("Le traître démasqué", { exact: true })).toHaveCount(0);

  await gmPage.keyboard.press("Escape");
  await expect(card(gmPage, "Préparation")).toContainText(/Carnet du MJ\s*· 1/);
  const resources = await openPrep(gmPage, "Ressources du MJ");
  await resources.getByRole("button", { name: "Nouvelle ressource" }).click();
  await resources.getByPlaceholder("Titre").fill("Plan secret");
  await resources.getByPlaceholder("https://…").fill("https://example.com/plan.png");
  await resources.getByRole("button", { name: "Ajouter" }).click();
  await expect(resources.getByText("Plan secret", { exact: true })).toBeVisible();

  // Le joueur n'a ni le carnet ni les ressources.
  const bobPage = await openAs(bob);
  await bobPage.goto(`/campaigns/${campaignId}`);
  await expect(bobPage.getByText("Aucune aventure pour l'instant.")).toBeVisible();
  await expect(bobPage.getByText("Carnet du MJ")).toHaveCount(0);
  await expect(bobPage.getByText("Ressources du MJ")).toHaveCount(0);
  await expect(bobPage.getByText("Le trésor")).toHaveCount(0);
});

test("le MJ autorise un pack de sa bibliothèque", async ({
  signedInPage: gmPage,
  account: gm,
  openAs,
}) => {
  const bob = await createTestUser("Bob");
  const campaignId = await createCampaign(gm, "La Crypte");
  await addPlayer(campaignId, bob, await createDndCharacter(bob, "Thorin"));
  await importExamplePack(gm);

  await gmPage.goto(`/campaigns/${campaignId}`);
  const packs = card(gmPage, "Packs autorisés");
  await expect(
    packs.getByText("Aucun pack : seul le contenu de base (SRD) est utilisable."),
  ).toBeVisible();
  await packs.getByRole("button", { name: "Autoriser" }).click();
  await expect(
    packs.getByRole("button", { name: "Retirer Les Brumes du Nord de la campagne" }),
  ).toBeVisible();

  const bobPage = await openAs(bob);
  await bobPage.goto(`/campaigns/${campaignId}`);
  const bobPacks = card(bobPage, "Packs autorisés");
  await expect(bobPacks.getByText("Les Brumes du Nord")).toBeVisible();
  await expect(
    bobPacks.getByRole("link", { name: "Créer un personnage avec ces packs" }),
  ).toBeVisible();

  await packs.getByRole("button", { name: "Retirer Les Brumes du Nord de la campagne" }).click();
  await expect(bobPacks.getByText("Les Brumes du Nord")).toHaveCount(0);
});

test("la création guidée autorise un pack d'emblée", async ({
  signedInPage: page,
  account: gm,
}) => {
  await importExamplePack(gm);
  await page.goto("/campaigns/new");
  const next = page.getByRole("button", { name: /^Suivant/ });
  await next.click();
  await page.getByLabel("Nom de la campagne").fill("Le Nord");
  await next.click();
  // Le système (5E) : l'écran suivant est celui des packs.
  await next.click();
  await expect(
    page.getByRole("heading", { name: "Quels packs de contenu autoriser ?" }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await next.click();
  // Le récapitulatif le liste.
  await expect(
    page.getByRole("definition").filter({ hasText: "Les Brumes du Nord" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await page.getByRole("button", { name: "Ouvrir la campagne" }).click();
  await expect(
    card(page, "Packs autorisés").getByRole("button", {
      name: "Retirer Les Brumes du Nord de la campagne",
    }),
  ).toBeVisible();
});
