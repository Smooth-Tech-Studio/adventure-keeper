import { z } from "zod";
import {
  abilityScoreBlockSchema,
  creatureSizeSchema,
  importColon,
  importErrorMap,
  issuePath,
  pick,
} from "@adventure-keeper/system-dnd2024";

import { enemyAttackSchema } from "./adventure-enemy";
import { gameSystemSchema } from "./campaign";
import { hexColorSchema, moneySchema } from "./character";
import { characterSystemSchema } from "./character-system";
import { CODEX_KINDS } from "./codex";
import { questStatusSchema, reputationSchema } from "./quest";

/**
 * Campaign and adventure files — what a GM prepared, to start a new campaign
 * (or add an adventure) from: `ak-campaign/1` and `ak-adventure/1`. Written by
 * the app's export or by hand. Only preparation travels: never members,
 * characters, played sessions, recaps or the GM's notebook. Every object is
 * strict — an unknown field is an error, not something silently dropped.
 *
 * Locations are referenced **by name** inside their adventure (an enemy's or an
 * NPC's `location`), so a hand-written file needs no ids.
 */

export const CAMPAIGN_FILE_FORMAT = "ak-campaign/1" as const;
export const ADVENTURE_FILE_FORMAT = "ak-adventure/1" as const;

const text = (max: number) => z.string().max(max);
const name = z.string().trim().min(1).max(160);

/** Planned loot, as written in a file: objects and coins, nothing else. */
export const filePlannedLootSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            quantity: z.number().int().min(1).max(100000).optional(),
          })
          .strict(),
      )
      .max(30)
      .optional(),
    money: moneySchema.partial().strict().optional(),
  })
  .strict();

export const fileLocationSchema = z
  .object({
    name,
    /** GM-only notes about the place. */
    description: text(5000).optional(),
    /** Map or illustration, as a link. */
    imageUrl: z.string().url().optional(),
    /** Veiled under the fog until the GM uncovers it. */
    hidden: z.boolean().optional(),
    /** What the place hides, to give in a session. */
    loot: filePlannedLootSchema.optional(),
  })
  .strict();

export const fileEnemySchema = z
  .object({
    name,
    description: text(2000).optional(),
    /** A monster of the SRD or of a pack this block was made from. */
    sourceMonsterId: z.string().min(1).max(120).optional(),
    /** Name of one of the adventure's locations. */
    location: name.optional(),
    color: hexColorSchema.optional(),
    size: creatureSizeSchema.optional(),
    armorClass: z.number().int().min(0).max(40),
    maxHitPoints: z.number().int().min(1),
    /** In metres (9 = 30 ft). */
    speed: z.number().min(0).optional(),
    abilityScores: abilityScoreBlockSchema.partial().optional(),
    challengeRating: text(10).optional(),
    attacks: z.array(enemyAttackSchema.strict()).max(20).optional(),
    imageUrl: z.string().url().optional(),
    notes: text(2000).optional(),
    /** What it carries, to give once it falls. */
    loot: filePlannedLootSchema.optional(),
  })
  .strict();

export const fileNpcSchema = z
  .object({
    name,
    personality: text(500).optional(),
    lore: text(5000).optional(),
    location: name.optional(),
    color: hexColorSchema.optional(),
  })
  .strict();

export const fileEventSchema = z
  .object({
    title: name,
    description: text(5000).optional(),
    /** What sets it off (« quand ils entrent dans la crypte »). */
    trigger: text(500).optional(),
    /** Due on the game clock: a day, a time (`HH:MM`), or both. */
    dueDay: z.number().int().min(1).max(100000).optional(),
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
  })
  .strict();

export const fileAdventureSchema = z
  .object({
    title: name,
    summary: text(2000).optional(),
    locations: z.array(fileLocationSchema).max(200).default([]),
    enemies: z.array(fileEnemySchema).max(200).default([]),
    npcs: z.array(fileNpcSchema).max(200).default([]),
    events: z.array(fileEventSchema).max(200).default([]),
  })
  .strict();
