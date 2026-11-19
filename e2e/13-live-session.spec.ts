/**
 * Scénario 13 — La session en direct, côté MJ et côté joueurs : démarrer,
 * rejoindre, montrer un lieu, l'horloge, les dés, la fiche du joueur, les
 * onglets détachés, puis terminer la session.
 */
import { addCodexEntry, addEnemy, addLocation, createAdventure } from "./support/data";
import { adminDb, readDocAs } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { gmTab, joinSession, prepareTable, showLocation, startSession } from "./support/table";

test("le MJ démarre la session et les joueurs la rejoignent", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);

  const bobPage = await openAs(table.bob);
  await bobPage.goto(table.adventurePath);
  await expect(bobPage.getByRole("link", { name: /En direct — rejoindre/ })).toHaveCount(0);

  await startSession(gmPage, table);
  // Le MJ voit la table : chaque participant avec ses PV.
  await expect(gmPage.getByRole("button", { name: /Thorin 13\/13/ })).toBeVisible();
  await expect(gmPage.getByRole("button", { name: /Mira 9\/9/ })).toBeVisible();
  await expect(gmPage.getByRole("tab", { name: "Scène" })).toHaveAttribute("aria-selected", "true");
  await expect(gmPage.getByText("Carte du lieu — aucun lieu sélectionné par le MJ.")).toBeVisible();

  // Le bouton « rejoindre » apparaît chez le joueur sans recharger.
  await joinSession(bobPage, table);
  await expect(
    bobPage.getByRole("button", { name: /Consulter la fiche de personnage/ }),
  ).toContainText("Thorin");
  // Les autres joueurs sont en lecture seule, et aucun outil du MJ.
  await expect(bobPage.getByText("Mira").first()).toBeVisible();
  await expect(bobPage.getByRole("button", { name: "Lancer le combat" })).toHaveCount(0);
  await expect(bobPage.getByRole("tab", { name: "Récit" })).toHaveCount(0);
  await expect(bobPage.getByRole("button", { name: "Avancer de 30 minutes" })).toHaveCount(0);

  await gmPage.getByRole("button", { name: "En direct" }).click();
  await expect(gmPage.getByRole("menu").getByText("2 connecté(s)")).toBeVisible();
});

test("lieu, horloge et dés : ce que fait le MJ, les joueurs le voient", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);

  await showLocation(gmPage, "Le portail");
  for (const page of [gmPage, bobPage]) {
    await expect(page.getByRole("img", { name: "Carte du lieu" })).toBeVisible();
    await expect(page.getByText("Le portail", { exact: true }).first()).toBeVisible();
  }

  // L'horloge : réglée sur la carte (sans − / +), avancée depuis l'onglet Scène.
  await expect(
    gmPage.locator("#session-stage").getByRole("button", { name: "Avancer de 30 minutes" }),
  ).toHaveCount(0);
  await gmPage.getByRole("button", { name: "Régler le jour et l'heure" }).click();
  await gmPage.getByRole("textbox", { name: "Heure" }).fill("09:30");
  await gmPage.keyboard.press("Enter");
  await expect(bobPage.getByText("09:30", { exact: true })).toBeVisible();
  const clock = gmPage.locator("#gm-scene-clock");
  await clock.getByRole("button", { name: "+10 min" }).click();
  await expect(bobPage.getByText("09:40", { exact: true })).toBeVisible();

  // Passé minuit, le jour avance.
  await expect(bobPage.getByText("Jour 1", { exact: true })).toBeVisible();
  await gmPage.getByRole("button", { name: "Régler le jour et l'heure" }).click();
  await gmPage.getByRole("textbox", { name: "Heure" }).fill("23:45");
  await gmPage.keyboard.press("Enter");
  await expect(clock.getByText("Jour 1 · 23:45")).toBeVisible();
  await clock.getByRole("button", { name: "+1 h" }).click();
  await expect(bobPage.getByText("Jour 2", { exact: true })).toBeVisible();
  await expect(bobPage.getByText("00:45", { exact: true })).toBeVisible();

  // Les dés (onglet Combat) : 2d6 donnent un total entre 2 et 12.
  await gmTab(gmPage, "Combat");
  await gmPage.getByRole("button", { name: "d6", exact: true }).click();
  await gmPage.getByRole("button", { name: "Un dé de plus" }).click();
  await gmPage.getByRole("button", { name: "Lancer 2d6" }).click();
  await expect(gmPage.getByText("Choisissez un dé et lancez.")).toHaveCount(0);

  // Le joueur a aussi ses dés : le bouton ouvre un jet libre.
  await bobPage.getByRole("button", { name: "Lancer des dés" }).click();
  await expect(bobPage.getByRole("button", { name: /^Lancer d20/ })).toBeVisible();
});

