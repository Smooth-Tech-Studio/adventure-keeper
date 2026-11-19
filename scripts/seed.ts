/**
 * Seed the local Firebase emulators with test users, characters and campaigns.
 *
 *   pnpm dev              # start emulators + front (separate terminal)
 *   pnpm emulators:seed   # run this script
 *
 * Idempotent: every run wipes the `seed-*` documents / auth users and recreates
 * them, so you always get the same known state. By default it talks to the
 * emulators only — it refuses to run against a real Firestore host.
 *
 * A real project can be seeded too, on purpose and never production (see
 * « Remote project » below): the staging project, for instance.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/seed-key.json \
 *   SEED_PASSWORD='…' \
 *   pnpm emulators:seed --project <staging-project-id> --yes
 *
 * A walkthrough of the seeded campaign: docs/SEED_SCENARIO.md.
 *
 *   pnpm emulators:seed --legacy-belongings
 *
 * keeps inventory, purse, XP and notes on the sheet itself, as before
 * `private/belongings` existed.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
// Import the source directly (tsx compiles it) so the script never needs a
// prior `schemas` build and always reflects the current rules.
import {
  armorPropsFromDef,
  computeCharacterDerived,
  getMonster,
  monsterAttacks,
  weaponPropsFromDef,
  type ArmorDef,
  type WeaponDef,
} from "../packages/system-dnd2024/src/index";
import type { Dnd2024CharacterInput } from "../packages/schemas/src/index";
import { CHARACTER_PRIVATE_FIELDS } from "../packages/schemas/src/character-private";

const LEGACY_BELONGINGS = process.argv.includes("--legacy-belongings");

// --- Target ---------------------------------------------------------------
// Emulators by default. `--project <id>` (or SEED_PROJECT) seeds a real
// Firebase project instead, with a service account's key
// (GOOGLE_APPLICATION_CREDENTIALS). That mode is deliberate: it never targets
// production, never runs without `--yes`, and the accounts get a password of
// the caller's own (SEED_PASSWORD) rather than the public one.
const argValue = (flag: string) => {
  const at = process.argv.indexOf(flag);
  if (at === -1) return undefined;
  const value = process.argv[at + 1];
  // A flag without its value must not fall back to the emulators unnoticed.
  if (!value || value.startsWith("-")) throw new Error(`Seed: ${flag} needs a value.`);
  return value;
};
const REMOTE_PROJECT = argValue("--project") ?? process.env.SEED_PROJECT;
/** Production: the seed's data and weak accounts must never land there. */
const PRODUCTION_PROJECT = "adv-keeper";

if (REMOTE_PROJECT) {
  if (REMOTE_PROJECT === PRODUCTION_PROJECT) {
    throw new Error(`Refusing to seed "${PRODUCTION_PROJECT}": that is the production project.`);
  }
  // An emulator host in the environment would silently send everything there.
  for (const name of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
    if (process.env[name]) {
      throw new Error(`Seed: ${name} is set, so it would not reach "${REMOTE_PROJECT}". Unset it.`);
    }
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Seed: set GOOGLE_APPLICATION_CREDENTIALS to the seed service account's key.");
  }
  if (!process.argv.includes("--yes")) {
    console.log(
      `This would WIPE and recreate the « seed-* » accounts, characters and campaigns of the real project "${REMOTE_PROJECT}".\n` +
        "Run it again with --yes to go ahead.",
    );
    process.exit(0);
  }
} else {
  // This script only ever targets the local emulators. Default the hosts if the
  // caller didn't set them, then refuse anything that isn't loopback.
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!/^(127\.0\.0\.1|localhost|0\.0\.0\.0):\d+$/.test(host)) {
    throw new Error(`Refusing to seed: FIRESTORE_EMULATOR_HOST="${host}" is not a local emulator.`);
  }
}
const TARGET = REMOTE_PROJECT
  ? `project "${REMOTE_PROJECT}"`
  : `emulators (Firestore ${process.env.FIRESTORE_EMULATOR_HOST})`;

const PROJECT_ID = REMOTE_PROJECT ?? process.env.GCLOUD_PROJECT ?? "adv-keeper";
initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();
// Like the app: optional fields left `undefined` (catalogue blocks) are skipped.
db.settings({ ignoreUndefinedProperties: true });
const now = () => FieldValue.serverTimestamp();

// --- Test data ----------------------------------------------------------
// The emulators' accounts keep the known password; a real project's get
// SEED_PASSWORD, or a random one printed once at the end.
const GENERATED_PASSWORD = REMOTE_PROJECT && !process.env.SEED_PASSWORD;
const PASSWORD = !REMOTE_PROJECT
  ? "test1234"
  : (process.env.SEED_PASSWORD ?? randomBytes(12).toString("base64url"));
if (PASSWORD.length < 8) throw new Error("Seed: SEED_PASSWORD needs 8 characters at least.");

