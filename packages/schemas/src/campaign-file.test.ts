import { describe, expect, it } from "vitest";

import { campaignFileToJson, parseAdventureFile, parseCampaignFile } from "./campaign-file";
import { EXAMPLE_CAMPAIGN_FILE } from "./campaign-file-example";

const campaign = {
  format: "ak-campaign/1",
  campaign: { name: "Les Brumes", system: "dnd5e", characterSystem: "dnd2024" },
  adventures: [
    {
      title: "L'entrée",
      locations: [{ name: "Le portail", hidden: true }],
      enemies: [{ name: "Gobelin", armorClass: 15, maxHitPoints: 7, location: "Le portail" }],
      npcs: [{ name: "Frère Anselme", location: "Le portail" }],
      events: [{ title: "L'embuscade", trigger: "Au portail" }],
    },
  ],
  codex: [
    { kind: "faction", name: "La Main noire", secret: "Ils servent le baron.", reputation: -2 },
  ],
  quests: [{ title: "Le dragon", status: "rumor" }],
};

describe("parseCampaignFile", () => {
  it("reads a hand-written file, filling the lists it leaves out", () => {
    const result = parseCampaignFile(JSON.stringify(campaign));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.packs).toEqual([]);
    expect(result.file.adventures[0].enemies[0].location).toBe("Le portail");
    // What the export writes, the import reads back unchanged.
    expect(parseCampaignFile(campaignFileToJson(result.file))).toEqual(result);
  });

  it("names where each problem is, unknown fields included", () => {
    const broken = JSON.parse(JSON.stringify(campaign)) as Record<string, unknown> &
      typeof campaign;
    (broken.adventures[0].enemies[0] as Record<string, unknown>).armorClass = "quinze";
    (broken.adventures[0].npcs[0] as Record<string, unknown>).voice = "grave";
    const result = parseCampaignFile(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      "Aventure n°1 « L'entrée » › Ennemi n°1 « Gobelin » › armorClass : un nombre attendu, reçu du texte",
      "Aventure n°1 « L'entrée » › PNJ n°1 « Frère Anselme » : champ(s) inconnu(s) : voice",
    ]);
  });

  it("reads planned loot and refuses an unknown field in it", () => {
    const loot = { items: [{ name: "Dague", quantity: 2 }], money: { gold: 30 } };
    const file = JSON.parse(JSON.stringify(campaign)) as typeof campaign;
    (file.adventures[0].enemies[0] as Record<string, unknown>).loot = loot;
    (file.adventures[0].locations[0] as Record<string, unknown>).loot = { money: { silver: 5 } };
    expect(parseCampaignFile(JSON.stringify(file)).ok).toBe(true);
    (file.adventures[0].enemies[0] as Record<string, unknown>).loot = { ...loot, weight: 3 };
    expect(parseCampaignFile(JSON.stringify(file)).ok).toBe(false);
  });

  it("checks the location names an adventure refers to", () => {
    const broken = JSON.parse(JSON.stringify(campaign));
    broken.adventures[0].locations.push({ name: "Le portail", hidden: false });
    broken.adventures[0].npcs[0].location = "La crypte";
    const result = parseCampaignFile(JSON.stringify(broken));
    expect(result.ok ? [] : result.errors).toEqual([
      "Aventure n°1 « L'entrée » : le lieu « Le portail » est présent deux fois.",
      "Aventure n°1 « L'entrée » › PNJ « Frère Anselme » : le lieu « La crypte » n'existe pas dans cette aventure.",
    ]);
  });

  it("reads a file pasted from an AI answer, code block and sentences around it", () => {
    const text = `Voici ta campagne :\n\n\`\`\`json\n${JSON.stringify(campaign, null, 2)}\n\`\`\`\n\nBon jeu !`;
    expect(parseCampaignFile(text).ok).toBe(true);
    expect(parseCampaignFile(`Bien sûr ! ${JSON.stringify(campaign)} Amuse-toi.`).ok).toBe(true);
  });

  it("refuses what is not JSON, or another kind of file", () => {
    expect(parseCampaignFile("{").ok).toBe(false);
    const adventure = parseCampaignFile(JSON.stringify({ format: "ak-adventure/1" }));
    expect(adventure.ok ? [] : adventure.errors[0]).toMatch(/^format : valeur attendue/);
  });
});

describe("parseAdventureFile", () => {
  it("reads one adventure", () => {
    const result = parseAdventureFile(
      JSON.stringify({ format: "ak-adventure/1", adventure: campaign.adventures[0] }),
    );
    expect(result.ok && result.file.adventure.title).toBe("L'entrée");
  });
});

describe("EXAMPLE_CAMPAIGN_FILE", () => {
  it("is a file the import accepts, and so is its adventure", () => {
    expect(parseCampaignFile(campaignFileToJson(EXAMPLE_CAMPAIGN_FILE)).ok).toBe(true);
    const adventure = { format: "ak-adventure/1", adventure: EXAMPLE_CAMPAIGN_FILE.adventures[0] };
    expect(parseAdventureFile(JSON.stringify(adventure)).ok).toBe(true);
  });
});

describe("the fifth edition in a file", () => {
  const withSystems = (system: string, characterSystem: string) =>
    campaignFileToJson(EXAMPLE_CAMPAIGN_FILE)
      .replace(/"system": "[^"]+"/, `"system": "${system}"`)
      .replace(/"characterSystem": "[^"]+"/, `"characterSystem": "${characterSystem}"`);

  it("is written « 5e », and read back as the app stores it", () => {
    const text = campaignFileToJson(EXAMPLE_CAMPAIGN_FILE);
    expect(text).toContain('"system": "5e"');
    expect(text).toContain('"characterSystem": "5e"');
    const parsed = parseCampaignFile(text);
    expect(parsed.ok && parsed.file.campaign).toMatchObject({
      system: "dnd5e",
      characterSystem: "dnd2024",
    });
  });

  it("still reads a file written with the stored names", () => {
    const parsed = parseCampaignFile(withSystems("dnd5e", "dnd2024"));
    expect(parsed.ok && parsed.file.campaign.characterSystem).toBe("dnd2024");
  });
});
