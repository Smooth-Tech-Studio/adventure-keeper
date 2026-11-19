import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The guided 5E creation (`/characters/new?system=5e`), driven the way a
 * player reads it: one question per screen, cards to choose, « Suivant ».
 */
export class Wizard {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.goto("/characters/new?system=5e");
    await this.expectQuestion("Quelle classe voulez-vous jouer ?");
  }

  /** The question of the current screen. */
  question(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  async expectQuestion(text: string | RegExp) {
    await expect(this.question()).toHaveText(text);
  }

  /** « Étape 2 · Espèce — 1 sur 4 ». */
  async expectStep(label: string | RegExp) {
    await expect(this.page.getByText(label)).toBeVisible();
  }

  /** « Suivant » or « Passer », in the footer. */
  nextButton(): Locator {
    return this.page.getByRole("button", { name: /^(Suivant|Passer)( ·|$)/ });
  }

  async next() {
    const before = await this.question().textContent();
    await this.nextButton().click();
    await expect(this.question()).not.toHaveText(before ?? "");
  }

  async back() {
    await this.page.getByRole("button", { name: "Précédent" }).click();
  }

  /** A class, species or background card: its thumbnail, then « Choisir ». */
  async chooseCard(name: string) {
    await this.page.getByRole("button", { name, exact: true }).click();
    await this.page.getByRole("button", { name: `Choisir : ${name}` }).click();
  }

  /** A choice tile (skill, style, package, language…), by the start of its name. */
  async choose(name: string) {
    await this.page
      .getByRole("button", { name: new RegExp(`^${escape(name)}`) })
      .first()
      .click();
  }

  /** A choice tile whose name contains `name` (spells start with their school). */
  async chooseContaining(name: string) {
    await this.page
      .getByRole("button", { name: new RegExp(escape(name)) })
      .first()
      .click();
  }

  async check(name: string) {
    await this.page.getByRole("checkbox", { name: new RegExp(`^${escape(name)}`) }).click();
  }

  /** Drops a value token (« 15 », « +2 ») on an ability. */
  async place(token: string, ability: string) {
    await this.page.getByRole("button", { name: token, exact: true }).click();
    await this.choose(ability);
  }

  async saveDraft() {
    await this.page.getByRole("button", { name: "Enregistrer comme brouillon" }).first().click();
  }

  async validate() {
    await this.page.getByRole("button", { name: "Valider la création" }).click();
  }

  // --- Whole journeys -----------------------------------------------------

  /** Step 1 for a level-1 fighter, ending on the species question. */
  async fighterClassStep(name = "Brunhild") {
    await this.chooseCard("Guerrier");
    await this.expectQuestion("Comment s'appelle votre personnage ?");
    await this.page.getByRole("textbox", { name: "Nom du personnage" }).fill(name);
    await this.next();
    await this.expectQuestion("Quelles 2 compétences maîtrisez-vous ?");
    // Not Athletics: the soldier brings it, and a skill taken twice asks for a replacement.
    await this.choose("Acrobaties");
    await this.choose("Perception");
    await this.next();
    await this.expectQuestion("Quel est votre style de combat ?");
    await this.choose("Défense");
    await this.next();
    await this.expectQuestion("Avec quel équipement partez-vous ?");
    await this.choose("Paquetage lourd");
    await this.next();
    await this.expectQuestion("Quelles bottes d'armes connaissez-vous ?");
    await this.check("Épée à deux mains");
    await this.check("Fléau d'armes");
    await this.check("Javeline");
    await this.next();
    await this.next(); // Vos aptitudes : rien à choisir.
    await this.expectQuestion("De quelle espèce êtes-vous ?");
  }

  /** Steps 2 and 3: a dwarf, once a soldier. Ends on the ability method question. */
  async dwarfSoldierOrigin() {
    await this.chooseCard("Nain");
    await this.next(); // Vos traits.

    await this.expectQuestion("Quelle vie meniez-vous avant l'aventure ?");
    await this.chooseCard("Soldat");
    await this.expectQuestion("Quel outil savez-vous manier ?");
    await this.choose("Dés");
    await this.next();
    await this.expectQuestion("Avec quel équipement partez-vous ?");
    await this.choose("Paquetage d'origine");
    await this.next();
    await this.expectQuestion("Quelle est votre boussole morale ?");
    await this.choose("Loyal Bon");
    await this.next();
    await this.expectQuestion("Quelles langues parlez-vous ?");
    await this.choose("Elfique");
    await this.choose("Gigant");
    await this.next();
    await this.next(); // Histoire : facultative.
    await this.expectQuestion("Comment déterminez-vous vos valeurs ?");
  }

  /** The soldier's background bonuses: +2 Force, +1 Constitution. */
  async soldierBonuses() {
    await this.expectQuestion("Où vont les bonus de votre historique ?");
    await this.place("+2", "Force");
    await this.place("+1", "Constitution");
    await this.next();
  }

  /** Step 4 with the standard array, ending on step 5. */
  async standardArrayAbilities() {
    await this.choose("Tableau standard");
    await this.next();
    await this.expectQuestion("Placez vos six valeurs");
    await this.place("15", "Force");
    await this.place("14", "Constitution");
    await this.place("13", "Dextérité");
    await this.place("12", "Sagesse");
    await this.place("10", "Charisme");
    await this.place("8", "Intelligence");
    await this.next();
    await this.soldierBonuses();
    await this.next(); // Profil chiffré.
  }

  /** Step 5: the packages, a candle from the shop, then the review sheet. */
  async equipmentWithCandle() {
    await this.expectQuestion("Ce que vous emportez déjà");
    await this.next();
    await this.expectQuestion("Complétez votre sac");
    await this.page.getByRole("textbox", { name: "Rechercher un objet…" }).fill("Bougie");
    await this.page.getByRole("button", { name: "Acheter Bougie" }).click();
    await expect(this.page.getByRole("button", { name: "Retirer Bougie" })).toBeVisible();
    await this.next();
    await this.expectQuestion("Votre personnage est presque prêt");
  }

  /**
   * Brunhild, dwarf fighter and soldier, level 1 — every screen of the five
   * steps, ending on the review sheet.
   */
  async createFighter(name = "Brunhild") {
    await this.fighterClassStep(name);
    await this.dwarfSoldierOrigin();
    await this.standardArrayAbilities();
    await this.equipmentWithCandle();
  }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
