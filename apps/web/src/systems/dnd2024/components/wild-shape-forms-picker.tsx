import { wildShapeForms, wildShapeRules } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { beastMovement } from "@/systems/dnd2024/lib/companions";

/**
 * The druid's Wild Shape forms known: the beasts the level allows (CR, no
 * flight before level 8), up to as many as it allows. Used on the sheet and
 * at a level-up; in play, the session only lists them.
 */
export function WildShapeFormsPicker({
  level,
  value,
  onChange,
}: {
  level: number;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation("session");
  const rules = wildShapeRules(level);
  const beasts = wildShapeForms(level);
  // Forms no longer allowed (or gone from the bank) do not count.
  const picked = value.filter((id) => beasts.some((monster) => monster.id === id));
  const full = picked.length >= rules.formsKnown;
  return (
    <section id="wild-shape-forms" className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t("wildShape.chooseIntro", { count: rules.formsKnown, cr: rules.maxChallengeLabel })}
          {!rules.canFly && ` ${t("wildShape.noFly")}`}
        </p>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {picked.length} / {rules.formsKnown}
        </span>
      </div>
      <ul className="divide-y rounded-lg border">
        {beasts.map((monster) => {
          const checked = picked.includes(monster.id);
          return (
            <li key={monster.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2">
                <Checkbox
                  checked={checked}
                  disabled={!checked && full}
                  onCheckedChange={(on) =>
                    onChange(
                      on === true
                        ? [...picked, monster.id]
                        : picked.filter((id) => id !== monster.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{monster.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {t("wildShape.cr", { cr: monster.cr })} ·{" "}
                    {t("familiar.ac", { ac: monster.armorClass })} ·{" "}
                    {t("familiar.hp", { hp: monster.hitPoints })} · {beastMovement(monster)}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
