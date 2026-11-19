/**
 * A table ready to play: a GM, two players (Thorin the fighter, Mira the
 * wizard), and an adventure « En cours » with two places — « La crypte » is
 * hidden under fog — and an enemy type. Used by the live
 * session and combat scenarios.
 */
import { expect, type Page } from "@playwright/test";

import {
  addEnemy,
  addLocation,
  addParticipant,
  addPlayer,
  createAdventure,
  createCampaign,
  createDndCharacter,
} from "./data";
import { createTestUser, type TestUser } from "./emulator";

export interface Table {
  gm: TestUser;
  bob: TestUser;
  carol: TestUser;
  campaignId: string;
  adventureId: string;
  adventurePath: string;
}

export async function prepareTable(gm: TestUser): Promise<Table> {
  const bob = await createTestUser("Bob");
  const carol = await createTestUser("Carol");
  const campaignId = await createCampaign(gm, "La Crypte");
  const thorin = await createDndCharacter(bob, "Thorin");
  // Mira is a wizard: the player sheet then has its « Sorts » tab.
  const mira = await createDndCharacter(carol, "Mira", { preset: "wizard" });
  await addPlayer(campaignId, bob, thorin);
  await addPlayer(campaignId, carol, mira);
  const adventureId = await createAdventure(campaignId, gm, "L'entrée", "active");
  await addLocation(campaignId, adventureId, "Le portail");
  await addLocation(campaignId, adventureId, "La crypte", { hidden: true, order: 1 });
  await addEnemy(campaignId, adventureId, "Gobelin", {
    attacks: [
      {
        name: "Cimeterre",
        toHit: 4,
        damage: { count: 1, die: "d6" },
        damageBonus: 2,
        damageKind: "slashing",
      },
    ],
  });
  await addParticipant(campaignId, adventureId, bob, thorin);
  await addParticipant(campaignId, adventureId, carol, mira);
  return {
    gm,
    bob,
    carol,
    campaignId,
    adventureId,
    adventurePath: `/campaigns/${campaignId}/adventures/${adventureId}`,
  };
}

/** The GM opens the adventure and starts its live session. */
export async function startSession(gmPage: Page, table: Table) {
  await gmPage.goto(table.adventurePath);
  await gmPage.getByRole("button", { name: "Démarrer la session" }).click();
  await expect(gmPage).toHaveURL(/\/session\/[^/]+$/);
  // After a session with a published recap, « Précédemment… » opens first (a
  // modal: the rest of the page is hidden from the accessibility tree).
  await expect(
    gmPage
      .getByRole("button", { name: "En direct" })
      .or(gmPage.getByRole("dialog", { name: "Précédemment…" }))
      .first(),
  ).toBeVisible();
}

/** A player joins the live session from the adventure page. */
export async function joinSession(page: Page, table: Table) {
  await page.goto(table.adventurePath);
  await page.getByRole("link", { name: /En direct — rejoindre/ }).click();
  // The sheet's tabs: « Actions » beside the map, « Moi » on a phone.
  await expect(
    page
      .getByRole("tab", { name: "Actions" })
      .or(page.getByRole("tab", { name: "Moi" }))
      .first(),
  ).toBeVisible();
}

/** The GM shows a place to the table, from the « Scène » tab of the panel. */
export async function showLocation(gmPage: Page, name: string) {
  await gmPage.getByRole("tab", { name: "Scène" }).click();
  const section = gmPage.locator("#gm-scene-location");
  await section.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await section.getByRole("button", { name: "Montrer", exact: true }).click();
  await expect(section.getByText("Montré aux joueurs")).toBeVisible();
  await expect(section.getByText(name, { exact: true })).toBeVisible();
}

/** The GM opens a tab of the panel (« Scène », « Combat », « Récit », « Notes »). */
export async function gmTab(gmPage: Page, name: string) {
  await gmPage.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
}
