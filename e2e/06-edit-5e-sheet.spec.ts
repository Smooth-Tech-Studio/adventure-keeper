/**
 * Scénario 6 — Modifier une fiche 5E : les panneaux au crayon (identité,
 * langues, équipement, histoire), les caractéristiques et les compétences du
 * menu « Modifier », les onglets de la fiche, et le changement d'espèce, qui
 * montre d'abord ce qu'il retire.
 */
import type { Page } from "@playwright/test";

import { createDndCharacter } from "./support/data";
import { adminDb } from "./support/emulator";
import { expect, test } from "./support/fixtures";
import { Wizard } from "./support/wizard";

async function stored(id: string) {
  return (await adminDb.doc(`characters/${id}`).get()).data()!;
}

async function openPanel(page: Page, name: string) {
  // Several blocks can open the same panel (weapons, armour, bag: « Équipement »).
  await page
    .getByRole("button", { name: `Modifier : ${name}` })
    .first()
    .click();
  const panel = page.getByRole("dialog", { name });
  await expect(panel).toBeVisible();
  return panel;
}

/** The « Modifier » menu: a change of class or origin, the abilities, the skills. */
async function openMenu(page: Page, item: string) {
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("les panneaux au crayon modifient la fiche", async ({ signedInPage: page, account }) => {
  const id = await createDndCharacter(account, "Thorin");
  await page.goto(`/characters/${id}`);
  await expect(page.getByText("Nain · Guerrier · niv. 1 · Soldat · Loyal Bon")).toBeVisible();

  // Identité : le nom (l'alignement passe par l'historique).
  let panel = await openPanel(page, "Identité");
  await expect(panel.getByRole("button", { name: /^Chaotique Bon/ })).toHaveCount(0);
  await panel.getByRole("textbox", { name: "Nom" }).fill("Thorin Poing-de-Fer");
  await panel.getByRole("button", { name: "Terminé" }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("heading", { name: /Thorin Poing-de-Fer/ })).toBeVisible();

  // Compétences, depuis le menu : Perception laisse la place à Survie.
  await expect(page.getByRole("button", { name: "Modifier : Compétences" })).toHaveCount(0);
  await openMenu(page, "Modifier les compétences");
  panel = page.getByRole("dialog", { name: "Compétences" });
  await panel.getByRole("button", { name: /^Perception/ }).click();
  await panel.getByRole("button", { name: /^Survie/ }).click();
  await panel.getByRole("button", { name: "Terminé" }).click();
  await expect(page.getByRole("button", { name: /^Survie \+3, maîtrisée/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Perception \+1, non maîtrisée/ })).toBeVisible();

  // Langues : le Gigant laisse la place à l'Orc (bloc Langues, onglet Capacités).
  await page.getByRole("tab", { name: "Capacités" }).click();
  panel = await openPanel(page, "Langues et outils");
  await panel.getByRole("button", { name: /^Gigant/ }).click();
  await panel.getByRole("button", { name: /^Orc/ }).click();
  await panel.getByRole("button", { name: "Terminé" }).click();
  await expect(panel).toBeHidden();

  // Rien n'est écrit avant « Enregistrer » ; la barre dit ce qui a changé.
  const bar = page.getByRole("status").filter({ hasText: "modifié" });
  await expect(bar).toContainText("3 blocs modifiés");
  expect((await stored(id)).name).toBe("Thorin");

  // « Annuler ce bloc » revient à la fiche enregistrée.
  panel = await openPanel(page, "Langues et outils");
  await panel.getByRole("button", { name: "Annuler ce bloc" }).click();
  await panel.getByRole("button", { name: "Terminé" }).click();
  await expect(bar).toContainText("2 blocs modifiés");

  await bar.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Fiche mise à jour.")).toBeVisible();
  await expect(bar).toBeHidden();
  await expect
    .poll(async () => {
      const sheet = await stored(id);
      return [sheet.name, sheet.alignment, sheet.skillProficiencies, sheet.languages];
    })
    .toEqual([
      "Thorin Poing-de-Fer",
      "LG",
      expect.arrayContaining(["acrobatics", "survival"]),
      ["elvish", "giant"],
    ]);

  // « Tout annuler » jette les modifications en cours.
  panel = await openPanel(page, "Identité");
  await panel.getByRole("textbox", { name: "Nom" }).fill("Nom provisoire");
  await panel.getByRole("button", { name: "Terminé" }).click();
  await bar.getByRole("button", { name: "Tout annuler" }).click();
  await expect(page.getByRole("heading", { name: /Thorin Poing-de-Fer/ })).toBeVisible();
});

test("les onglets de la fiche, l'équipement et l'histoire", async ({
  signedInPage: page,
  account,
}) => {
  const id = await createDndCharacter(account, "Thorin");
  await page.goto(`/characters/${id}`);

  await page.getByRole("tab", { name: "Capacités" }).click();
  for (const feature of ["Second souffle", "Ténacité naine", "Sauvagerie martiale"]) {
    await expect(page.getByRole("tabpanel").getByText(feature).first()).toBeVisible();
  }

  await page.getByRole("tab", { name: "Équipement" }).click();
  await expect(page.getByRole("tabpanel").getByText("Hache de guerre")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByText("15 po")).toBeVisible();

  await page.getByRole("tab", { name: "Histoire" }).click();
  await expect(page.getByText("Pas encore d'histoire.")).toBeVisible();
  const panel = await openPanel(page, "Histoire");
  await panel.getByRole("textbox").first().fill("Forgé dans les mines de Khaz-Dûm.");
  await panel.getByRole("button", { name: "Terminé" }).click();
  await page.getByRole("status").getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Fiche mise à jour.")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Histoire" }).click();
  await expect(page.getByText("Forgé dans les mines de Khaz-Dûm.")).toBeVisible();
});

