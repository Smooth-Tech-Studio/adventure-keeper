import { Link } from "react-router-dom";
import { PawPrintIcon, Undo2Icon } from "lucide-react";
import type { AdventureParticipant, Dnd2024Character } from "@adventure-keeper/schemas";
import {
  ABILITY_ABBR,
  abilityModifier,
  knownWildShapeForms,
  wildShapeRules,
  type MonsterDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { beastMovement as movement } from "@/systems/dnd2024/lib/companions";
import { CreatureAttacks } from "@/systems/dnd2024/session/player-sheet/familiar-card";
import { wildShapeBeast } from "@/systems/dnd2024/lib/companions";
import { signed } from "@/lib/format";
import type { RollSpec } from "@/systems/dnd2024/lib/player-actions";

/**
 * The druid's Wild Shape, on « Actions »: the forms known (picked on the sheet,
 * at a level-up or from its editor — not in play), a tap to become one — a use
 * spent, the druid level in temporary HP — and, while transformed, the beast's
 * numbers and attacks.
 */
export function WildShapeCard({
  character,
  participant,
  usesLeft,
  sheetHref,
  onShape,
  onRoll,
}: {
  character: Dnd2024Character;
  participant: AdventureParticipant;
  /** Wild Shape uses left before the next rest. */
  usesLeft: number;
  /** The character's sheet, where the forms are picked. */
  sheetHref: string;
  /** Become this beast, or `null` to take one's own shape back. */
  onShape: (monster: MonsterDef | null) => void;
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session");
  const level = character.level ?? 1;
  const rules = wildShapeRules(level);
  const known = knownWildShapeForms(character.wildShapeForms ?? [], level);
  const shape = participant.wildShape ? wildShapeBeast(participant.wildShape.monsterId) : null;

  return (
    <section className="flex flex-col gap-2" aria-label={t("wildShape.title")}>
      <div className="flex items-center gap-2">
        <h3 className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
          {t("wildShape.title")}
        </h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t("wildShape.uses", { count: usesLeft })}
        </span>
      </div>

      {shape ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-emerald-500/50 bg-emerald-500/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <PawPrintIcon className="size-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            {/* The button wraps below the name on a phone rather than cutting it. */}
            <div className="min-w-[9rem] flex-1">
              <div className="font-semibold">{t("wildShape.as", { name: shape.monster.name })}</div>
              <div className="text-muted-foreground truncate text-xs">
                {t("familiar.ac", { ac: shape.monster.armorClass })} · {movement(shape.monster)}
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => onShape(null)}>
              <Undo2Icon /> {t("wildShape.revert")}
            </Button>
          </div>
          {shape.stats && (
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {(["str", "dex", "con"] as const).map((ability) => (
                <div key={ability} className="bg-card rounded-lg border py-1">
                  <div className="text-muted-foreground text-[10px] uppercase">
                    {ABILITY_ABBR[ability]}
                  </div>
                  <div className="text-sm font-bold tabular-nums">
                    {shape.stats![ability]}{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      {signed(abilityModifier(shape.stats![ability]))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {shape.attacks.length > 0 && (
            <CreatureAttacks owner={shape.monster.name} attacks={shape.attacks} onRoll={onRoll} />
          )}
          <p className="text-muted-foreground text-xs">{t("wildShape.rules")}</p>
        </div>
      ) : (
        <div className="bg-card flex flex-col gap-2 rounded-xl border p-3">
          {known.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("wildShape.noForm")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {known.map((monster) => (
                <li key={monster.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{monster.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {t("wildShape.cr", { cr: monster.cr })} ·{" "}
                      {t("familiar.ac", { ac: monster.armorClass })} · {movement(monster)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={usesLeft <= 0}
                    onClick={() => onShape(monster)}
                    aria-label={t("wildShape.becomeOne", { name: monster.name })}
                  >
                    {t("wildShape.become")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button asChild size="sm" variant="ghost" className="self-start">
            <Link to={sheetHref}>
              {t("wildShape.known", { count: known.length, max: rules.formsKnown })}
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
