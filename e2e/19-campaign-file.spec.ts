/**
 * Scénario 19 — Fichiers de campagne et d'aventure : créer une campagne depuis
 * un fichier écrit à la main (et refuser un fichier faux), puis exporter une
 * aventure et l'importer dans une autre campagne, et exporter la campagne.
 */
import { readFile, writeFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";

import { createCampaign } from "./support/data";
import { expect, test } from "./support/fixtures";

const CAMPAIGN = {
  format: "ak-campaign/1",
  campaign: { name: "Les Brumes d'Ashmoor", system: "dnd5e", characterSystem: "dnd2024" },
  adventures: [
    {
      title: "L'entrée de la crypte",
      locations: [{ name: "Le village" }, { name: "La crypte", hidden: true }],
      enemies: [{ name: "Gobelin", armorClass: 15, maxHitPoints: 10, location: "La crypte" }],
      npcs: [{ name: "Frère Anselme", location: "Le village" }],
      events: [{ title: "L'embuscade", trigger: "Au portail" }],
    },
  ],
  codex: [{ kind: "faction", name: "La Main noire", secret: "Elle paie Anselme." }],
  quests: [{ title: "Qui a rouvert la crypte ?" }],
};

/** A collapsible section of the adventure page, by its title. */
function section(page: Page, title: string): Locator {
  return page.locator('[data-slot="card"]').filter({
    has: page.getByRole("button", { name: new RegExp(`^${title}`) }),
  });
}

async function pickFile(page: Page, path: string) {
  await page.locator('input[type="file"]').setInputFiles(path);
}

test("une campagne créée depuis un fichier écrit à la main", async ({
  signedInPage: page,
}, info) => {
  const broken = info.outputPath("faux.json");
  const good = info.outputPath("brumes.json");
  const wrong = structuredClone(CAMPAIGN);
  wrong.adventures[0].npcs[0].location = "La forge";
  await writeFile(broken, JSON.stringify(wrong));
  await writeFile(good, JSON.stringify(CAMPAIGN));

  await page.goto("/campaigns/new");
  await page.getByRole("button", { name: /^Importer une campagne/ }).click();
  const next = page.getByRole("button", { name: /^Suivant/ });

  // Un fichier faux dit où est l'erreur, et bloque.
  await pickFile(page, broken);
  await expect(page.getByRole("alert")).toContainText(
    "PNJ « Frère Anselme » : le lieu « La forge » n'existe pas dans cette aventure.",
  );
  await next.click();
  await expect(
    page.getByRole("heading", { name: "Comment voulez-vous commencer ?" }),
  ).toBeVisible();

  // Le bon fichier : son contenu, puis les écrans pré-remplis.
  await pickFile(page, good);
  await expect(page.getByText(/1 aventure\(s\), 2 lieu\(x\), 1 ennemi\(s\), 1 PNJ/)).toBeVisible();
  await next.click();
  await expect(page.getByLabel("Nom de la campagne")).toHaveValue("Les Brumes d'Ashmoor");
  // Nom, puis le jeu (qui décide des fiches), puis le récapitulatif.
  await next.click();
  await next.click();
  await expect(page.getByRole("heading", { name: "On y va ?" })).toBeVisible();
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await page.getByRole("button", { name: "Ouvrir la campagne" }).click();

  // Tout est là, et caché aux joueurs.
  await expect(page.getByRole("heading", { name: "Les Brumes d'Ashmoor", level: 1 })).toBeVisible();
  await expect(page.getByText("Qui a rouvert la crypte ?")).toBeVisible();
  await page.getByRole("link", { name: /L'entrée de la crypte/ }).click();
  await expect(section(page, "Lieux").getByText("La crypte")).toBeVisible();
  await expect(section(page, "Ennemis").getByText("Gobelin")).toBeVisible();
  await expect(section(page, "Personnages").getByText("Frère Anselme")).toBeVisible();
  await expect(page.getByText("L'embuscade")).toBeVisible();
});

test("exporter une aventure, l'importer dans une autre campagne", async ({
  signedInPage: page,
  account: gm,
}, info) => {
  const source = info.outputPath("source.json");
  await writeFile(source, JSON.stringify(CAMPAIGN));
  await page.goto("/campaigns/new");
  await page.getByRole("button", { name: /^Importer une campagne/ }).click();
  await pickFile(page, source);
  const next = page.getByRole("button", { name: /^Suivant/ });
  // Départ, nom, jeu : le récapitulatif.
  for (let i = 0; i < 3; i++) await next.click();
  await page.getByRole("button", { name: "Créer la campagne" }).click();
  await page.getByRole("button", { name: "Ouvrir la campagne" }).click();

  // La campagne exportée garde le secret du codex.
  const campaignDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Actions de la campagne" }).click();
  await page.getByRole("menuitem", { name: "Exporter la campagne" }).click();
  const campaign = JSON.parse(
    await readFile((await (await campaignDownload).path())!, "utf8"),
  ) as typeof CAMPAIGN;
  expect(campaign.format).toBe("ak-campaign/1");
  expect(campaign.codex[0].secret).toBe("Elle paie Anselme.");

  // L'aventure, exportée…
  await page.getByRole("link", { name: /L'entrée de la crypte/ }).click();
  const adventureDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter l'aventure" }).click();
  const adventurePath = info.outputPath("aventure.json");
  await (await adventureDownload).saveAs(adventurePath);

  // … puis importée dans une autre campagne, écran par écran.
  const otherId = await createCampaign(gm, "La Crypte");
  await page.goto(`/campaigns/${otherId}/adventures/new`);
  await page.getByRole("button", { name: /^Importer une aventure/ }).click();
  await pickFile(page, adventurePath);
  await expect(page.getByText(/2 lieu\(x\), 1 ennemi\(s\), 1 PNJ, 1 temps fort/)).toBeVisible();
  await next.click();
  await expect(page.getByRole("textbox", { name: "Titre" })).toHaveValue("L'entrée de la crypte");
  await next.click();
  await expect(page.getByText("La crypte", { exact: true })).toBeVisible();
  for (let i = 0; i < 3; i++) await next.click();
  await expect(page.getByRole("definition").filter({ hasText: "L'embuscade" })).toBeVisible();
  await page.getByRole("button", { name: "Créer l'aventure" }).click();
  await expect(page.getByText("Aventure créée.")).toBeVisible();
  await expect(section(page, "Ennemis").getByText("Gobelin")).toBeVisible();
});

test("le guide du format et son exemple, que l'import accepte", async ({
  signedInPage: page,
}, info) => {
  await page.goto("/campaigns/format");
  await expect(
    page.getByRole("heading", { name: "Le format d'un fichier de campagne" }),
  ).toBeVisible();
  await expect(page.getByText("ak-adventure/1", { exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger l'exemple de campagne" }).click();
  const example = info.outputPath("exemple.json");
  await (await downloading).saveAs(example);

  await page.goto("/campaigns/new");
  await page.getByRole("button", { name: /^Importer une campagne/ }).click();
  await pickFile(page, example);
  await expect(page.getByText(/Les Brumes d'Ashmoor — 1 aventure\(s\)/)).toBeVisible();
});