const USERS = [
  { uid: "seed-alice", email: "alice@test.dev", displayName: "Alice" },
  { uid: "seed-bob", email: "bob@test.dev", displayName: "Bob" },
  { uid: "seed-carol", email: "carol@test.dev", displayName: "Carol" },
];

const item = (name: string) => ({ id: randomUUID(), name, consumable: false, quantity: 1 });
const potion = (name: string, quantity: number) => ({
  id: randomUUID(),
  name,
  consumable: true,
  quantity,
});
// Weapons and armour come from the catalogue (read from the repo root, where
// `pnpm emulators:seed` runs), with the block the rules engine reads (`item.weapon` / `item.armor`): the sheet then derives real attacks and AC.
const catalogue = <T extends { name: string }>(file: string): T[] =>
  (
    JSON.parse(readFileSync(`packages/system-dnd2024/src/srd/${file}`, "utf8")) as {
      entries: T[];
    }
  ).entries;
const WEAPONS = catalogue<WeaponDef>("weapons.json");
const ARMORS = catalogue<ArmorDef>("armors.json");
const fromCatalogue = <T extends { name: string }>(list: T[], name: string): T => {
  const def = list.find((d) => d.name === name);
  if (!def) throw new Error(`Seed: « ${name} » is not in the catalogue.`);
  return def;
};
const weapon = (name: string) => {
  const def = fromCatalogue(WEAPONS, name);
  return {
    ...item(def.name),
    catalogId: def.id,
    priceCp: def.priceCp,
    weightKg: def.weightKg,
    weapon: weaponPropsFromDef(def),
  };
};
const armor = (name: string) => {
  const def = fromCatalogue(ARMORS, name);
  return {
    ...item(def.name),
    catalogId: def.id,
    priceCp: def.priceCp,
    weightKg: def.weightKg,
    armor: { ...armorPropsFromDef(def), equipped: true },
  };
};

/** Build a full character doc (input + derived block) from the essentials. */
function character(
  id: string,
  ownerId: string,
  input: Omit<
    Dnd2024CharacterInput,
    | "system"
    | "languages"
    | "cantrips"
    | "spells"
    | "skillExpertise"
    | "money"
    | "tools"
    | "toolProficiencies"
    | "toolExpertise"
    | "weaponMasteries"
    | "choices"
    | "packContent"
    | "eldritchInvocations"
  > &
    Partial<
      Pick<
        Dnd2024CharacterInput,
        | "cantrips"
        | "spells"
        | "skillExpertise"
        | "tools"
        | "toolProficiencies"
        | "toolExpertise"
        | "weaponMasteries"
      >
    >,
) {
  const full: Dnd2024CharacterInput = {
    system: "dnd2024",
    languages: [],
    cantrips: [],
    spells: [],
    skillExpertise: [],
    tools: [],
    toolProficiencies: [],
    toolExpertise: [],
    weaponMasteries: [],
    choices: [],
    packContent: [],
    eldritchInvocations: [],
    money: { platinum: 0, gold: 15, electrum: 0, silver: 0, copper: 0 },
    ...input,
  };
  const derived = computeCharacterDerived({
    classId: full.classId,
    level: full.level,
    baseAbilityScores: full.baseAbilityScores,
    backgroundAbilityBonuses: full.backgroundAbilityBonuses,
    backgroundId: full.backgroundId,
    speciesId: full.speciesId,
    skillProficiencies: full.skillProficiencies,
    speciesSkillProficiencies: full.speciesSkillProficiencies,
    skillExpertise: full.skillExpertise,
    weapons: full.weapons,
    armors: full.armors,
    tools: full.tools,
    toolProficiencies: full.toolProficiencies,
    toolExpertise: full.toolExpertise,
    weaponMasteries: full.weaponMasteries,
  });
  return { id, data: { ...full, ...derived, ownerId, createdAt: now(), updatedAt: now() } };
}

