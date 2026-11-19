/**
 * Scénario 14 — Un combat en session : le MJ le compose, suit l'initiative,
 * ajuste les PV et fait avancer les tours ; le joueur suit le bandeau de tour
 * sans les contrôles du MJ.
 */
import type { Locator, Page } from "@playwright/test";

import { addParticipant, addPlayer, createDndCharacter } from "./support/data";
import { adminDb, createTestUser } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { gmTab, joinSession, prepareTable, showLocation, startSession } from "./support/table";

/** The combatants of the GM's « Combat » tab. */
function combatants(page: Page) {
  return page.locator("#gm-combat li");
}

function combatant(page: Page, name: string) {
  return combatants(page).filter({ hasText: name });
}

/** Type an amount on a combatant's hit-point pad, then « Dégâts » or « Soins ». */
async function hitPointPad(page: Page, row: Locator, amount: string, action: "Dégâts" | "Soins") {
  await row.getByRole("button", { name: /PV : saisir/ }).click();
  const pad = page.getByRole("dialog");
  for (const key of amount) await pad.getByRole("button", { name: key, exact: true }).click();
  await pad.getByRole("button", { name: action }).click();
  await expect(pad).toBeHidden();
}

/** A combatant's « ⋮ » menu: map token, remove from the fight. */
async function rowAction(page: Page, name: string, item: string) {
  await page.getByRole("button", { name: `Actions sur ${name}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("un combat, du premier round à la fin", async ({ signedInPage: gmPage, account, openAs }) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  await showLocation(gmPage, "Le portail");
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);

  // « Jetez l'initiative ! » : Bob la lance depuis sa fiche, le MJ la reçoit.
  await bobPage.getByRole("button", { name: /^Jet d'initiative/ }).click();
  const roll = bobPage.getByRole("dialog");
  await roll.getByRole("button", { name: /^Lancer d20/ }).click();
  await roll.getByRole("button", { name: "OK" }).click();
  await expect(bobPage.getByText(/Transmis au MJ : \d+/)).toBeVisible();

  // Composer le combat : Thorin seul (Mira décochée) contre un gobelin.
  await gmTab(gmPage, "Combat");
  await gmPage.getByRole("button", { name: "Lancer le combat" }).click();
  const setup = gmPage.getByRole("dialog", { name: "Créer un combat" });
  await expect(setup.getByText("lancée par le joueur")).toHaveCount(1);
  // The checkbox sits on Mira's row, next to her initiative.
  const miraRow = setup.getByRole("spinbutton", { name: "Initiative de Mira" }).locator("..");
  await miraRow.getByRole("checkbox").uncheck();
  await setup.getByRole("spinbutton", { name: "Initiative de Thorin" }).fill("20");
  await setup.getByRole("button", { name: "Ajouter un ennemi" }).click();
  await gmPage.getByRole("menuitem", { name: /^Gobelin/ }).click();
  await expect(setup.getByRole("textbox", { name: "Nom de l'instance" })).toHaveValue("Gobelin 1");
  await setup.getByRole("spinbutton", { name: "Initiative", exact: true }).fill("5");
  await setup.getByRole("button", { name: "Lancer le combat" }).click();
  await expect(setup).toBeHidden();

  // Round 1, Thorin d'abord : le MJ a « Suivant », pas le joueur.
  const next = gmPage.locator("#gm-combat-next");
  await expect(gmPage.getByRole("tab", { name: /^Combat\s*R1/ })).toBeVisible();
  await expect(gmPage.locator("#gm-combat").getByText("Round 1")).toBeVisible();
  await expect(bobPage.getByText(/Round 1 · à un joueur/)).toBeVisible();
  await expect(next).toBeVisible();
  await expect(bobPage.getByRole("button", { name: "Suivant", exact: true })).toHaveCount(0);
  await expect(combatant(gmPage, "Mira")).toHaveCount(0);
  await expect(combatants(gmPage)).toHaveCount(2);

  // Les PV : le gobelin encaisse, Thorin aussi — le joueur le voit sur sa fiche.
  const goblin = combatant(gmPage, "Gobelin 1");
  await goblin.getByRole("button", { name: "Retirer 1 PV" }).click();
  await goblin.getByRole("button", { name: "Retirer 1 PV" }).click();
  await expect(goblin.getByRole("button", { name: /^5 sur 7 PV/ })).toBeVisible();
  const thorin = combatant(gmPage, "Thorin");
  await hitPointPad(gmPage, thorin, "5", "Dégâts");
  await expect(thorin.getByRole("button", { name: /^8 sur 13 PV/ })).toBeVisible();
  await expect(gmPage.getByRole("button", { name: /Thorin 8\/13/ })).toBeVisible();
  await expect(bobPage.getByRole("spinbutton").first()).toHaveValue("8");

  // Tour suivant : le gobelin, puis le round 2.
  await expect(thorin).toHaveAttribute("aria-current", "true");
  await next.click();
  await expect(goblin).toHaveAttribute("aria-current", "true");
  // Son tour : le MJ le fait attaquer : la même feuille de jet que les joueurs.
  await gmPage.getByRole("button", { name: "Lancer l'attaque Cimeterre" }).first().click();
  const attack = gmPage.getByRole("dialog", { name: "Gobelin · Cimeterre" });
  await attack.getByRole("button", { name: /^Lancer d20 \+4/ }).click();
  await attack.getByRole("button", { name: /^Touché/ }).click();
  await gmPage
    .getByRole("dialog", { name: /^Gobelin · Cimeterre \(tranchant\) · dégâts/ })
    .getByRole("button", { name: /^Lancer/ })
    .click();
  await gmPage.getByRole("button", { name: "OK" }).click();
  await expect(gmPage.getByRole("dialog")).toHaveCount(0);

  await next.click();
  await expect(gmPage.getByRole("tab", { name: /^Combat\s*R2/ })).toBeVisible();
  await expect(bobPage.getByText(/Round 2/).first()).toBeVisible();

  // Des renforts en cours de combat.
  await gmPage.locator("#gm-combat").getByRole("button", { name: "Ennemis" }).click();
  const reinforcements = gmPage.getByRole("dialog", { name: "Ajouter des ennemis au combat" });
  await reinforcements.getByRole("button", { name: "Ajouter un ennemi" }).click();
  await gmPage.getByRole("menuitem", { name: /^Gobelin/ }).click();
  // La numérotation reprend après les gobelins déjà en combat.
  await expect(reinforcements.getByRole("textbox", { name: "Nom de l'instance" })).toHaveValue(
    "Gobelin 2",
  );
  await reinforcements.getByRole("button", { name: "Ajouter au combat" }).click();
  await expect(reinforcements).toBeHidden();
  await expect(combatant(gmPage, "Gobelin")).toHaveCount(2);
  await expect(combatants(gmPage)).toHaveCount(3);

  // Un jeton se retire de la carte sans quitter le combat, puis y revient.
  await rowAction(gmPage, "Gobelin 2", "Retirer de la carte");
  await rowAction(gmPage, "Gobelin 2", "Placer sur la carte");
  await gmPage.getByRole("button", { name: "Actions sur Gobelin 2" }).click();
  await expect(gmPage.getByRole("menuitem", { name: "Retirer de la carte" })).toBeVisible();
  await gmPage.keyboard.press("Escape");

  // Un gobelin tombe et quitte le combat, puis le combat prend fin.
  const fallen = combatant(gmPage, "Gobelin 1");
  await hitPointPad(gmPage, fallen, "99", "Dégâts");
  await expect(fallen.getByRole("button", { name: /^0 sur 7 PV/ })).toBeVisible();
  await expect(fallen.getByText("Hors combat")).toBeVisible();
  await rowAction(gmPage, "Gobelin 1", "Retirer du combat");
  await expect(combatant(gmPage, "Gobelin 1")).toHaveCount(0);
  await gmPage.getByRole("button", { name: "Fin du combat" }).click();
  // Le panneau revient à la scène ; l'onglet Combat propose d'en lancer un autre.
  await expect(gmPage.getByRole("tab", { name: "Scène" })).toHaveAttribute("aria-selected", "true");
  await gmTab(gmPage, "Combat");
  await expect(gmPage.getByRole("button", { name: "Lancer le combat" })).toBeVisible();
  await expect(bobPage.getByText(/Round \d/)).toHaveCount(0);

  // La séance garde l'ennemi vaincu pour le résumé, pas celui encore debout.
  const [, campaignId, , adventureId, , sessionId] = new URL(gmPage.url()).pathname
    .replace(/^\//, "")
    .split("/");
  const session = adminDb.doc(
    `campaigns/${campaignId}/adventures/${adventureId}/liveSessions/${sessionId}`,
  );
  await expect
    .poll(async () =>
      ((await session.get()).data()?.defeated ?? []).map((d: { name: string }) => d.name),
    )
    .toEqual(["Gobelin 1"]);
});

test("un familier invoqué rejoint le combat", async ({ signedInPage: gmPage, account, openAs }) => {
  const table = await prepareTable(account);
  // Mira's grimoire holds « Appel de familier ».
  const [mira] = (
    await adminDb.collection("characters").where("name", "==", "Mira").get()
  ).docs.filter((doc) => doc.data().ownerId === table.carol.uid);
  await mira.ref.update({ spells: [...mira.data().spells, "find-familiar"] });

  await startSession(gmPage, table);
  await showLocation(gmPage, "Le portail");
  const carolPage = await openAs(table.carol);
  await joinSession(carolPage, table);

  await gmTab(gmPage, "Combat");
  await gmPage.getByRole("button", { name: "Lancer le combat" }).click();
  const setup = gmPage.getByRole("dialog", { name: "Créer un combat" });
  await setup.getByRole("button", { name: "Ajouter un ennemi" }).click();
  await gmPage.getByRole("menuitem", { name: /^Gobelin/ }).click();
  await setup.getByRole("button", { name: "Lancer le combat" }).click();
  await expect(setup).toBeHidden();

  // Mira lance le sort : un emplacement part, puis elle choisit la forme et le nom.
  await carolPage.getByRole("tab", { name: "Sorts" }).click();
  await carolPage.getByRole("button", { name: "Lancer Appel de familier" }).click();
  await carolPage
    .getByRole("dialog", { name: "Appel de familier" })
    .getByRole("button", { name: "Lancer", exact: true })
    .click();
  const summon = carolPage.getByRole("dialog", { name: "Invoquer un familier" });
  await summon.getByRole("radio", { name: /^Chouette/ }).click();
  await summon.getByRole("textbox", { name: "Nom" }).fill("Hedwige");
  await summon.getByRole("button", { name: "Invoquer" }).click();
  await expect(summon).toBeHidden();

  // Sa carte, dans les actions ; il entre dans le combat avec sa propre initiative.
  await carolPage.getByRole("tab", { name: "Actions" }).click();
  const card = carolPage.getByRole("region", { name: "Familier" });
  await expect(card).toContainText("Hedwige");
  await expect(card).toContainText("Chouette");
  await card.getByRole("button", { name: "Ajouter au combat" }).click();
  await expect(combatant(gmPage, "Hedwige")).toBeVisible();
  await expect(combatant(gmPage, "Hedwige")).toContainText("familier");
  await expect(card.getByRole("button", { name: "Ajouter au combat" })).toHaveCount(0);

  // Renvoyé : il quitte le combat.
  await card.getByRole("button", { name: "Renvoyer" }).click();
  await expect(combatant(gmPage, "Hedwige")).toHaveCount(0);
  await expect(carolPage.getByRole("button", { name: "Invoquer un familier" })).toBeVisible();
});

test("la forme sauvage d'un druide", async ({ signedInPage: gmPage, account, openAs }) => {
  const table = await prepareTable(account);
  const dana = await createTestUser("Dana");
  const sylve = await createDndCharacter(dana, "Sylve", { preset: "druid", level: 2 });
  await addPlayer(table.campaignId, dana, sylve);
  await addParticipant(table.campaignId, table.adventureId, dana, sylve);

  // Les formes se choisissent sur la fiche (crayon « Formes sauvages »), pas en jeu.
  const danaPage = await openAs(dana);
  await danaPage.goto(`/characters/${sylve}`);
  await danaPage.getByRole("tab", { name: /Formes sauvages/ }).click();
  await expect(danaPage.getByText("Aucune forme choisie")).toBeVisible();
  await danaPage.getByRole("button", { name: "Modifier : Formes sauvages" }).click();
  const panel = danaPage.getByRole("dialog", { name: "Formes sauvages" });
  await expect(panel.getByText("Chouette", { exact: true })).toHaveCount(0);
  await panel.getByText("Loup", { exact: true }).click();
  await panel.getByText("Chat", { exact: true }).click();
  await panel.getByRole("button", { name: "Terminé" }).click();
  await danaPage.getByRole("button", { name: "Enregistrer", exact: true }).click();
  // The sheet's sections are tabs inside « Jeu »: the section's own panel.
  await expect(danaPage.getByRole("tabpanel", { name: "Formes sauvages" })).toContainText("Loup");

  await startSession(gmPage, table);
  await joinSession(danaPage, table);
  const card = danaPage.getByRole("region", { name: "Forme sauvage" });
  // En jeu, la carte liste les formes et renvoie à la fiche pour en changer.
  await expect(card.getByRole("link", { name: /Formes connues \(2\/4\)/ })).toBeVisible();

  // Se transformer : une utilisation, le niveau en PV temporaires, la CA de la bête.
  await expect(card).toContainText("2 utilisations restantes");
  await card.getByRole("button", { name: "Se transformer en Loup" }).click();
  await expect(card).toContainText("Sous forme de Loup");
  await expect(card).toContainText("1 utilisation restante");
  await expect(card.getByRole("button", { name: "Lancer Morsure" })).toBeVisible();
  await expect(gmPage.getByRole("button", { name: /Sylve.*Loup/ })).toBeVisible();

  await card.getByRole("button", { name: "Reprendre ma forme" }).click();
  await expect(card).not.toContainText("Sous forme de Loup");
  await expect(gmPage.getByRole("button", { name: /Sylve.*Loup/ })).toHaveCount(0);
});

test("l'échelle se mesure sur le lieu ; la grille est un choix de chacun", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);

  // Sur la page de l'aventure, le MJ mesure la carte (800 × 600, cases de
  // 100 px) : deux points à 200 px l'un de l'autre valent 3 m.
  await gmPage.goto(table.adventurePath);
  await gmPage
    .locator("div.rounded-md")
    .filter({ has: gmPage.getByText("Le portail", { exact: true }) })
    .getByRole("button", { name: "Modifier" })
    .click();
  const dialog = gmPage.getByRole("dialog", { name: "Lieu" });
  const preview = dialog.locator("#location-scale-preview");
  await expect(preview.locator("img")).toHaveJSProperty("complete", true);
  const box = (await preview.boundingBox())!;
  await preview.click({ position: { x: box.width * 0.1, y: box.height / 2 } });
  await preview.click({ position: { x: box.width * 0.35, y: box.height / 2 } });
  await dialog.getByRole("textbox", { name: "Distance entre les points" }).fill("3");
  await expect(dialog.locator("#location-scale-result")).toHaveText(
    "≈ 8 cases de 1,5 m sur la largeur",
  );
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();

  await startSession(gmPage, table);
  await showLocation(gmPage, "Le portail");
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);

  // Un combat : Thorin (M) et un gobelin (P) sur la carte.
  await gmTab(gmPage, "Combat");
  await gmPage.getByRole("button", { name: "Lancer le combat" }).click();
  const setup = gmPage.getByRole("dialog", { name: "Créer un combat" });
  const miraRow = setup.getByRole("spinbutton", { name: "Initiative de Mira" }).locator("..");
  await miraRow.getByRole("checkbox").uncheck();
  await setup.getByRole("button", { name: "Ajouter un ennemi" }).click();
  await gmPage.getByRole("menuitem", { name: /^Gobelin/ }).click();
  await setup.getByRole("button", { name: "Lancer le combat" }).click();
  await expect(setup).toBeHidden();

  // Pas de grille par défaut ; le joueur l'affiche chez lui seulement.
  const bobGrid = bobPage.locator("#session-map-grid");
  const gmGrid = gmPage.locator("#session-map-grid");
  await expect(bobPage.locator('[id^="session-token-"]').first()).toBeVisible();
  await expect(bobGrid).toHaveCount(0);
  await bobPage.getByRole("button", { name: "Actions de la carte" }).click();
  await bobPage.getByRole("menuitemcheckbox", { name: "Afficher la grille" }).click();
  await expect(bobGrid).toBeVisible();
  await expect(gmGrid).toHaveCount(0);

  // Un pion d'environ une case : la carte en fait 8 de large.
  const map = await bobGrid.boundingBox();
  const token = bobPage.locator('[id^="session-token-"]').first();
  await expect
    .poll(async () => Math.round(((await token.boundingBox())?.width ?? 0) / (map!.width / 8)))
    .toBe(1);

  // Le MJ a la sienne, et le joueur peut masquer la sienne.
  await gmPage.getByRole("button", { name: "Actions de la carte" }).click();
  await gmPage.getByRole("menuitemcheckbox", { name: "Afficher la grille" }).click();
  await expect(gmGrid).toBeVisible();
  await bobPage.keyboard.press("Escape");
  await bobPage.getByRole("button", { name: "Actions de la carte" }).click();
  await bobPage.getByRole("menuitemcheckbox", { name: "Afficher la grille" }).click();
  await expect(bobGrid).toHaveCount(0);
  await expect(gmGrid).toBeVisible();
});

test("le moine : le dé d'arts martiaux et les capacités qui le reprennent", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  const dana = await createTestUser("Dana");
  const kai = await createDndCharacter(dana, "Kai", {
    preset: "monk",
    level: 10,
    subclassId: "monk:credo-de-la-paume",
  });
  await addPlayer(table.campaignId, dana, kai);
  await addParticipant(table.campaignId, table.adventureId, dana, kai);

  // Sur la fiche, le dé du niveau et les jets calculés (Sagesse +2, niveau 10).
  const danaPage = await openAs(dana);
  await danaPage.goto(`/characters/${kai}`);
  await danaPage.getByRole("tab", { name: "Capacités" }).click();
  const features = danaPage.getByRole("tabpanel", { name: "Capacités" });
  await expect(features.getByRole("term").filter({ hasText: "Arts martiaux" })).toBeVisible();
  await expect(features.getByRole("definition").filter({ hasText: /^d8$/ })).toBeVisible();
  await expect(features).toContainText("Métabolisme surnaturel");
  await expect(features).toContainText("1d8 + 10 PV");
  await expect(features).toContainText("Défense patiente : 2d8 PV temp.");
  await expect(features).toContainText("1d8 + 2 PV");

  // En jeu : Défense patiente prend un point de Credo et donne des PV temporaires.
  await startSession(gmPage, table);
  await joinSession(danaPage, table);
  await danaPage.getByRole("tab", { name: "Actions" }).click();
  await expect(danaPage.getByText("1 point · Credo du Moine")).toBeVisible();

  // La frappe à mains nues en action bonus (arts martiaux : d8 au niveau 10).
  const bonusStrike = danaPage.getByRole("button", { name: /Frappe à mains nues.*Action bonus/ });
  await expect(bonusStrike).toBeVisible();
  await bonusStrike.click();
  const strike = danaPage.getByRole("dialog");
  await strike.getByRole("button", { name: /^Lancer d20/ }).click();
  await strike.getByRole("button", { name: /^Touché/ }).click();
  await expect(strike.getByRole("button", { name: /^Lancer 1d8/ })).toBeVisible();
  await danaPage.keyboard.press("Escape");
  await danaPage.getByRole("button", { name: "Utiliser Défense patiente" }).click();
  const roll = danaPage.getByRole("dialog");
  await roll.getByRole("button", { name: /^Lancer 2d8/ }).click();
  await roll.getByRole("button", { name: "OK" }).click();
  await expect(
    danaPage.getByRole("button", { name: /PV temporaires : ([2-9]|1[0-6])$/ }),
  ).toBeVisible();
});