test("chacun zoome sur la carte sans changer la vue des autres", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);
  await showLocation(gmPage, "Le portail");

  const bobMap = bobPage.getByRole("img", { name: "Carte du lieu" });
  await expect(bobMap).toBeVisible();
  await expect(bobPage.getByRole("button", { name: "Dézoomer" })).toBeDisabled();

  await bobPage.getByRole("button", { name: "Zoomer", exact: true }).click();
  await bobPage.getByRole("button", { name: "Zoomer", exact: true }).click();
  await expect(bobMap).toHaveAttribute("style", /scale\(1\.56/);
  // Le MJ garde sa vue.
  await expect(gmPage.getByRole("img", { name: "Carte du lieu" })).not.toHaveAttribute(
    "style",
    /scale/,
  );

  await bobPage.getByRole("button", { name: "Ajuster à l'écran" }).click();
  await expect(bobMap).not.toHaveAttribute("style", /scale/);
});

test("le MJ pose les pions depuis « Scène » et les supprime sur la carte", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);
  await showLocation(gmPage, "Le portail");
  const bobTokens = bobPage.locator('[id^="session-token-"]');
  await expect(bobPage.getByRole("img", { name: "Carte du lieu" })).toBeVisible();
  await expect(bobTokens).toHaveCount(0);

  // « Scène » → « Pions sur la carte » : Thorin, puis Mira, même hors combat.
  const tokens = gmPage.locator("#gm-scene-tokens");
  await expect(tokens).toContainText("Aucun pion sur la carte.");
  await tokens.getByRole("button", { name: "Ajouter un pion" }).click();
  await gmPage.getByRole("menuitem", { name: "Thorin" }).click();
  await expect(tokens).toContainText("Thorin");
  await tokens.getByRole("button", { name: "Ajouter un pion" }).click();
  await expect(gmPage.getByRole("menuitem", { name: "Thorin" })).toHaveCount(0);
  await gmPage.getByRole("menuitem", { name: "Mira" }).click();
  await expect(bobTokens).toHaveCount(2);

  // Le menu ⋮ de la carte ne refait pas ce que « Scène » fait déjà.
  await gmPage.getByRole("button", { name: "Actions de la carte" }).click();
  await expect(gmPage.getByRole("menuitemcheckbox", { name: "Thorin" })).toHaveCount(0);
  await expect(gmPage.getByRole("menuitemradio")).toHaveCount(0);
  await gmPage.keyboard.press("Escape");

  // Un clic sur un pion : « Supprimer le pion » — il quitte la partie, pas seulement la carte.
  await gmPage.locator('[id^="session-token-"]').filter({ hasText: "TH" }).click();
  await gmPage.getByRole("button", { name: "Supprimer le pion" }).click();
  await expect(bobTokens).toHaveCount(1);
  await expect(bobTokens.filter({ hasText: "TH" })).toHaveCount(0);
  await expect(tokens).not.toContainText("Thorin");
  const sessionPath = new URL(gmPage.url()).pathname.replace(/^\//, "").split("/");
  const combatants = await adminDb
    .collection(
      `campaigns/${sessionPath[1]}/adventures/${sessionPath[3]}/liveSessions/${sessionPath[5]}/combatants`,
    )
    .get();
  expect(combatants.docs.map((d) => d.data().name)).toEqual(["Mira"]);

  // Et « Ajouter un pion » le repose.
  await tokens.getByRole("button", { name: "Ajouter un pion" }).click();
  await gmPage.getByRole("menuitem", { name: "Thorin" }).click();
  await expect(bobTokens).toHaveCount(2);
});