test("changer d'espèce montre d'abord ce qui sera retiré", async ({
  signedInPage: page,
  account,
}) => {
  const id = await createDndCharacter(account, "Thorin");
  await page.goto(`/characters/${id}`);
  await openMenu(page, "Changer d'espèce");

  const wizard = new Wizard(page);
  await wizard.expectQuestion("De quelle espèce êtes-vous ?");
  await wizard.chooseCard("Halfelin");
  // L'écran d'impact : la case confirme le changement.
  await wizard.nextButton().click();
  await expect(
    page.getByText("Cochez la case pour confirmer ce changement.").first(),
  ).toBeVisible();
  await page.getByRole("checkbox").first().check();
  while (await wizard.nextButton().isVisible()) await wizard.next();

  // Only the species: its last screen saves.
  await expect(page.getByRole("button", { name: /Étape \d/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: /Appliquer les changements à Thorin/ });
  await confirm.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Fiche mise à jour.")).toBeVisible();
  await expect.poll(async () => (await stored(id)).speciesId).toBe("halfling");
});

test("l'équipement, la couleur, le portrait et les points de vie par niveau", async ({
  signedInPage: page,
  account,
}) => {
  const id = await createDndCharacter(account, "Thorin", { level: 3 });
  await page.goto(`/characters/${id}`);
  const bar = page.getByRole("status").filter({ hasText: "modifié" });

  // Un objet trouvé en route.
  await page.getByRole("tab", { name: "Équipement" }).click();
  let panel = await openPanel(page, "Équipement");
  await panel.getByRole("button", { name: "Ajouter un objet" }).click();
  const item = page.getByRole("dialog", { name: "Nouvel objet" });
  await item.getByRole("textbox", { name: "Nom" }).fill("Clé rouillée");
  await item.getByRole("textbox", { name: "Lore (optionnel)" }).fill("Trouvée sur le gobelin.");
  await item.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(panel.getByText("Clé rouillée")).toBeVisible();
  await panel.getByRole("button", { name: "Terminé" }).click();

  // La couleur et le portrait.
  panel = await openPanel(page, "Identité");
  await panel.getByRole("button", { name: "Couleur #3b82f6" }).click();
  await panel
    .getByRole("textbox", { name: "Portrait (lien)" })
    .fill("https://images.e2e.test/thorin.svg");
  await panel.getByRole("button", { name: "Terminé" }).click();

  // Le PV du niveau 2 : un jet de 10 plutôt que la moyenne de 6.
  await openMenu(page, "Modifier les caractéristiques");
  panel = page.getByRole("dialog", { name: "Caractéristiques" });
  await panel.getByRole("spinbutton", { name: "Jet du dé de vie, niveau 2" }).fill("10");
  await panel.getByRole("button", { name: "Terminé" }).click();

  await expect(bar).toContainText("3 blocs modifiés");
  await bar.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Fiche mise à jour.")).toBeVisible();

  await page.getByRole("tab", { name: "Équipement" }).click();
  await expect(page.getByRole("tabpanel").getByText("Clé rouillée")).toBeVisible();
  await expect
    .poll(async () => {
      const sheet = await stored(id);
      return [sheet.color, sheet.imageUrl, sheet.maxHitPoints];
    })
    // 31 avec la moyenne ; le jet de 10 en ajoute 4.
    .toEqual(["#3b82f6", "https://images.e2e.test/thorin.svg", 35]);
});

test("changer d'historique, puis de classe", async ({ signedInPage: page, account }) => {
  const id = await createDndCharacter(account, "Thorin", { level: 3 });
  const wizard = new Wizard(page);
  const apply = async () => {
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await page
      .getByRole("dialog", { name: /Appliquer les changements à Thorin/ })
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(page.getByText("Fiche mise à jour.")).toBeVisible();
  };

  // Soldat → Criminel : les bonus de caractéristiques se replacent.
  await page.goto(`/characters/${id}/rebuild?what=background`);
  await wizard.expectQuestion("Quelle vie meniez-vous avant l'aventure ?");
  await wizard.chooseCard("Criminel");
  await page.getByRole("checkbox", { name: /J'ai compris/ }).check();
  // The background's bonuses close the step, right before « Enregistrer ».
  while (await wizard.nextButton().isVisible()) await wizard.next();
  await wizard.expectQuestion("Où vont les bonus de votre historique ?");
  // The soldier's +2 sits on Force, which a criminal cannot raise: take it back.
  await wizard.choose("Force");
  // The +1 on Constitution is fine for a criminal too.
  await wizard.place("+2", "Dextérité");
  await apply();
  await expect.poll(async () => (await stored(id)).backgroundId).toBe("criminal");

  // Guerrier → Barbare : compétences, Savoir primal et voie à choisir.
  await page.goto(`/characters/${id}/rebuild?what=class`);
  await wizard.chooseCard("Barbare");
  await expect(page.getByRole("heading", { name: /Retiré de la fiche/ })).toBeVisible();
  await page.getByRole("checkbox", { name: /J'ai compris/ }).check();
  await wizard.next();
  await wizard.expectQuestion("Quelles 2 compétences maîtrisez-vous ?");
  await wizard.choose("Nature");
  await wizard.choose("Survie");
  while (await wizard.nextButton().isVisible()) {
    const question = (await wizard.question().textContent()) ?? "";
    if (question.startsWith("Voie")) {
      // The SRD offers a single path: take it.
      await page.locator('section[id^="choice-"]').getByRole("button").first().click();
    }
    if (question === "Savoir primal") await wizard.choose("Athlétisme");
    if (question === "Quelles bottes d'armes connaissez-vous ?") {
      // Every mastery slot must be filled: tick weapons until none is left.
      const free = page.getByRole("checkbox", { checked: false });
      while ((await free.count()) > 0 && (await free.first().isEnabled())) {
        await free.first().check();
      }
    }
    await wizard.next();
  }
  await apply();
  await expect.poll(async () => (await stored(id)).classId).toBe("barbarian");
  await expect(page.getByText(/Nain · Barbare · niv\. 3 · Criminel/)).toBeVisible();
});