const CHARACTERS = [
  character("seed-char-lyra", "seed-alice", {
    name: "Lyra Vent-d'Argent",
    speciesId: "elf",
    speciesChoice: "Elfe des bois",
    classId: "rogue",
    backgroundId: "criminal",
    alignment: "CN",
    level: 3,
    color: "#7c3aed",
    baseAbilityScores: { str: 10, dex: 16, con: 13, int: 12, wis: 14, cha: 8 },
    backgroundAbilityBonuses: { str: 0, dex: 2, con: 1, int: 0, wis: 0, cha: 0 },
    skillProficiencies: ["acrobatics", "investigation", "perception", "deception"],
    speciesSkillProficiencies: ["survival"],
    skillExpertise: ["stealth", "perception"],
    weapons: [weapon("Dague"), weapon("Arc court")],
    armors: [armor("Armure de cuir")],
    inventory: [potion("Potion de soins", 2), item("Outils de voleur")],
  }),
  character("seed-char-thorin", "seed-bob", {
    name: "Thorin Poing-de-Fer",
    speciesId: "dwarf",
    classId: "fighter",
    backgroundId: "soldier",
    alignment: "LG",
    level: 3,
    color: "#b45309",
    baseAbilityScores: { str: 16, dex: 12, con: 15, int: 10, wis: 13, cha: 8 },
    backgroundAbilityBonuses: { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
    skillProficiencies: ["perception", "survival"],
    speciesSkillProficiencies: [],
    weapons: [weapon("Hache d'armes"), weapon("Marteau léger")],
    armors: [armor("Cotte de mailles"), armor("Bouclier")],
    inventory: [potion("Ration", 5), item("Corde de chanvre (15 m)")],
  }),
  character("seed-char-mira", "seed-carol", {
    name: "Mira l'Érudite",
    speciesId: "human",
    classId: "wizard",
    backgroundId: "sage",
    alignment: "N",
    level: 2,
    color: "#2563eb",
    baseAbilityScores: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 },
    backgroundAbilityBonuses: { str: 0, dex: 0, con: 1, int: 2, wis: 0, cha: 0 },
    skillProficiencies: ["investigation", "insight"],
    speciesSkillProficiencies: ["perception"],
    cantrips: ["fire-bolt", "mage-hand"],
    spells: ["magic-missile", "shield", "detect-magic"],
    weapons: [weapon("Bâton de combat")],
    armors: [],
    inventory: [item("Grimoire"), potion("Potion de soins", 1)],
  }),
  // Bob's first character in the crypt campaign, fallen before Thorin took over.
  character("seed-char-brann", "seed-bob", {
    name: "Brann le Téméraire",
    speciesId: "human",
    classId: "barbarian",
    backgroundId: "soldier",
    alignment: "CG",
    level: 1,
    color: "#991b1b",
    baseAbilityScores: { str: 16, dex: 13, con: 15, int: 8, wis: 12, cha: 10 },
    backgroundAbilityBonuses: { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
    skillProficiencies: ["athletics", "intimidation"],
    speciesSkillProficiencies: ["survival"],
    weapons: [weapon("Hache à deux mains")],
    armors: [],
    inventory: [],
  }),
  character("seed-char-alaric", "seed-alice", {
    name: "Frère Alaric",
    speciesId: "human",
    classId: "cleric",
    backgroundId: "acolyte",
    alignment: "LG",
    level: 1,
    color: "#0d9488",
    baseAbilityScores: { str: 13, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    backgroundAbilityBonuses: { str: 0, dex: 0, con: 1, int: 0, wis: 2, cha: 0 },
    skillProficiencies: ["medicine", "persuasion"],
    speciesSkillProficiencies: ["history"],
    cantrips: ["sacred-flame", "guidance"],
    spells: ["cure-wounds", "bless"],
    weapons: [weapon("Masse d'armes")],
    armors: [armor("Chemise de mailles"), armor("Bouclier")],
    inventory: [item("Symbole sacré")],
  }),
];

interface MemberSeed {
  uid: string;
  role: "gm" | "player";
  characterId?: string;
  /** The whole roster, active one included (defaults to the active one alone). */
  characterIds?: string[];
}
interface CampaignSeed {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: MemberSeed[];
}

const CAMPAIGNS: CampaignSeed[] = [
  {
    id: "seed-camp-crypt",
    name: "La Crypte oubliée",
    description: "Une descente dans les catacombes sous la cité de Val-Brume.",
    ownerId: "seed-alice",
    members: [
      { uid: "seed-alice", role: "gm" },
      {
        uid: "seed-bob",
        role: "player",
        characterId: "seed-char-thorin",
        characterIds: ["seed-char-thorin", "seed-char-brann"],
      },
      { uid: "seed-carol", role: "player", characterId: "seed-char-mira" },
    ],
  },
  {
    id: "seed-camp-tavern",
    name: "Rumeurs à la taverne",
    description: "Campagne bac à sable menée par Bob ; Alice y joue Lyra.",
    ownerId: "seed-bob",
    members: [
      { uid: "seed-bob", role: "gm" },
      { uid: "seed-alice", role: "player", characterId: "seed-char-lyra" },
    ],
  },
];

// --- The crypt campaign: three adventures, codex, quests, stories ------------
// « La Crypte oubliée » is laid out to try every campaign / adventure feature:
// 1. « Rumeurs à Val-Brume » — completed, one played session with a published
//    recap, so the chronicle, the quests' milestones and the journals show.
// 2. « L'entrée de la crypte » — active, ready to play: visible and hidden
//    locations (fog), NPCs, SRD enemies, story beats on the game clock.
// 3. « Le cœur de la crypte » — a draft the players do not see.
const CRYPT = "seed-camp-crypt";
const PLAYERS = ["seed-bob", "seed-carol"];
const PARTY = ["seed-char-thorin", "seed-char-mira"];
const img = (seed: string) => `https://picsum.photos/seed/${seed}/1200/800`;
const daysAgo = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return Timestamp.fromDate(date);
};

/** An enemy block from an SRD monster, as the « Monstre du SRD » picker fills it. */
function srdEnemy(id: string, monsterId: string, extra: Record<string, unknown> = {}) {
  const monster = getMonster(monsterId)!;
  return {
    id,
    name: monster.name,
    sourceMonsterId: monster.id,
    size: monster.size,
    challengeRating: monster.cr,
    armorClass: monster.armorClass,
    maxHitPoints: monster.hitPoints,
    speed: Math.round((monster.speed * 0.3) / 0.5) * 0.5,
    attacks: monsterAttacks(monster.id).map((atk) => ({
      name: atk.name,
      toHit: atk.toHit,
      ...(atk.reach ? { reach: atk.reach } : {}),
      damage: atk.damage,
      damageBonus: atk.damageBonus,
      damageKind: atk.damageKind,
      ...(atk.note ? { notes: atk.note } : {}),
    })),
    ...extra,
  };
}

const SESSION_1 = "seed-ses-rumors-1";

interface AdventureSeed {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "upcoming" | "active" | "completed";
  hasPlayedSession?: boolean;
  lastRecapAt?: number;
  locations: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    hidden?: boolean;
  }[];
  npcs: {
    id: string;
    name: string;
    personality?: string;
    lore?: string;
    locationId?: string;
    color?: string;
  }[];
  enemies: Record<string, unknown>[];
  events: {
    id: string;
    title: string;
    description?: string;
    trigger?: string;
    dueDay?: number;
    dueTime?: string;
    isRevealed?: boolean;
    revealedSessionId?: string;
  }[];
}