test("le joueur tient sa fiche pendant la session", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);

  // Ses PV : le MJ les voit changer.
  await bobPage.getByRole("button", { name: "Retirer 1 PV", exact: true }).click();
  await bobPage.getByRole("button", { name: "Retirer 1 PV", exact: true }).click();
  await expect(gmPage.getByRole("button", { name: /Thorin 11\/13/ })).toBeVisible();
  // Les PV temporaires se règlent à part ; le − des PV les entame d'abord.
  await bobPage.getByRole("button", { name: "PV temporaires : 0" }).click();
  await bobPage.getByRole("button", { name: "Ajouter 1 PV temporaire" }).click();
  await expect(bobPage.getByRole("button", { name: "Retirer 1 PV temporaire" })).toBeEnabled();
  await bobPage.keyboard.press("Escape");
  await bobPage.getByRole("button", { name: "Retirer 1 PV", exact: true }).click();
  await expect(bobPage.getByRole("button", { name: "PV temporaires : 0" })).toBeVisible();
  await expect(gmPage.getByRole("button", { name: /Thorin 11\/13/ })).toBeVisible();
  await bobPage.getByRole("button", { name: "Inspiration héroïque" }).click();
  await expect(bobPage.getByRole("button", { name: "Inspiration héroïque" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Un dé de vie dépensé ouvre son jet de soins, déjà rempli.
  await bobPage.getByRole("button", { name: "Dépenser un dé de vie" }).click();
  await expect(bobPage.getByRole("button", { name: /^Lancer 1d/ })).toBeVisible();
  await bobPage.keyboard.press("Escape");
  await expect(bobPage.getByRole("button", { name: "Récupérer un dé de vie" })).toBeEnabled();

  // Son sac.
  await bobPage.getByRole("tab", { name: "Sac" }).click();
  await bobPage.getByRole("button", { name: "Ajouter au sac" }).click();
  await bobPage
    .getByRole("dialog", { name: "Ajouter au sac" })
    .getByRole("button", { name: "Objet" })
    .click();
  const item = bobPage.getByRole("dialog", { name: "Nouvel objet" });
  await item.getByPlaceholder("Corde de chanvre (15 m)").fill("Lanterne sourde");
  await item.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(bobPage.getByText("Lanterne sourde")).toBeVisible();

  // Sa bourse : une somme reçue, puis une dépense qui fait rendre la monnaie.
  const purse = bobPage.locator("#player-bag-purse");
  await purse.getByRole("button", { name: "Ajouter à la bourse" }).click();
  let sum = bobPage.getByRole("dialog", { name: "Ajouter à la bourse" });
  await sum.getByRole("spinbutton", { name: "Pièces d'or" }).fill("50");
  await sum.getByRole("spinbutton", { name: "Pièces d'argent" }).fill("5");
  await expect(sum).toContainText("65 po · 5 pa");
  await sum.getByRole("button", { name: "Valider" }).click();
  await expect(purse).toContainText("65 po · 5 pa");
  await purse.getByRole("button", { name: "Retirer de la bourse" }).click();
  sum = bobPage.getByRole("dialog", { name: "Retirer de la bourse" });
  await sum.getByRole("spinbutton", { name: "Pièces d'argent" }).fill("6");
  await sum.getByRole("button", { name: "Valider" }).click();
  await expect(purse).toContainText("64 po · 9 pa");

  // Ses notes, gardées d'un chargement à l'autre.
  await bobPage.getByRole("tab", { name: "Notes" }).click();
  await bobPage.getByPlaceholder("Notes de session…").fill("Le gobelin a une clé.");
  await bobPage.waitForTimeout(1_500); // enregistrement différé
  await bobPage.reload();
  await bobPage.getByRole("tab", { name: "Notes" }).click();
  await expect(bobPage.getByPlaceholder("Notes de session…")).toHaveValue("Le gobelin a une clé.");
  await expect(bobPage.getByText("Lanterne sourde")).toHaveCount(0); // onglet Notes
});

test("les onglets détachés : carte, projection et vue du joueur", async ({
  signedInPage: gmPage,
  account,
  openAs,
  context,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  await showLocation(gmPage, "Le portail");

  // La carte du MJ dans son propre onglet : la page principale la retire.
  await gmPage.getByRole("button", { name: "Actions de la carte" }).click();
  const [mapTab] = await Promise.all([
    context.waitForEvent("page"),
    gmPage.getByRole("menuitem", { name: "Carte (MJ)" }).click(),
  ]);
  await expect(mapTab.getByRole("img", { name: "Carte du lieu" })).toBeVisible();
  await expect(gmPage.getByText("Carte ouverte dans un autre onglet")).toBeVisible();
  await mapTab.close();
  await expect(gmPage.getByRole("img", { name: "Carte du lieu" })).toBeVisible();

  // La projection, en lecture seule, pour la TV.
  await gmPage.getByRole("button", { name: "Actions de la carte" }).click();
  const [projection] = await Promise.all([
    context.waitForEvent("page"),
    gmPage.getByRole("menuitem", { name: "Projeter la carte" }).click(),
  ]);
  await expect(projection.getByRole("img", { name: "Carte du lieu" })).toBeVisible();
  await expect(projection.getByRole("button", { name: "Plein écran" })).toBeVisible();
  await expect(projection.getByRole("tab", { name: "Combat" })).toHaveCount(0);
  await expect(gmPage.getByText("Projection en cours")).toBeVisible();

  // Le joueur, sur son téléphone, masque la carte.
  const bobPage = await openAs(table.bob);
  await bobPage.setViewportSize({ width: 390, height: 844 });
  await joinSession(bobPage, table);
  await bobPage.getByRole("button", { name: "Actions de la carte" }).click();
  await bobPage.getByRole("menuitemcheckbox", { name: "Afficher la carte sur cet écran" }).click();
  await expect(bobPage.getByRole("img", { name: "Carte du lieu" })).toHaveCount(0);
  await bobPage.getByRole("button", { name: "Afficher la carte" }).click();
  await expect(bobPage.getByRole("img", { name: "Carte du lieu" })).toBeVisible();

  // Le joueur projette aussi la carte (sur l'écran de la pièce), puis joue
  // d'un autre appareil : sa projection n'invite pas à revenir à la vue complète.
  await bobPage.getByRole("button", { name: "Actions de la carte" }).click();
  const [bobProjection] = await Promise.all([
    bobPage.context().waitForEvent("page"),
    bobPage.getByRole("menuitem", { name: "Projeter la carte" }).click(),
  ]);
  await expect(bobProjection.getByRole("img", { name: "Carte du lieu" })).toBeVisible();
  await expect(bobProjection.getByRole("button", { name: "Plein écran" })).toBeVisible();
  await bobPage.close();
  await bobProjection.waitForTimeout(6_000); // relevé des onglets + délai de grâce
  await expect(bobProjection.getByText("La vue principale est fermée.")).toHaveCount(0);
  await expect(bobProjection.getByRole("img", { name: "Carte du lieu" })).toBeVisible();
});

test("terminer la session", async ({ signedInPage: gmPage, account, openAs }) => {
  const table = await prepareTable(account);
  const other = await createAdventure(table.campaignId, account, "Le puits", "upcoming");
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);

  // Une seule session à la fois dans la campagne.
  await gmPage.goto(`/campaigns/${table.campaignId}/adventures/${other}`);
  await gmPage.getByRole("button", { name: "Démarrer la session" }).click();
  await expect(
    gmPage.getByText("Terminez d'abord l'aventure « L'entrée » avant d'en démarrer une autre."),
  ).toBeVisible();
  await gmPage.goto(table.adventurePath);
  await gmPage.getByRole("link", { name: /En direct — rejoindre/ }).click();

  await gmPage.getByRole("button", { name: "En direct" }).click();
  await gmPage.getByRole("menuitem", { name: "Terminer la session" }).click();
  const confirm = gmPage.getByRole("dialog", { name: "Terminer la session ?" });
  await confirm.getByRole("button", { name: "Terminer la session" }).click();

  // Le MJ revient à l'aventure ; le joueur est prévenu.
  await expect(gmPage).toHaveURL(new RegExp(`${table.adventurePath}$`));
  await expect(gmPage.getByRole("button", { name: "Démarrer la session" })).toBeVisible();
  await expect(bobPage.getByRole("dialog", { name: "Session terminée" })).toBeVisible();
  await bobPage.goto(table.adventurePath);
  await expect(bobPage.getByRole("link", { name: /En direct — rejoindre/ })).toHaveCount(0);
});

test("la brume d'un lieu caché : gomme et pinceau du MJ", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  await showLocation(gmPage, "La crypte");
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);
  await expect(bobPage.getByRole("img", { name: "Carte du lieu" })).toBeVisible();
  // Les outils de brume sont au MJ seul.
  await expect(bobPage.getByRole("button", { name: /Gomme/ })).toHaveCount(0);

  const sessionPath = new URL(gmPage.url()).pathname.replace(/^\//, "").split("/");
  const reveals = adminDb.collection(
    `campaigns/${sessionPath[1]}/adventures/${sessionPath[3]}/liveSessions/${sessionPath[5]}/mapReveals`,
  );
  const mask = async () => (await reveals.get()).docs[0]?.data().mask as string | undefined;

  const map = gmPage.getByRole("img", { name: "Carte du lieu" });
  async function stroke() {
    const box = (await map.boundingBox())!;
    await gmPage.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await gmPage.mouse.down();
    await gmPage.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 10 });
    await gmPage.mouse.up();
  }

  // La gomme révèle une bande de la carte.
  const eraser = gmPage.getByRole("button", { name: "Gomme (révéler à la main)" });
  await eraser.click();
  await expect(eraser).toHaveAttribute("aria-pressed", "true");
  await expect(gmPage.getByText("Rayon", { exact: true })).toBeVisible();
  await stroke();
  await expect.poll(mask).toBeTruthy();
  const revealed = await mask();

  // Le pinceau la recouvre.
  await gmPage.getByRole("button", { name: "Brume de combat (re-cacher à la main)" }).click();
  await expect(eraser).toHaveAttribute("aria-pressed", "false");
  await stroke();
  await expect.poll(mask).not.toBe(revealed);

  // Rendu visible, le lieu n'a plus de brume ni d'outils.
  await gmPage.locator("#gm-scene-location").getByRole("button", { name: "Brouillard" }).click();
  await expect(
    gmPage.locator("#gm-scene-location").getByRole("button", { name: "Visible" }),
  ).toBeVisible();
  await expect(eraser).toHaveCount(0);
});