export type FileAdventure = z.infer<typeof fileAdventureSchema>;

export const fileCodexEntrySchema = z
  .object({
    kind: z.enum(CODEX_KINDS),
    name,
    /** What the players will learn, once revealed (Markdown). */
    summary: text(20000).optional(),
    /** The GM's side, never shown to players. */
    secret: text(20000).optional(),
    imageUrl: z.string().url().optional(),
    url: z.string().url().optional(),
    /** A faction's attitude toward the party (−3…+3). */
    reputation: reputationSchema.optional(),
  })
  .strict();

export const fileQuestSchema = z
  .object({
    title: name,
    summary: text(5000).optional(),
    status: questStatusSchema.optional(),
  })
  .strict();

/** A content pack the file's content relies on (its monsters, mostly). */
export const filePackRefSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: text(160).optional(),
    version: text(40).optional(),
  })
  .strict();

/**
 * How a file names the fifth edition: `"5e"`, for the game system and for the
 * sheet. The values the app stores (`dnd5e`, `dnd2024`) are still read, so a
 * file written before keeps importing.
 */
export const FILE_5E = "5e";
const fileGameSystemSchema = z.preprocess(
  (value) => (value === FILE_5E ? "dnd5e" : value),
  gameSystemSchema,
);
const fileCharacterSystemSchema = z.preprocess(
  (value) => (value === FILE_5E ? "dnd2024" : value),
  characterSystemSchema,
);

/** A stored value as a file writes it — the inverse of the two schemas above. */
export function fileSystemName(value: string): string {
  return value === "dnd5e" || value === "dnd2024" ? FILE_5E : value;
}

export const campaignFileSchema = z
  .object({
    format: z.literal(CAMPAIGN_FILE_FORMAT),
    campaign: z
      .object({
        name: z.string().trim().min(1).max(120),
        description: text(2000).optional(),
        system: fileGameSystemSchema,
        /** The system's own name, for « custom » and « other ». */
        systemLabel: text(80).optional(),
        characterSystem: fileCharacterSystemSchema,
      })
      .strict(),
    packs: z.array(filePackRefSchema).max(50).default([]),
    adventures: z.array(fileAdventureSchema).max(100).default([]),
    codex: z.array(fileCodexEntrySchema).max(1000).default([]),
    quests: z.array(fileQuestSchema).max(500).default([]),
  })
  .strict();
export type CampaignFile = z.infer<typeof campaignFileSchema>;

export const adventureFileSchema = z
  .object({
    format: z.literal(ADVENTURE_FILE_FORMAT),
    packs: z.array(filePackRefSchema).max(50).default([]),
    adventure: fileAdventureSchema,
  })
  .strict();
export type AdventureFile = z.infer<typeof adventureFileSchema>;

export type ParseFileResult<T> = { ok: true; file: T } | { ok: false; errors: string[] };

const LABELS: Record<string, { fr: string; en: string }> = {
  adventures: { fr: "Aventure", en: "Adventure" },
  locations: { fr: "Lieu", en: "Location" },
  enemies: { fr: "Ennemi", en: "Enemy" },
  npcs: { fr: "PNJ", en: "NPC" },
  events: { fr: "Temps fort", en: "Highlight" },
  codex: { fr: "Fiche du codex", en: "Codex entry" },
  quests: { fr: "Quête", en: "Quest" },
  packs: { fr: "Pack", en: "Pack" },
};

/** `adventures.1.enemies.2.armorClass` → `Aventure n°2 « L'entrée » › Ennemi n°3 « Gobelin » › armorClass`. */
function describePath(path: (string | number)[], raw: unknown): string {
  const parts: string[] = [];
  let node: unknown = raw;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    const label = typeof key === "string" ? LABELS[key] : undefined;
    if (label && typeof next === "number") {
      const entry = (node as Record<string, unknown[]> | undefined)?.[key]?.[next] as
        Record<string, unknown> | undefined;
      const title = entry?.name ?? entry?.title;
      const quoted =
        typeof title === "string" ? pick({ fr: ` « ${title} »`, en: ` “${title}”` }) : "";
      parts.push(`${pick(label)} ${pick({ fr: "n°", en: "#" })}${next + 1}${quoted}`);
      node = entry;
      i++;
    } else {
      parts.push(String(key));
      node = (node as Record<string | number, unknown> | undefined)?.[key];
    }
  }
  return parts.length ? parts.join(" › ") : pick({ fr: "Fichier", en: "File" });
}

