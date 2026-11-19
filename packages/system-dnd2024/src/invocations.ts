/**
 * 5e 2024 Warlock « Manifestations occultes » (Eldritch Invocations).
 *
 * Names, prerequisites and the per-level count follow the class table on
 * https://www.aidedd.org/regles-24/classes/occultiste/ and the invocation list on
 * https://www.aidedd.org/invocation/fr/. Every `summary` is a short reminder in
 * our own words — a memory jogger, not rules text.
 *
 * In the 2024 rules the three Pacts (lame / chaîne / grimoire) are themselves
 * invocations, and several others require one of them (`requires`).
 */

import { z } from "zod";
import type { Ability } from "./abilities";
import type { DicePool } from "./dice";
import { compareLabels, localizedList, pick, translateTree, type Shadow } from "./locale";
import { activeContent } from "./packs/active";
import SRD_INVOCATIONS from "./srd/invocations.json";

export interface InvocationSpellGrant {
  /** Spell id, as found in the web app's `spells.json`. */
  spellId: string;
  /** `0` for a cantrip, `>= 1` for a leveled spell. */
  spellLevel: number;
}

export interface InvocationDef {
  id: string;
  name: string;
  /** Warlock level needed to take it (`0` = no level requirement). */
  minLevel: number;
  /** Another invocation that must already be chosen (a Pact, Lame assoiffée). */
  requires?: string;
  /** Prerequisite we can't check automatically (e.g. a damaging cantrip), shown as a hint. */
  condition?: string;
  summary: string;
  /** May be taken again — each time on a different cantrip when `cantrip` is set. */
  repeatable?: boolean;
  /**
   * The pick is tied to one of the Warlock's cantrips: one that deals damage
   * (`"damage"`) or that needs an attack roll (`"attack"`). Stored as `spellId`.
   */
  cantrip?: "damage" | "attack";
  /** Spells cast at will / once per rest without a slot — listed as always prepared. */
  spells?: InvocationSpellGrant[];
  /** AC while wearing no body armour: this + Dex (Armure d'ombres: 13). */
  unarmoredAc?: number;
  /** Darkvision range in feet. */
  darkvision?: number;
  /** Truesight range in feet. */
  truesight?: number;
  /** Swim speed equal to the walking speed. */
  swimSpeed?: boolean;
}

/** The SRD invocations, read from `srd/invocations.json` (the pack format). */
const INVOCATION_DEFS: InvocationDef[] = SRD_INVOCATIONS.entries as unknown as InvocationDef[];

{
  const english = SRD_INVOCATIONS.translations.en as Record<string, Shadow>;
  INVOCATION_DEFS.forEach((def) => translateTree(def, { en: english[def.id] }));
}

/** Every invocation, sorted alphabetically by name (engine locale). */
export const INVOCATIONS: InvocationDef[] = localizedList(() =>
  [...INVOCATION_DEFS].sort((a, b) => compareLabels(a.name, b.name)),
);

export function getInvocation(id: string): InvocationDef | undefined {
  return (
    activeContent()?.invocations.get(id) ??
    INVOCATION_DEFS.find((invocation) => invocation.id === id)
  );
}

/** The SRD invocations then the active packs', sorted by name (engine locale). */
export function allInvocations(): InvocationDef[] {
  const packs = activeContent()?.invocations;
  return packs
    ? [...INVOCATION_DEFS, ...packs.values()].sort((a, b) => compareLabels(a.name, b.name))
    : INVOCATIONS;
}

/** A chosen invocation; `spellId` is the cantrip it is attached to, when it needs one. */
export const invocationPickSchema = z.object({
  id: z.string().min(1),
  spellId: z.string().min(1).optional(),
});
export type InvocationPick = z.infer<typeof invocationPickSchema>;

/** As stored: a pick, or a bare id from sheets saved before picks carried a cantrip. */
export const invocationPickInputSchema = z.union([
  invocationPickSchema,
  z
    .string()
    .min(1)
    .transform((id): InvocationPick => ({ id })),
]);

/**
 * Sheets first saved this feature as plain ids: read a `string` as `{ id }` so
 * they keep working.
 */