const ADVENTURES: AdventureSeed[] = [
  {
    id: "seed-adv-rumors",
    title: "Rumeurs à Val-Brume",
    summary:
      "Les héros arrivent à Val-Brume. Au Corbeau ivre, on parle de rats géants dans la cave et de l'archiviste Bertram, disparu depuis trois jours.",
    status: "completed",
    hasPlayedSession: true,
    lastRecapAt: Date.now() - 2 * 24 * 3600 * 1000,
    locations: [
      {
        id: "seed-loc-tavern",
        name: "Le Corbeau ivre",
        description: "Taverne enfumée près des quais. La cave communique avec les égouts.",
        imageUrl: img("raven-tavern"),
      },
      {
        id: "seed-loc-archives",
        name: "Les archives de Val-Brume",
        description: "Le bureau de Bertram a été fouillé. Une lettre est cachée sous le sous-main.",
        imageUrl: img("valbrume-archives"),
      },
    ],
    npcs: [
      {
        id: "seed-npc-garrick",
        name: "Garrick",
        personality: "Bourru, généreux, ne supporte pas les rats.",
        lore: "Tavernier du Corbeau ivre. Ancien de l'Ordre de la Lanterne ; il sait que Bertram fouillait les plans de la vieille crypte.",
        locationId: "seed-loc-tavern",
        color: "#a16207",
      },
    ],
    enemies: [srdEnemy("seed-enemy-rat", "giant-rat", { locationId: "seed-loc-tavern" })],
    events: [
      {
        id: "seed-evt-letter",
        title: "La lettre de l'archiviste",
        description:
          "Dans le bureau de Bertram, une lettre inachevée parle d'un portail scellé sous le cimetière des Saules.",
        trigger: "Fouiller le bureau des archives",
        isRevealed: true,
        revealedSessionId: SESSION_1,
      },
    ],
  },
  {
    id: "seed-adv-entrance",
    title: "L'entrée de la crypte",
    summary:
      "Sur la piste de Bertram, les héros gagnent le cimetière des Saules. Des pilleurs gobelins rôdent, et le portail de la crypte ne s'ouvre qu'à minuit.",
    status: "active",
    locations: [
      {
        id: "seed-loc-cemetery",
        name: "Le cimetière des Saules",
        description:
          "Brume au ras des tombes. Frère Osric veille à la chapelle. Les gobelins campent derrière le mausolée.",
        imageUrl: img("willow-cemetery"),
      },
      {
        id: "seed-loc-gate",
        name: "Le portail scellé",
        description:
          "Le portail porte le sceau de la Lanterne. Il s'ouvre au glas de minuit, ou avec le médaillon d'Ysolde.",
        imageUrl: img("crypt-gate"),
        hidden: true,
      },
      {
        id: "seed-loc-ossuary",
        name: "L'ossuaire",
        description:
          "Des milliers de crânes. Bertram est ligoté au fond, gardé par un molosse squelette.",
        imageUrl: img("crypt-ossuary"),
        hidden: true,
      },
    ],
    npcs: [
      {
        id: "seed-npc-osric",
        name: "Frère Osric",
        personality: "Doux, craintif, parle trop vite.",
        lore: "Gardien du cimetière. Il a vu des hommes en linceul gris entrer dans la crypte avec Bertram. Il cache la clé de la chapelle.",
        locationId: "seed-loc-cemetery",
        color: "#0f766e",
      },
      {
        id: "seed-npc-ysolde",
        name: "Dame Ysolde",
        personality: "Spectre triste, solennel.",
        lore: "Fondatrice de l'Ordre de la Lanterne, enterrée ici. Elle aidera qui lui rapporte son médaillon, volé par la Confrérie du Linceul.",
        locationId: "seed-loc-ossuary",
        color: "#7dd3fc",
      },
    ],
    enemies: [
      srdEnemy("seed-enemy-goblin", "goblin", { locationId: "seed-loc-cemetery" }),
      srdEnemy("seed-enemy-skeleton", "skeleton", { locationId: "seed-loc-gate" }),
      {
        id: "seed-enemy-hound",
        name: "Molosse squelette",
        description: "Un chien de guerre mort-vivant, aux os noircis.",
        locationId: "seed-loc-ossuary",
        size: "medium",
        challengeRating: "1",
        armorClass: 13,
        maxHitPoints: 18,
        speed: 12,
        attacks: [
          {
            name: "Morsure",
            toHit: 4,
            reach: "1,50 m",
            damage: { count: 2, die: "d6" },
            damageBonus: 2,
            damageKind: "piercing",
            notes: "Cible à terre si elle rate un JS de Force DD 11.",
          },
        ],
        color: "#525252",
      },
    ],
    events: [
      {
        id: "seed-evt-goblins",
        title: "Des pilleurs au cimetière",
        description: "Trois gobelins déterrent une tombe. Ils fuient si deux d'entre eux tombent.",
        trigger: "Arrivée au cimetière",
      },
      {
        id: "seed-evt-midnight",
        title: "Le glas de minuit",
        description: "La cloche de la chapelle sonne seule. Le sceau du portail s'illumine.",
        dueDay: 2,
        dueTime: "23:30",
      },
      {
        id: "seed-evt-gate",
        title: "Le portail s'ouvre",
        description:
          "Le portail scellé s'ouvre sur un escalier humide. Un squelette garde la descente.",
        trigger: "Au glas, ou avec le médaillon",
      },
      {
        id: "seed-evt-ysolde",
        title: "Dame Ysolde se manifeste",
        description: "Le spectre apparaît et demande qu'on lui rende son médaillon.",
        trigger: "Entrée dans l'ossuaire",
      },
    ],
  },
  {
    id: "seed-adv-heart",
    title: "Le cœur de la crypte",
    summary: "Brouillon : la Confrérie du Linceul célèbre son rituel dans la crypte profonde.",
    status: "draft",
    locations: [],
    npcs: [],
    enemies: [srdEnemy("seed-enemy-zombie", "zombie")],
    events: [],
  },
];

