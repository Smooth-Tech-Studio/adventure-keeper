import { ShieldIcon } from "lucide-react";
import { isDnd2024Character } from "@adventure-keeper/schemas";
import {
  ABILITIES,
  ABILITY_ABBR,
  ALIGNMENT_LABELS,
  getBackground,
} from "@adventure-keeper/system-dnd2024";

import { Badge } from "@/components/ui/badge";
import { tr } from "@/i18n";
import { signed } from "@/lib/format";
import type { CharacterFactsProps } from "@/systems/screen-types";

/** Proficiency bonus, alignment and background, next to the hit points. */
export function ListBadges({ character }: CharacterFactsProps) {
  if (!isDnd2024Character(character)) return null;
  return (
    <>
      <Badge variant="secondary">
        <ShieldIcon />{" "}
        {tr("characters:list.proficiency", { value: signed(character.proficiencyBonus) })}
      </Badge>
      <Badge variant="outline">
        {ALIGNMENT_LABELS[character.alignment] ?? character.alignment}
      </Badge>
      <Badge variant="outline">
        {getBackground(character.backgroundId)?.name ?? character.backgroundId}
      </Badge>
    </>
  );
}

/** The six abilities: score and modifier. */
export function ListFigures({ character }: CharacterFactsProps) {
  if (!isDnd2024Character(character)) return null;
  return (
    <div className="text-muted-foreground grid grid-cols-6 gap-1 text-center text-xs">
      {ABILITIES.map((ability) => (
        <div key={ability}>
          <div className="font-medium">{ABILITY_ABBR[ability]}</div>
          <div>{character.adjustedAbilityScores[ability]}</div>
          <div>{signed(character.abilityModifiers[ability])}</div>
        </div>
      ))}
    </div>
  );
}