export function normalizeInvocationPicks(
  value: readonly (InvocationPick | string)[] | null | undefined,
): InvocationPick[] {
  return (value ?? []).map((pick) => (typeof pick === "string" ? { id: pick } : pick));
}

/** `true` when the level and the required invocation (if any) are both satisfied. */
export function invocationAvailable(
  invocation: InvocationDef,
  level: number,
  chosen: readonly string[],
): boolean {
  return (
    level >= invocation.minLevel && (!invocation.requires || chosen.includes(invocation.requires))
  );
}

/**
 * Keep only the picks that still hold, in the order given: known id, no
 * duplicate (a repeatable one may repeat on another cantrip), a cantrip when the
 * invocation needs one (and, when `knownCantrips` is given, one the character
 * still knows), level reached, prerequisite invocation still chosen. Iterates to
 * a fixed point so dropping a Pact also drops what depended on it.
 */
export function validInvocations(
  picks: readonly (InvocationPick | string)[],
  level: number,
  knownCantrips?: readonly string[],
): InvocationPick[] {
  const seen = new Set<string>();
  let current: InvocationPick[] = [];
  for (const pick of normalizeInvocationPicks(picks)) {
    const def = getInvocation(pick.id);
    if (!def) continue;
    if (
      def.cantrip &&
      (!pick.spellId || (knownCantrips && !knownCantrips.includes(pick.spellId)))
    ) {
      continue;
    }
    const key = def.cantrip ? `${pick.id}:${pick.spellId}` : pick.id;
    if (!def.repeatable || def.cantrip) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    current.push(def.cantrip ? { id: pick.id, spellId: pick.spellId } : { id: pick.id });
  }
  for (;;) {
    const ids = current.map((pick) => pick.id);
    const next = current.filter((pick) => invocationAvailable(getInvocation(pick.id)!, level, ids));
    if (next.length === current.length) return next;
    current = next;
  }
}

// --- Automatic effects ------------------------------------------------------

/** What the chosen invocations change on the derived sheet. */
export interface InvocationEffects {
  /** Base AC without body armour (Armure d'ombres), or `null`. */
  unarmoredAc: number | null;
  darkvision: number;
  truesight: number;
  swimSpeed: boolean;
  /** Pacte de la lame chosen: the pact weapon attacks with Charisma. */
  pactBlade: boolean;
  /** Buveuse de vie: extra damage with the pact weapon. */
  lifedrinker: boolean;
}

/** Aggregate the sheet-level effects of already-valid picks (see {@link validInvocations}). */
export function invocationEffects(picks: readonly InvocationPick[]): InvocationEffects {
  const defs = picks.map((pick) => getInvocation(pick.id)).filter((d): d is InvocationDef => !!d);
  return {
    unarmoredAc: defs.reduce<number | null>(
      (best, d) => (d.unarmoredAc != null ? Math.max(best ?? 0, d.unarmoredAc) : best),
      null,
    ),
    darkvision: Math.max(0, ...defs.map((d) => d.darkvision ?? 0)),
    truesight: Math.max(0, ...defs.map((d) => d.truesight ?? 0)),
    swimSpeed: defs.some((d) => d.swimSpeed),
    pactBlade: defs.some((d) => d.id === "pact-of-the-blade"),
    lifedrinker: defs.some((d) => d.id === "lifedrinker"),
  };
}