/** Within an adventure: one location per name, and every reference resolves. */
function checkAdventure(adventure: FileAdventure, where: string): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const location of adventure.locations) {
    if (names.has(location.name)) {
      errors.push(
        pick({
          fr: `${where} : le lieu « ${location.name} » est présent deux fois.`,
          en: `${where}: the location “${location.name}” appears twice.`,
        }),
      );
    }
    names.add(location.name);
  }
  for (const [kind, list] of [
    ["enemies", adventure.enemies],
    ["npcs", adventure.npcs],
  ] as const) {
    for (const entry of list) {
      if (entry.location && !names.has(entry.location)) {
        errors.push(
          pick({
            fr: `${where} › ${pick(LABELS[kind])} « ${entry.name} » : le lieu « ${entry.location} » n'existe pas dans cette aventure.`,
            en: `${where} › ${pick(LABELS[kind])} “${entry.name}”: the location “${entry.location}” is not in this adventure.`,
          }),
        );
      }
    }
  }
  return errors;
}

function adventureWhere(index: number | null, title: string): string {
  const quoted = pick({ fr: ` « ${title} »`, en: ` “${title}”` });
  return index === null
    ? `${pick(LABELS.adventures)}${quoted}`
    : `${pick(LABELS.adventures)} ${pick({ fr: "n°", en: "#" })}${index + 1}${quoted}`;
}

/**
 * The JSON inside a pasted text. An AI's answer often wraps the file in a
 * Markdown code block (```json … ```) or puts a sentence before and after it:
 * keep what lies between the first `{` and the last `}`.
 */
export function extractJsonText(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const fenced = /```(?:json)?\s*\n([\s\S]*?)\n?```/i.exec(trimmed);
  const body = (fenced ? fenced[1] : trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

function parseWith<T>(
  schema: z.ZodType<T>,
  json: string,
  check: (file: T) => string[],
): ParseFileResult<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonText(json));
  } catch (error) {
    return {
      ok: false,
      errors: [
        pick({
          fr: `Ce fichier n'est pas du JSON valide (${(error as Error).message}).`,
          en: `This file is not valid JSON (${(error as Error).message}).`,
        }),
      ],
    };
  }
  const result = schema.safeParse(raw, { error: importErrorMap });
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (issue) => `${describePath(issuePath(issue.path), raw)}${importColon()}${issue.message}`,
      ),
    };
  }
  const errors = check(result.data);
  return errors.length ? { ok: false, errors } : { ok: true, file: result.data };
}

/** Read a campaign file (the text of a `.json`). */
export function parseCampaignFile(json: string): ParseFileResult<CampaignFile> {
  return parseWith(campaignFileSchema, json, (file) =>
    file.adventures.flatMap((adventure, index) =>
      checkAdventure(adventure, adventureWhere(index, adventure.title)),
    ),
  );
}

/** Read an adventure file (the text of a `.json`). */
export function parseAdventureFile(json: string): ParseFileResult<AdventureFile> {
  return parseWith(adventureFileSchema, json, (file) =>
    checkAdventure(file.adventure, adventureWhere(null, file.adventure.title)),
  );
}

/** A file's text, as the export writes it and the import reads it back. */
export function campaignFileToJson(file: CampaignFile | AdventureFile): string {
  const written =
    "campaign" in file
      ? {
          ...file,
          campaign: {
            ...file.campaign,
            system: fileSystemName(file.campaign.system),
            characterSystem: fileSystemName(file.campaign.characterSystem),
          },
        }
      : file;
  return `${JSON.stringify(written, null, 2)}\n`;
}