test("le panneau du MJ dans un onglet, puis la vue complète reprise", async ({
  signedInPage: gmPage,
  account,
  context,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);

  await gmPage.getByRole("button", { name: "Actions de la carte" }).click();
  const [panel] = await Promise.all([
    context.waitForEvent("page"),
    gmPage.getByRole("menuitem", { name: "Panneau du MJ" }).click(),
  ]);
  await expect(panel.getByRole("tab", { name: "Récit" })).toBeVisible();
  // La page principale laisse le panneau à l'onglet.
  await expect(gmPage.getByRole("tab", { name: "Récit" })).toHaveCount(0);

  // La page principale fermée, l'onglet propose de reprendre la vue complète.
  await gmPage.close({ runBeforeUnload: true });
  await panel.getByRole("button", { name: "Afficher la vue complète ici" }).click();
  await expect(panel.getByRole("button", { name: "En direct" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Actions de la carte" })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Récit" })).toBeVisible();
});

test("la fiche d'une magicienne : sorts, emplacements et détail d'un objet", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const carolPage = await openAs(table.carol);
  await joinSession(carolPage, table);
  await expect(carolPage.getByRole("main")).toContainText(/DD sorts\s*13/);

  // Le détail d'un objet du sac.
  await carolPage.getByRole("tab", { name: "Sac" }).click();
  await carolPage.getByRole("button", { name: "Dague", exact: true }).click();
  await expect(carolPage.getByRole("dialog", { name: "Dague" })).toBeVisible();
  await carolPage.keyboard.press("Escape");

  await carolPage.getByRole("tab", { name: "Sorts" }).click();
  for (const spell of ["Trait de feu", "Main du mage", "Projectile magique", "Sommeil"]) {
    await expect(carolPage.getByRole("button", { name: spell, exact: true })).toBeVisible();
  }
  // Un emplacement de niveau 1 dépensé.
  const slots = carolPage.getByRole("group", { name: "Emplacements de niveau 1 dépensés" });
  await expect(carolPage.getByText("2 / 2")).toBeVisible();
  await slots.getByRole("button").first().click();
  await expect(carolPage.getByText("1 / 2")).toBeVisible();

  // Lancer un sort dépense un emplacement, puis ouvre son jet.
  await carolPage.getByRole("button", { name: "Lancer Projectile magique" }).click();
  const cast = carolPage.getByRole("dialog", { name: "Projectile magique" });
  await expect(cast.getByRole("radio", { name: /^Niv\. 1/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await cast.getByRole("button", { name: "Lancer", exact: true }).click();
  await expect(carolPage.getByText("0 / 2")).toBeVisible();
  await expect(carolPage.getByRole("dialog", { name: "Projectile magique" })).toContainText("3d4");
  await carolPage.keyboard.press("Escape");

  // Le détail d'un sort.
  await carolPage.getByRole("button", { name: "Projectile magique", exact: true }).click();
  await expect(carolPage.getByRole("dialog")).toContainText("Projectile magique");
});

test("un joueur ne lit ni la description ni la carte d'un lieu caché", async ({
  signedInPage: gmPage,
  account,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const base = `campaigns/${table.campaignId}/adventures/${table.adventureId}`;
  const crypt = (
    await adminDb.collection(`${base}/locations`).where("name", "==", "La crypte").get()
  ).docs[0]!;
  await adminDb.doc(`${base}/locationSecrets/${crypt.id}`).update({ description: "Piège caché" });

  // Pendant la session, le joueur lit le doc public : ni carte ni description.
  const publicDoc = await readDocAs(table.bob, `${base}/locations/${crypt.id}`);
  expect(publicDoc.status).toBe(200);
  expect(publicDoc.fields).toHaveProperty("name");
  expect(publicDoc.fields).not.toHaveProperty("imageUrl");
  expect(publicDoc.fields).not.toHaveProperty("description");

  // La moitié MJ lui est fermée ; un lieu visible garde sa carte publique.
  expect((await readDocAs(table.bob, `${base}/locationSecrets/${crypt.id}`)).status).toBe(403);
  expect((await readDocAs(table.carol, `${base}/locationSecrets/${crypt.id}`)).status).toBe(403);
  const portal = (
    await adminDb.collection(`${base}/locations`).where("name", "==", "Le portail").get()
  ).docs[0]!;
  expect((await readDocAs(table.bob, `${base}/locations/${portal.id}`)).fields).toHaveProperty(
    "imageUrl",
  );
});

test("le MJ donne du butin : le joueur l'accepte ou le refuse", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);

  // Le MJ note une trouvaille, puis la donne à Thorin avec 30 po.
  await gmTab(gmPage, "Notes");
  await gmPage.getByPlaceholder("Épée elfique").fill("Clé rouillée");
  await gmPage.getByPlaceholder("Épée elfique").press("Enter");
  await gmPage.getByRole("button", { name: "Donner du butin" }).click();
  let give = gmPage.getByRole("dialog", { name: "Donner du butin" });
  await give.getByRole("combobox", { name: "À qui" }).click();
  await gmPage.getByRole("option", { name: "Thorin" }).click();
  await give.getByRole("button", { name: "Clé rouillée" }).click();
  await give.getByRole("spinbutton", { name: "Pièces d'or" }).fill("30");
  await give.getByRole("button", { name: "Donner" }).click();

  // Thorin l'accepte : la clé dans son sac, les pièces dans sa bourse.
  let offer = bobPage.getByRole("dialog", { name: "Le MJ vous donne…" });
  await expect(offer).toContainText("Clé rouillée");
  await expect(offer).toContainText("30 po");
  await offer.getByRole("button", { name: "Accepter" }).click();
  await expect(offer).toBeHidden();
  await bobPage.getByRole("tab", { name: "Sac" }).click();
  await expect(bobPage.locator("#player-bag-purse")).toContainText("45 po");
  await expect(bobPage.getByText("Clé rouillée")).toBeVisible();
  // Le MJ le voit, et le butin de la session dit qui l'a pris.
  await expect(gmPage.getByText("Thorin a accepté le butin.")).toBeVisible();
  await expect(gmPage.getByText("Clé rouillée → Thorin")).toBeVisible();

  // Une seconde offre, refusée.
  await gmPage.getByRole("button", { name: "Donner du butin" }).click();
  give = gmPage.getByRole("dialog", { name: "Donner du butin" });
  await give.getByRole("combobox", { name: "À qui" }).click();
  await gmPage.getByRole("option", { name: "Thorin" }).click();
  await give.getByRole("spinbutton", { name: "Pièces d'argent" }).fill("5");
  await give.getByRole("button", { name: "Donner" }).click();
  offer = bobPage.getByRole("dialog", { name: "Le MJ vous donne…" });
  await offer.getByRole("button", { name: "Refuser" }).click();
  await expect(gmPage.getByText("Thorin a refusé le butin.")).toBeVisible();
  await expect(bobPage.locator("#player-bag-purse")).not.toContainText("5 pa");
});

test("le MJ donne le butin prévu d'un ennemi et un objet du codex", async ({
  signedInPage: gmPage,
  account,
  openAs,
}) => {
  const table = await prepareTable(account);
  // Le butin prévu : sur un ennemi du lieu, et sur le lieu lui-même (côté secrets).
  const placeId = await addLocation(table.campaignId, table.adventureId, "Le puits", {
    order: 2,
    loot: { items: [{ name: "Corde", quantity: 1 }], money: { gold: 4 } },
  });
  await addEnemy(table.campaignId, table.adventureId, "Chef gobelin", {
    order: 1,
    locationId: placeId,
    loot: { items: [{ name: "Dague rouillée", quantity: 2 }], money: { gold: 30 } },
  });
  await addCodexEntry(table.campaignId, "Amulette de Garrick", {
    summary: "Une amulette ancienne.",
  });
  await startSession(gmPage, table);
  const bobPage = await openAs(table.bob);
  await joinSession(bobPage, table);
  await showLocation(gmPage, "Le puits");

  // Le butin prévu se donne d'un geste : « Où ? » prend le nom de l'ennemi.
  await gmTab(gmPage, "Notes");
  await gmPage.getByRole("button", { name: "Donner du butin" }).click();
  const give = gmPage.getByRole("dialog", { name: "Donner du butin" });
  await give.getByRole("combobox", { name: "À qui" }).click();
  await gmPage.getByRole("option", { name: "Thorin" }).click();
  await give.getByRole("button", { name: /^Chef gobelin · / }).click();
  await expect(give.getByRole("button", { name: /^Chef gobelin · / })).toBeHidden();
  await expect(give.getByText("Dague rouillée ×2")).toBeVisible();
  await expect(give.getByRole("spinbutton", { name: "Pièces d'or" })).toHaveValue("30");
  await expect(give.getByLabel("Trouvé où ?")).toHaveValue("Chef gobelin");
  // Le lieu aussi : ses pièces s'ajoutent à celles de l'ennemi.
  await give.getByRole("button", { name: /^Le puits · / }).click();
  await expect(give.getByRole("spinbutton", { name: "Pièces d'or" })).toHaveValue("34");

  // Un objet du codex, non révélé : il le sera une fois l'offre acceptée.
  await give.getByRole("combobox", { name: "Un objet du codex" }).click();
  await gmPage.getByRole("option", { name: /Amulette de Garrick/ }).click();
  await give.getByRole("button", { name: "Donner" }).click();

  const offer = bobPage.getByRole("dialog", { name: "Le MJ vous donne…" });
  await expect(offer).toContainText("Amulette de Garrick");
  await expect(offer).toContainText("Dague rouillée ×2");
  await expect(offer).toContainText("34 po");
  // Pas encore révélé tant que l'offre n'est pas acceptée.
  // Le lieu « Le puits » a aussi sa fiche de codex : on lit celle de l'amulette, par son nom.
  const entry = (await adminDb.collection(`campaigns/${table.campaignId}/codex`).get()).docs.find(
    (doc) => doc.data().name === "Amulette de Garrick",
  )!;
  expect(entry.data().revealed).toBe(false);
  await offer.getByRole("button", { name: "Accepter" }).click();
  await expect(offer).toBeHidden();
  await bobPage.getByRole("tab", { name: "Sac" }).click();
  await expect(bobPage.getByText("Amulette de Garrick")).toBeVisible();
  await expect(bobPage.getByText("Dague rouillée")).toBeVisible();
  await expect(bobPage.locator("#player-bag-purse")).toContainText("49 po");
  await expect.poll(async () => (await entry.ref.get()).data()?.revealed).toBe(true);
});
