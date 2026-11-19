import {
  ABILITY_ABBR,
  ARMOR_CATEGORY_LABELS,
  DAMAGE_TYPE_LABELS,
  TOOL_CATEGORY_DESCRIPTIONS,
  TOOL_CATEGORY_LABELS,
  WEAPON_MASTERY_DESCRIPTIONS,
  WEAPON_MASTERY_LABELS,
  WEAPON_PROPERTY_DESCRIPTIONS,
  WEAPON_PROPERTY_LABELS,
  armorClassFormula,
  formatDicePool,
  getClass,
  isWeaponProficient,
  weaponPropertyLabels,
  type WeaponMastery,
  type WeaponProperty,
} from "@adventure-keeper/system-dnd2024";
import type { Item } from "@adventure-keeper/schemas";
import { tr } from "@/i18n";

/**
 * Read-only chips describing a catalogue weapon. `includeMastery` is `false` for
 * classes without a Weapon Mastery feature — the weapon's mastery is catalogue
 * trivia they can't use, so it stays off their sheet (same rule as
 * {@link weaponGlossary}).
 */
export function weaponItemBadges(item: Pick<Item, "weapon">, includeMastery = true): string[] {
  if (!item.weapon) return [];
  if (item.weapon.category === "focus") {
    return [tr("common:badges.focus")];
  }
  const badges: string[] = [];
  const dice = item.weapon.damageDice ? formatDicePool(item.weapon.damageDice) : "";
  if (dice) {
    badges.push(
      item.weapon.damageType ? `${dice} ${DAMAGE_TYPE_LABELS[item.weapon.damageType]}` : dice,
    );
  }
  badges.push(...weaponPropertyLabels(item.weapon));
  if (includeMastery && item.weapon.mastery) {
    badges.push(tr("common:badges.mastery", { name: WEAPON_MASTERY_LABELS[item.weapon.mastery] }));
  }
  return badges;
}

const notTrained = () => tr("common:badges.notTrained");

/**
 * A soft warning (never a block) when a weapon is outside the class's weapon
 * proficiency. Focuses don't attack, so they're never flagged.
 */
export function weaponTrainingWarning(
  item: Pick<Item, "weapon">,
  classId: string | undefined,
): string | null {
  const klass = classId ? getClass(classId) : undefined;
  if (!klass || !item.weapon || item.weapon.category === "focus") return null;
  return isWeaponProficient(klass.weaponProficiency, item.weapon) ? null : notTrained();
}

/** Same soft warning for armour and shields, against the class's armour training. */
export function armorTrainingWarning(
  item: Pick<Item, "armor">,
  classId: string | undefined,
): string | null {
  const klass = classId ? getClass(classId) : undefined;
  if (!klass || !item.armor) return null;
  return klass.armorTraining.includes(item.armor.category) ? null : notTrained();
}

/** Read-only chips describing a catalogue armour. */
export function armorItemBadges(item: Pick<Item, "armor">): string[] {
  if (!item.armor) return [];
  const badges = [tr("common:badges.ac", { formula: armorClassFormula(item.armor) })];
  if (item.armor.strengthMin)
    badges.push(tr("common:badges.strength", { min: item.armor.strengthMin }));
  if (item.armor.stealthDisadvantage) badges.push(tr("common:badges.stealth"));
  if (item.armor.equipped) badges.push(tr("common:badges.equipped"));
  return badges;
}

/** Read-only chips describing a catalogue tool. */
export function toolItemBadges(item: Pick<Item, "tool">): string[] {
  if (!item.tool) return [];
  return [`${TOOL_CATEGORY_LABELS[item.tool.category]} · ${ABILITY_ABBR[item.tool.ability]}`];
}

/** `+3` / `-1` / `0`. */
export function signedModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export interface GlossaryEntry {
  term: string;
  description: string;
}

/**
 * The distinct weapon properties + masteries carried across a set of weapons,
 * each with its plain-language description — an aide-mémoire for the sheet.
 *
 * `includeMasteries` is `false` for classes without a Weapon Mastery feature:
 * the mastery of a weapon they carry is catalogue trivia, not something they
 * can use, so it stays off their sheet.
 */
export function weaponGlossary(
  weapons: Pick<Item, "weapon">[],
  includeMasteries = true,
): GlossaryEntry[] {
  const properties = new Set<WeaponProperty>();
  const masteries = new Set<WeaponMastery>();
  for (const { weapon } of weapons) {
    if (!weapon) continue;
    for (const property of weapon.properties) properties.add(property);
    if (weapon.mastery) masteries.add(weapon.mastery);
  }
  return [
    ...[...properties].map((property) => ({
      term: WEAPON_PROPERTY_LABELS[property],
      description: WEAPON_PROPERTY_DESCRIPTIONS[property],
    })),
    ...(includeMasteries
      ? [...masteries].map((mastery) => ({
          term: tr("common:badges.masteryTerm", { name: WEAPON_MASTERY_LABELS[mastery] }),
          description: WEAPON_MASTERY_DESCRIPTIONS[mastery],
        }))
      : []),
  ];
}

/** What an owned tool lets its user do (by category). */
export function toolUsage(item: Pick<Item, "tool">): string | undefined {
  return item.tool ? TOOL_CATEGORY_DESCRIPTIONS[item.tool.category] : undefined;
}

/** A property, mastery or trait of an item, with what it does (shown on demand). */
export interface ItemTag {
  label: string;
  description?: string;
  /** A weapon mastery: told apart from the properties. */
  mastery?: boolean;
}

/**
 * A weapon's properties and mastery as tags, each with its rule. The mastery
 * only for a class with Weapon Mastery (same rule as {@link weaponItemBadges}).
 */
export function weaponTags(item: Pick<Item, "weapon">, includeMastery = true): ItemTag[] {
  if (!item.weapon || item.weapon.category === "focus") return [];
  const labels = weaponPropertyLabels(item.weapon);
  const tags: ItemTag[] = item.weapon.properties.map((property, index) => ({
    label: labels[index],
    description: WEAPON_PROPERTY_DESCRIPTIONS[property],
  }));
  if (includeMastery && item.weapon.mastery) {
    tags.push({
      label: tr("common:badges.mastery", { name: WEAPON_MASTERY_LABELS[item.weapon.mastery] }),
      description: WEAPON_MASTERY_DESCRIPTIONS[item.weapon.mastery],
      mastery: true,
    });
  }
  return tags;
}

/** « 2d6 tranchant » — a weapon's damage, or what a focus is for. */
export function weaponDamage(item: Pick<Item, "weapon">): string {
  if (!item.weapon) return "";
  if (item.weapon.category === "focus") return tr("common:badges.focus");
  const dice = item.weapon.damageDice ? formatDicePool(item.weapon.damageDice) : "";
  return item.weapon.damageType ? `${dice} ${DAMAGE_TYPE_LABELS[item.weapon.damageType]}` : dice;
}

/** An armour's category, Strength requirement and Stealth penalty as tags. */
export function armorTags(item: Pick<Item, "armor">): ItemTag[] {
  if (!item.armor) return [];
  const tags: ItemTag[] = [{ label: ARMOR_CATEGORY_LABELS[item.armor.category] }];
  if (item.armor.strengthMin) {
    tags.push({
      label: tr("common:badges.strength", { min: item.armor.strengthMin }),
      description: tr("common:badges.strengthHint", { min: item.armor.strengthMin }),
    });
  }
  if (item.armor.stealthDisadvantage) {
    tags.push({
      label: tr("common:badges.stealth"),
      description: tr("common:badges.stealthHint"),
    });
  }
  return tags;
}