const CODEX: {
  id: string;
  kind: "npc" | "place" | "faction" | "item" | "deity" | "document" | "other";
  name: string;
  summary: string;
  revealed: boolean;
  secret?: string;
  reputation?: number;
  imageUrl?: string;
  adventureId?: string;
  sourceNpcId?: string;
}[] = [
  {
    id: "seed-codex-valbrume",
    kind: "place",
    name: "Val-Brume",
    summary: "Cité portuaire noyée de brume. Sa vieille crypte est scellée depuis un siècle.",
    revealed: true,
  },
  {
    id: "seed-codex-garrick",
    kind: "npc",
    name: "Garrick",
    summary: "Le tavernier du [[Corbeau ivre]]. Il connaît tout le monde à [[Val-Brume]].",
    revealed: true,
    adventureId: "seed-adv-rumors",
    sourceNpcId: "seed-npc-garrick",
  },
  {
    id: "seed-codex-tavern",
    kind: "place",
    name: "Corbeau ivre",
    summary: "Taverne des quais de [[Val-Brume]], tenue par [[Garrick]].",
    revealed: true,
  },
  {
    id: "seed-codex-lantern",
    kind: "faction",
    name: "L'Ordre de la Lanterne",
    summary: "Ancien ordre de gardiens qui a scellé la crypte. Il en reste quelques fidèles.",
    revealed: true,
    reputation: 2,
  },
  {
    id: "seed-codex-shroud",
    kind: "faction",
    name: "La Confrérie du Linceul",
    summary: "Des silhouettes en linceul gris qu'on aperçoit la nuit près du cimetière.",
    revealed: false,
    reputation: -2,
    secret: "Culte nécromant. Il a enlevé Bertram pour lire les plans de la crypte.",
  },
  {
    id: "seed-codex-letter",
    kind: "document",
    name: "La lettre de Bertram",
    summary:
      "« …le portail sous les Saules ne s'ouvre qu'au glas de minuit. Ils le savent aussi. »",
    revealed: true,
    imageUrl: img("bertram-letter"),
    adventureId: "seed-adv-rumors",
  },
  {
    id: "seed-codex-osric",
    kind: "npc",
    name: "Frère Osric",
    summary: "Le gardien du cimetière des Saules.",
    revealed: false,
    adventureId: "seed-adv-entrance",
    sourceNpcId: "seed-npc-osric",
    secret: "Il a laissé entrer la Confrérie contre de l'or.",
  },
  {
    id: "seed-codex-medallion",
    kind: "item",
    name: "Le médaillon d'Ysolde",
    summary: "Un médaillon d'argent frappé d'une lanterne.",
    revealed: false,
    secret: "Il ouvre le portail scellé à toute heure. La Confrérie l'a volé.",
  },
];

