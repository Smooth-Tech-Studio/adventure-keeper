import type { CampaignFile } from "./campaign-file";

/**
 * « Les Brumes d'Ashmoor » — a small invented campaign: the guide shows it and
 * offers it for download, and the tests parse it, so the example cannot drift
 * from what the import accepts.
 */
export const EXAMPLE_CAMPAIGN_FILE: CampaignFile = {
  format: "ak-campaign/1",
  campaign: {
    name: "Les Brumes d'Ashmoor",
    description: "Un village noyé de brume, une crypte qu'on croyait scellée.",
    system: "dnd5e",
    characterSystem: "dnd2024",
  },
  packs: [],
  adventures: [
    {
      title: "L'entrée de la crypte",
      summary: "Les héros forcent le portail et découvrent qui l'a rouvert.",
      locations: [
        {
          name: "Le village",
          description: "Les villageois se taisent quand on parle de la colline.",
        },
        {
          name: "La crypte",
          description: "Trois salles ; la dernière cache un passage vers les catacombes.",
          imageUrl: "https://example.com/crypte.png",
          hidden: true,
          loot: { items: [{ name: "Clé de la crypte" }], money: { gold: 15 } },
        },
      ],
      enemies: [
        {
          name: "Combattant gobelin",
          sourceMonsterId: "goblin",
          location: "La crypte",
          size: "small",
          armorClass: 15,
          maxHitPoints: 10,
          speed: 9,
          challengeRating: "1/4",
          loot: { items: [{ name: "Dague rouillée" }], money: { gold: 3, silver: 5 } },
          attacks: [
            {
              name: "Cimeterre",
              toHit: 4,
              reach: "1,50 m",
              damage: { count: 1, die: "d6" },
              damageBonus: 2,
              damageKind: "slashing",
            },
          ],
        },
      ],
      npcs: [
        {
          name: "Frère Anselme",
          personality: "Inquiet, bavard quand il a bu",
          lore: "Il a rouvert la crypte pour y cacher son frère.",
          location: "Le village",
        },
      ],
      events: [
        {
          title: "L'embuscade",
          description: "Deux gobelins attendent derrière le portail.",
          trigger: "Quand le groupe ouvre le portail",
        },
      ],
    },
  ],
  codex: [
    {
      kind: "faction",
      name: "La Main noire",
      summary: "Une guilde de voleurs dont on murmure le nom au village.",
      secret: "Elle paie Frère Anselme.",
      reputation: -1,
    },
  ],
  quests: [
    {
      title: "Qui a rouvert la crypte ?",
      summary: "Le portail était scellé depuis cent ans.",
      status: "rumor",
    },
  ],
};
