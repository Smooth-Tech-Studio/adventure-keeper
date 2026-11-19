import {
  ABILITY_LABELS,
  proficiencyBonus,
  resolveAmount,
  type Ability,
  type FeatureUses,
} from "@adventure-keeper/system-dnd2024";

import { tr } from "@/i18n";

/**
 * How often a limited feature can be used, in words, at a given level:
 * « 3 fois par repos long », « Modificateur de Charisme (min. 1) par repos
 * long, court dès le niv. 5 ». A count that grows with the level also says
 * when it grows next — what the feature brings level after level.
 */
export function featureUsesText(
  uses: FeatureUses,
  level: number,
  abilityModifiers?: Record<Ability, number>,
): string {
  const { max } = uses;
  const short =
    uses.recharge === "short" || (uses.shortFrom !== undefined && level >= uses.shortFrom);
  const recharge = tr(short ? "common:uses.short" : "common:uses.long");
  const later =
    uses.shortFrom && level < uses.shortFrom
      ? tr("common:uses.shortFrom", { level: uses.shortFrom })
      : "";

  let count: string;
  if (typeof max === "object" && "ability" in max && !abilityModifiers) {
    count = tr("common:uses.ability", { ability: ABILITY_LABELS[max.ability], min: max.min ?? 1 });
  } else {
    const value = Math.max(
      1,
      resolveAmount(max, {
        level,
        proficiencyBonus: proficiencyBonus(level),
        abilityModifiers: abilityModifiers ?? { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      }),
    );
    count = tr("common:uses.times", { count: value });
    if (max === "prof" || max === "halfProf") count += tr("common:uses.withProficiency");
    if (typeof max === "object" && "perLevel" in max) {
      count += tr("common:uses.perLevel", { per: max.perLevel });
    }
  }

  const next =
    typeof max === "object" && "byLevel" in max
      ? [...max.byLevel]
          .filter(([from]) => from > level)
          .sort((a, b) => a[0] - b[0])
          .map(([from, value]) => tr("common:uses.step", { value, level: from }))
      : [];

  return [
    `${count} ${recharge}${later}`,
    next.length > 0 ? tr("common:uses.then", { steps: next.join(", ") }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