const QUESTS: {
  id: string;
  title: string;
  summary: string;
  status: "rumor" | "active" | "done" | "failed";
  revealed: boolean;
  milestones: ("revealed" | "rumor" | "active" | "done" | "failed")[];
}[] = [
  {
    id: "seed-quest-rats",
    title: "Les rats du Corbeau ivre",
    summary: "[[Garrick]] paie 10 po pour vider sa cave des rats géants.",
    status: "done",
    revealed: true,
    milestones: ["revealed", "done"],
  },
  {
    id: "seed-quest-bertram",
    title: "Retrouver l'archiviste Bertram",
    summary:
      "Bertram a disparu après avoir écrit [[La lettre de Bertram]]. Piste : le cimetière des Saules.",
    status: "active",
    revealed: true,
    milestones: ["revealed", "active"],
  },
  {
    id: "seed-quest-medallion",
    title: "Le médaillon d'Ysolde",
    summary: "Rendre son médaillon au spectre de Dame Ysolde.",
    status: "rumor",
    revealed: false,
    milestones: [],
  },
  {
    id: "seed-quest-shroud",
    title: "Démasquer la Confrérie du Linceul",
    summary: "Qui sont les hommes en linceul gris ?",
    status: "rumor",
    revealed: false,
    milestones: [],
  },
];

/** Lore, personality, chapters and journal: what the sheet's « Histoire » shows. */
const STORIES = [
  {
    characterId: "seed-char-thorin",
    ownerId: "seed-bob",
    lore: "Fils de forgeron de Hautecime, Thorin a servi dix ans dans la garde du col avant de prendre la route.",
    personality: {
      traits: "Parle peu, rit fort.",
      ideals: "Une promesse tenue vaut une hache bien trempée.",
      bonds: "Il doit une dette à l'Ordre de la Lanterne.",
      flaws: "Ne recule jamais, même quand il le faudrait.",
    },
    chapters: [
      {
        title: "La forge de Hautecime",
        body: "L'enfance au son de l'enclume, et la chute de la forge familiale.",
        visibility: "party" as const,
      },
      {
        title: "La dette",
        body: "Un chevalier de la Lanterne lui a sauvé la vie au col. Thorin ne l'a jamais remboursé.",
        visibility: "gm" as const,
      },
    ],
    journal: {
      title: "Des rats, et pire",
      body: "Vidé la cave de [[Garrick]]. Mira a trouvé [[La lettre de Bertram]] : demain, le cimetière.",
      visibility: "party" as const,
    },
  },
  {
    characterId: "seed-char-mira",
    ownerId: "seed-carol",
    lore: "Ancienne apprentie des archives de Val-Brume, Mira connaît Bertram depuis l'enfance.",
    personality: {
      traits: "Curieuse, note tout.",
      ideals: "Le savoir doit être partagé.",
      bonds: "Bertram est comme un père pour elle.",
      flaws: "Ne résiste pas à un livre interdit.",
    },
    chapters: [
      {
        title: "L'apprentie de Bertram",
        body: "Dix ans à classer des parchemins, et une nuit à lire ce qu'il ne fallait pas.",
        visibility: "party" as const,
      },
    ],
    journal: {
      title: "Notes de terrain",
      body: "L'écriture de Bertram tremblait. Il savait qu'on le suivait.",
      visibility: "private" as const,
    },
  },
];

// --- Run --------------------------------------------------------------------
async function wipe() {
  for (const u of USERS) {
    await auth.deleteUser(u.uid).catch(() => {});
  }
  const refs = [
    ...CHARACTERS.map((c) => db.doc(`characters/${c.id}`)),
    ...USERS.map((u) => db.doc(`users/${u.uid}`)),
    ...CAMPAIGNS.map((c) => db.doc(`campaigns/${c.id}`)),
  ];
  await Promise.all(refs.map((ref) => db.recursiveDelete(ref)));
}