/** Reminders for the invocations whose effect can't be folded into a number. */
export function invocationCombatNotes(input: {
  picks: readonly InvocationPick[];
  level: number;
  chaMod: number;
  /** Level of the Pact Magic slots, for Frappe occulte's damage. */
  pactSlotLevel?: number;
  /** A pact weapon is designated on the sheet. */
  hasPactWeapon: boolean;
}): string[] {
  const has = (id: string) => input.picks.some((pick) => pick.id === id);
  const notes: string[] = [];

  if (has("pact-of-the-blade")) {
    notes.push(
      input.hasPactWeapon
        ? "Arme de pacte : dégâts nécrotiques, psychiques ou radiants au choix."
        : "Pacte de la lame : désignez une arme de corps à corps comme arme de pacte (section « Sorts » de la fiche) pour attaquer avec votre Charisme.",
    );
  }
  if (has("thirsting-blade")) {
    notes.push(
      `Lame ${has("devouring-blade") ? "dévorante" : "assoiffée"} : avec l'action Attaquer, attaquez ${
        has("devouring-blade") ? 3 : 2
      } fois avec l'arme de pacte.`,
    );
  }
  if (has("eldritch-smite")) {
    const slot = input.pactSlotLevel;
    notes.push(
      `Frappe occulte : une fois par tour, sur un coup de l'arme de pacte, dépensez un emplacement de pacte${
        slot ? ` (niv ${slot})` : ""
      } pour ${slot ? `${1 + slot}d8` : "1d8 + 1d8 par niveau d'emplacement"} de dégâts de force en plus, et la cible tombe à terre.`,
    );
  }
  if (has("lifedrinker")) {
    notes.push(
      "Buveuse de vie : +1d6 dégâts (nécrotiques, psychiques ou radiants) avec l'arme de pacte — ajouté dans le calculateur ; un dé de vie dépensé vous soigne.",
    );
  }
  if (has("eldritch-mind")) {
    notes.push(
      "Esprit occulte : avantage aux jets de sauvegarde de Constitution pour maintenir votre concentration.",
    );
  }
  if (has("agonizing-blast")) {
    notes.push(
      `Décharge déchirante : +${input.chaMod} (Charisme) aux dégâts du sort mineur associé — ajouté dans le calculateur.`,
    );
  }
  if (has("repelling-blast")) {
    notes.push(
      "Décharge répulsive : sur un coup du sort mineur associé, la cible est repoussée jusqu'à 3 m.",
    );
  }
  if (has("eldritch-spear")) {
    notes.push(
      `Lance occulte : portée du sort mineur associé augmentée de ${9 * Math.max(1, input.level)} m (9 m par niveau d'occultiste).`,
    );
  }
  return notes;
}

/** A modifier the calculator adds by itself (mirrors the web app's `RollSource`). */
export interface InvocationRollSource {
  label: string;
  flat?: number;
  dice?: DicePool;
  /** A remark instead of a number (advantage, …). */
  hint?: string;
}

/** The roll being prepared, as far as invocations care. */
export type InvocationRoll =
  | {
      kind: "damage";
      /** A spell's damage roll. */
      spellId?: string;
      /** A weapon's damage roll (item id). */
      weaponId?: string;
      /** Dice in the spell's pool — Décharge occulte fires that many beams. */
      damageDiceCount?: number;
    }
  | { kind: "save"; ability: Ability; concentrating: boolean };

/** Bonuses the roll calculator lists under « Autres sources ». */
export function invocationRollSources(input: {
  picks: readonly InvocationPick[];
  chaMod: number;
  pactWeaponId?: string;
  roll: InvocationRoll;
}): InvocationRollSource[] {
  const out: InvocationRollSource[] = [];
  const { picks, roll } = input;

  if (roll.kind === "damage") {
    // Décharge déchirante: + Cha to the chosen cantrip — once per beam of Décharge occulte.
    if (
      roll.spellId &&
      picks.some((p) => p.id === "agonizing-blast" && p.spellId === roll.spellId)
    ) {
      const beams = roll.spellId === "eldritch-blast" ? Math.max(1, roll.damageDiceCount ?? 1) : 1;
      out.push({
        label: pick({ fr: "Décharge déchirante", en: "Agonizing Blast" }),
        flat: input.chaMod * beams,
      });
    }
    // Buveuse de vie: 1d6 on a pact-weapon hit.
    if (
      roll.weaponId &&
      roll.weaponId === input.pactWeaponId &&
      picks.some((p) => p.id === "lifedrinker") &&
      picks.some((p) => p.id === "pact-of-the-blade")
    ) {
      out.push({
        label: pick({ fr: "Buveuse de vie", en: "Lifedrinker" }),
        dice: { count: 1, die: "d6" },
      });
    }
  }

  if (
    roll.kind === "save" &&
    roll.ability === "con" &&
    roll.concentrating &&
    picks.some((p) => p.id === "eldritch-mind")
  ) {
    out.push({
      label: pick({ fr: "Esprit occulte", en: "Eldritch Mind" }),
      hint: pick({ fr: "avantage (concentration)", en: "advantage (Concentration)" }),
    });
  }

  return out;
}
