/**
 * Scénario 5 — L'assistant de création 5E, avec un compte : un guerrier de
 * bout en bout, puis un magicien enregistré en brouillon et repris.
 */
import { charactersOf } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { Wizard } from "./support/wizard";

test("crée un guerrier en passant par chaque étape", async ({ signedInPage: page, account }) => {
  const wizard = new Wizard(page);
  await wizard.open();
  await wizard.createFighter("Brunhild");

  // La relecture montre la fiche telle qu'elle sera enregistrée.
  await expect(page.getByRole("heading", { name: "Brunhild", level: 2 })).toBeVisible();
  await expect(page.getByText("Nain · Guerrier · niv. 1 · Soldat")).toBeVisible();
  await expect(page.getByText("Prêt pour l'aventure")).toBeVisible();
  // Guerrier d10 + CON +2, et +1 de « Ténacité naine ».
  await expect(page.getByTitle("Points de vie max")).toContainText("13");
  await page.getByRole("tab", { name: "Équipement" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Bougie" })).toBeVisible();

  await wizard.validate();
  await expect(page.getByText("Personnage créé.")).toBeVisible();
  await expect(page).toHaveURL(/\/characters$/);
  await expect(page.getByText("Nain · Guerrier · niv. 1")).toBeVisible();

  // La fiche s'ouvre depuis la liste.
  await page.getByRole("link", { name: /Brunhild/ }).click();
  await expect(page.getByRole("heading", { name: /Brunhild/ }).first()).toBeVisible();

  const [stored] = await charactersOf(account.uid);
  expect(stored).toMatchObject({
    name: "Brunhild",
    system: "dnd2024",
    classId: "fighter",
    level: 1,
    alignment: expect.anything(),
  });
});

test("bloque une étape tant que le choix n'est pas fait", async ({ signedInPage: page }) => {
  const wizard = new Wizard(page);
  await wizard.open();

  // Sans classe choisie, rien ne permet d'avancer, et les étapes suivantes sont fermées.
  await expect(wizard.nextButton()).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2 Espèce" })).toBeDisabled();

  await wizard.chooseCard("Guerrier");
  await page.getByRole("textbox", { name: "Nom du personnage" }).fill("Brunhild");
  await wizard.next();
  await wizard.nextButton().click();
  await expect(
    page.getByRole("paragraph").filter({ hasText: "choisissez 2 éléments (0 sur 2)" }),
  ).toBeVisible();
  await wizard.expectQuestion("Quelles 2 compétences maîtrisez-vous ?");
});

test("enregistre un magicien en brouillon puis le reprend", async ({
  signedInPage: page,
  account,
}) => {
  const wizard = new Wizard(page);
  await wizard.open();
  await wizard.chooseCard("Magicien");
  await page.getByRole("textbox", { name: "Nom du personnage" }).fill("Elminster");
  await wizard.next();
  await wizard.choose("Arcanes");
  await wizard.choose("Histoire");
  await wizard.next();
  await wizard.choose("Paquetage");
  await wizard.next();

  // Les sorts : deux mains à remplir.
  await wizard.expectQuestion("Quels sorts emportez-vous ?");
  for (const cantrip of ["Trait de feu", "Rayon de givre", "Main du mage"]) {
    await wizard.chooseContaining(cantrip);
  }
  await expect(page.getByText("Votre main · 3 / 3")).toBeVisible();
  for (const spell of ["Projectile magique", "Armure du mage", "Sommeil", "Bouclier"]) {
    await wizard.chooseContaining(spell);
  }
  await expect(page.getByText("Votre main · 4 / 4")).toBeVisible();

  await wizard.saveDraft();
  await expect(page.getByText("Brouillon enregistré.")).toBeVisible();
  const [draft] = await charactersOf(account.uid);
  expect(draft).toMatchObject({ name: "Elminster", status: "draft", classId: "wizard" });

  // Le brouillon apparaît dans la liste et rouvre l'assistant.
  await page.goto("/characters");
  await expect(page.getByText("Brouillon · 5E (2024)")).toBeVisible();
  await page.getByRole("link", { name: /Elminster/ }).click();
  await expect(page).toHaveURL(/\/characters\/.+\/edit$/);
  await expect(page.getByRole("button", { name: "Nom et niveau Elminster" })).toBeVisible();
  // La classe est gardée : « Suivant » mène directement au nom.
  await wizard.next();
  await wizard.expectQuestion("Comment s'appelle votre personnage ?");
  await expect(page.getByRole("textbox", { name: "Nom du personnage" })).toHaveValue("Elminster");
});

test("les autres méthodes de caractéristiques", async ({ signedInPage: page }) => {
  const wizard = new Wizard(page);
  await wizard.open();
  await wizard.fighterClassStep("Brunhild");
  await wizard.dwarfSoldierOrigin();
  const main = page.getByRole("main");

  // Achat de points : 27 points, pas un de plus.
  await wizard.choose("Achat de points");
  await wizard.next();
  const raise = async (ability: string, times: number) => {
    for (let i = 0; i < times; i++) {
      await page.getByRole("button", { name: `Monter ${ability}` }).click();
    }
  };
  await raise("Force", 7); // 15
  await raise("Constitution", 6); // 14
  await raise("Dextérité", 5); // 13
  await raise("Sagesse", 4); // 12
  await raise("Charisme", 2); // 10
  await expect(main).toContainText("27 / 27 points");
  await raise("Intelligence", 1);
  await expect(main).toContainText("28 / 27 points");
  await wizard.nextButton().click();
  await expect(page.getByText("Achat de points : 28 / 27, budget dépassé.").first()).toBeVisible();
  await page.getByRole("button", { name: "Baisser Intelligence" }).click();
  await wizard.next();
  await wizard.expectQuestion("Où vont les bonus de votre historique ?");

  // Lancers de dés : six jets, six jetons à placer.
  await wizard.back();
  await wizard.back();
  await wizard.choose("Lancers de dés");
  await wizard.next();
  const roll = page.getByRole("button", { name: "Lancer 4d6" });
  for (let i = 0; i < 6; i++) await roll.click();
  await expect(roll).toBeDisabled();
  await expect(main).toContainText("6 / 6");
  for (const ability of [
    "Force",
    "Dextérité",
    "Constitution",
    "Intelligence",
    "Sagesse",
    "Charisme",
  ]) {
    await main.getByRole("button", { name: /^\d+$/ }).first().click();
    await wizard.choose(ability);
  }
  await wizard.next();
  await wizard.expectQuestion("Où vont les bonus de votre historique ?");

  // Saisie libre : des valeurs recopiées d'une fiche papier.
  await wizard.back();
  await wizard.back();
  await wizard.choose("Saisie libre");
  await wizard.next();
  const scores = {
    Force: "16",
    Dextérité: "12",
    Constitution: "15",
    Intelligence: "9",
    Sagesse: "11",
    Charisme: "10",
  };
  for (const [ability, value] of Object.entries(scores)) {
    await page.getByRole("spinbutton", { name: ability }).fill(value);
  }
  await wizard.next();
  await wizard.soldierBonuses();
  // Le résumé du panneau de gauche suit : 16 + 2.
  await expect(page.getByRole("complementary").first()).toContainText(/FOR\s*18/);
});