async function seedAdventure(adventure: AdventureSeed, order: number) {
  const path = `campaigns/${CRYPT}/adventures/${adventure.id}`;
  const own = { campaignId: CRYPT, adventureId: adventure.id };
  await db.doc(path).set({
    campaignId: CRYPT,
    createdBy: "seed-alice",
    title: adventure.title,
    summary: adventure.summary,
    status: adventure.status,
    hasPlayedSession: adventure.hasPlayedSession ?? false,
    playerIds: adventure.status === "draft" ? [] : PLAYERS,
    conditionsEnabled: true,
    ...(adventure.lastRecapAt ? { lastRecapAt: adventure.lastRecapAt } : {}),
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  const list = [
    ["locations", adventure.locations],
    ["npcs", adventure.npcs],
    ["enemies", adventure.enemies],
    ["events", adventure.events],
  ] as const;
  for (const [collection, docs] of list) {
    for (let i = 0; i < docs.length; i += 1) {
      const { id, ...data } = docs[i] as { id: string };
      await db.doc(`${path}/${collection}/${id}`).set({
        ...own,
        ...data,
        ...(collection === "locations"
          ? { hidden: (data as { hidden?: boolean }).hidden ?? false }
          : {}),
        ...(collection === "events"
          ? { isRevealed: (data as { isRevealed?: boolean }).isRevealed ?? false }
          : {}),
        order: i,
        createdAt: now(),
        updatedAt: now(),
      });
    }
  }
  if (adventure.status === "draft") return;
  for (const characterId of PARTY) {
    const char = CHARACTERS.find((c) => c.id === characterId)!;
    await db.doc(`${path}/participants/${characterId}`).set({
      ...own,
      characterId,
      playerId: char.data.ownerId,
      characterName: char.data.name,
      currentHitPoints: char.data.maxHitPoints,
      createdAt: now(),
      updatedAt: now(),
    });
  }
}

/** The played session of « Rumeurs à Val-Brume », recap published. */
async function seedPastSession() {
  const path = `campaigns/${CRYPT}/adventures/seed-adv-rumors/liveSessions/${SESSION_1}`;
  const letter = CODEX.find((c) => c.id === "seed-codex-letter")!;
  await db.doc(path).set({
    campaignId: CRYPT,
    adventureId: "seed-adv-rumors",
    status: "ended",
    startedBy: "seed-alice",
    startedAt: daysAgo(2, 20),
    endedAt: daysAgo(2, 23),
    number: 1,
    title: "Des rats et une lettre",
    recap:
      "Arrivés à [[Val-Brume]] sous la pluie, Thorin et Mira poussent la porte du [[Corbeau ivre]]. " +
      "[[Garrick]] leur promet dix pièces d'or s'ils vident sa cave : trois rats géants plus tard, c'est chose faite.\n\n" +
      "Le tavernier leur parle alors de Bertram, l'archiviste, disparu depuis trois jours. Aux archives, Mira trouve " +
      "[[La lettre de Bertram]] : le portail sous les Saules ne s'ouvre qu'au glas de minuit.",
    recapPublishedAt: daysAgo(2, 23),
    gameDay: 1,
    gameDate: "3 du mois des Brumes",
    clockLabel: "23:00",
    currentLocationId: "seed-loc-archives",
    visitedLocationIds: ["seed-loc-tavern", "seed-loc-archives"],
    loot: [
      {
        id: "seed-loot-gold",
        name: "Pièces d'or (prime de Garrick)",
        quantity: 10,
        where: "Le Corbeau ivre",
      },
      {
        id: "seed-loot-key",
        name: "Clé de laiton",
        quantity: 1,
        where: "Les archives de Val-Brume",
      },
    ],
    defeated: [
      { id: "seed-cbt-rat-1", name: "Rat géant 1" },
      { id: "seed-cbt-rat-2", name: "Rat géant 2" },
      { id: "seed-cbt-rat-3", name: "Rat géant 3" },
    ],
    revealedEvents: [
      {
        eventId: "seed-evt-letter",
        title: "La lettre de l'archiviste",
        description: ADVENTURES[0].events[0].description,
      },
    ],
    shownDocuments: [{ entryId: letter.id, name: letter.name, imageUrl: letter.imageUrl }],
    hiddenEntryIds: [],
    attendeeUids: ["seed-alice", ...PLAYERS],
    connectedUids: [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.doc(`${path}/private/gm`).set({
    gmNotes: "Osric a menti sur la clé : à exploiter au cimetière.",
    quickNotes: [
      { at: Date.now() - 2 * 24 * 3600 * 1000, text: "Les joueurs soupçonnent Garrick." },
    ],
    createdAt: now(),
    updatedAt: now(),
  });
}

async function seed() {
  // Auth accounts + mirrored profiles.
  for (const u of USERS) {
    await auth.createUser({
      uid: u.uid,
      email: u.email,
      password: PASSWORD,
      displayName: u.displayName,
      emailVerified: true,
    });
    await db.doc(`users/${u.uid}`).set({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      locale: "fr",
      createdAt: now(),
      updatedAt: now(),
    });
  }

  // Characters, with their story where there is one.
  for (const c of CHARACTERS) {
    const story = STORIES.find((s) => s.characterId === c.id);
    const sheet: Record<string, unknown> = {
      ...c.data,
      ...(story ? { lore: story.lore, personality: story.personality } : {}),
    };
    // As the app writes it: what only the owner and the GM read in its own doc.
    const belongings: Record<string, unknown> = {};
    if (!LEGACY_BELONGINGS) {
      for (const key of CHARACTER_PRIVATE_FIELDS) {
        if (key in sheet) belongings[key] = sheet[key];
        delete sheet[key];
      }
    }
    await db.doc(`characters/${c.id}`).set(sheet);
    if (!LEGACY_BELONGINGS) {
      await db
        .doc(`characters/${c.id}/private/belongings`)
        .set({ ...belongings, updatedAt: now() });
    }
  }
  for (const story of STORIES) {
    const char = CHARACTERS.find((c) => c.id === story.characterId)!;
    const base = { ownerId: story.ownerId, characterId: story.characterId, campaignId: CRYPT };
    for (let i = 0; i < story.chapters.length; i += 1) {
      await db.collection(`characters/${story.characterId}/chapters`).add({
        ...base,
        ...story.chapters[i],
        order: i,
        createdAt: now(),
        updatedAt: now(),
      });
    }
    await db.collection(`characters/${story.characterId}/journal`).add({
      ...base,
      ...story.journal,
      characterName: char.data.name,
      campaignName: CAMPAIGNS[0].name,
      adventureId: "seed-adv-rumors",
      adventureTitle: ADVENTURES[0].title,
      sessionId: SESSION_1,
      sessionNumber: 1,
      createdAt: daysAgo(1, 10),
      updatedAt: daysAgo(1, 10),
    });
  }

  // Campaigns + members.
  for (const c of CAMPAIGNS) {
    await db.doc(`campaigns/${c.id}`).set({
      name: c.name,
      description: c.description,
      system: "dnd5e",
      characterSystem: "dnd2024",
      ownerId: c.ownerId,
      memberIds: c.members.map((m) => m.uid),
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    });
    for (const m of c.members) {
      const profile = USERS.find((u) => u.uid === m.uid)!;
      await db.doc(`campaigns/${c.id}/members/${m.uid}`).set({
        uid: m.uid,
        role: m.role,
        status: "active",
        displayName: profile.displayName,
        ...(m.characterId
          ? { characterId: m.characterId, characterIds: m.characterIds ?? [m.characterId] }
          : {}),
        joinedAt: now(),
        createdAt: now(),
        updatedAt: now(),
      });
      // As the app does: the campaign's GM and members may read the sheet.
      for (const characterId of m.characterIds ?? (m.characterId ? [m.characterId] : [])) {
        await db
          .doc(`characters/${characterId}`)
          .update({ campaignIds: FieldValue.arrayUnion(c.id) });
      }
    }
  }

  // The crypt campaign's adventures, played session, codex and quests.
  for (let i = 0; i < ADVENTURES.length; i += 1) await seedAdventure(ADVENTURES[i], i);
  await seedPastSession();
  for (const { id, secret, ...entry } of CODEX) {
    await db.doc(`campaigns/${CRYPT}/codex/${id}`).set({
      campaignId: CRYPT,
      ...entry,
      ...(entry.revealed ? { revealedAt: daysAgo(2, 22) } : {}),
      createdAt: now(),
      updatedAt: now(),
    });
    if (secret) {
      await db
        .doc(`campaigns/${CRYPT}/codex/${id}/private/gm`)
        .set({ secret, createdAt: now(), updatedAt: now() });
    }
  }
  for (let i = 0; i < QUESTS.length; i += 1) {
    const { id, milestones, ...quest } = QUESTS[i];
    await db.doc(`campaigns/${CRYPT}/quests/${id}`).set({
      campaignId: CRYPT,
      ...quest,
      order: i,
      milestones: milestones.map((kind) => ({
        kind,
        adventureId: "seed-adv-rumors",
        sessionId: SESSION_1,
        sessionNumber: 1,
      })),
      createdAt: now(),
      updatedAt: now(),
    });
  }
}

async function main() {
  console.log(`Seeding ${TARGET}…`);
  try {
    await db.doc("seedPing/ping").set({ at: Date.now() });
    await db.doc("seedPing/ping").delete();
  } catch (error) {
    console.error(
      REMOTE_PROJECT
        ? `\n✖ Cannot write to "${REMOTE_PROJECT}". Check the key and the service account's roles (Cloud Datastore User, Firebase Authentication Admin).\n`
        : "\n✖ Cannot reach the Firestore emulator. Start it first (`pnpm dev` or `pnpm emulators`).\n",
    );
    console.error(String((error as Error)?.message ?? error) + "\n");
    process.exit(1);
  }
  await wipe();
  await seed();

  console.log(
    "\n✔ Done. Test accounts (password for all: " +
      (REMOTE_PROJECT && !GENERATED_PASSWORD ? "SEED_PASSWORD" : PASSWORD) +
      "):\n",
  );
  for (const u of USERS) console.log(`   ${u.displayName.padEnd(6)} ${u.email}`);
  console.log(
    "\n   • Alice is GM of « La Crypte oubliée »: « Rumeurs à Val-Brume » played (recap, quests,\n" +
      "     codex), « L'entrée de la crypte » ready to play, « Le cœur de la crypte » in draft\n" +
      "   • Bob is GM of « Rumeurs à la taverne »\n" +
      "   • 5 characters seeded (Bob's Brann fell before Thorin)" +
      (REMOTE_PROJECT ? "\n" : "; emulator UI: http://127.0.0.1:4000\n"),
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
