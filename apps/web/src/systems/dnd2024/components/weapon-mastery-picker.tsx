import { useMemo } from "react";
import {
  WEAPON_MASTERY_DESCRIPTIONS,
  WEAPON_MASTERY_LABELS,
  getClass,
  isWeaponProficient,
  weaponMasteryCount,
  weaponPropsFromDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useWeaponCatalog } from "@/systems/dnd2024/lib/equipment";
import type { ItemDraft } from "@/systems/dnd2024/lib/items";
import { compareText } from "@/lib/sort";

/**
 * Which kinds of weapon get a Weapon Mastery slot (2024: « deux types d'armes
 * de votre choix »), up to the class's count at this level. Every catalogue
 * weapon the class is trained with is offered, carried or not — the ones
 * already in the bag come first.
 */
export function WeaponMasteryPicker({
  classId,
  level,
  weapons,
  fromKit = false,
  value,
  onChange,
}: {
  classId: string;
  level: number;
  /** The weapons carried: listed first. */
  weapons: readonly ItemDraft[];
  /** During the creation, the weapons first are the packages' offer, not the bag yet. */
  fromKit?: boolean;
  /** Catalogue ids. */
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t, i18n } = useTranslation("characters", { keyPrefix: "mastery" });
  const catalog = useWeaponCatalog();
  const klass = classId ? getClass(classId) : undefined;
  const slots = classId ? weaponMasteryCount(classId, level) : 0;
  const carried = useMemo(
    () => new Set(weapons.map((weapon) => weapon.catalogId).filter(Boolean)),
    [weapons],
  );
  const candidates = useMemo(
    () =>
      (catalog ?? [])
        .filter(
          (def) =>
            def.mastery &&
            klass &&
            isWeaponProficient(klass.weaponProficiency, weaponPropsFromDef(def)),
        )
        .sort(
          (a, b) =>
            Number(carried.has(b.id)) - Number(carried.has(a.id)) || compareText(a.name, b.name),
        ),
    // Sorted on the names, which follow the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, klass, carried, i18n.language],
  );

  function toggle(id: string) {
    const current = new Set(value);
    if (current.has(id)) current.delete(id);
    else if (current.size < slots) current.add(id);
    onChange([...current]);
  }

  return (
    <div className="grid gap-2">
      <Label>{t("title", { picked: value.length, count: slots })}</Label>
      <p className="text-muted-foreground text-xs">{t("intro")}</p>
      {catalog === null ? (
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      ) : (
        <ul className="grid gap-2">
          {candidates.map((weapon) => {
            const checked = value.includes(weapon.id);
            const mastery = weapon.mastery;
            return (
              <li key={weapon.id} className="flex gap-2 text-sm">
                <Checkbox
                  id={`mastery-${weapon.id}`}
                  className="mt-0.5"
                  checked={checked}
                  disabled={!checked && value.length >= slots}
                  onCheckedChange={() => toggle(weapon.id)}
                />
                <div className="grid gap-0.5">
                  <Label htmlFor={`mastery-${weapon.id}`} className="font-normal">
                    {weapon.name}
                    {mastery && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {WEAPON_MASTERY_LABELS[mastery]}
                      </span>
                    )}
                    {carried.has(weapon.id) && (
                      <Badge variant="secondary" className="ml-1">
                        {fromKit ? t("inKit") : t("carried")}
                      </Badge>
                    )}
                  </Label>
                  {mastery && (
                    <p className="text-muted-foreground text-xs">
                      {WEAPON_MASTERY_DESCRIPTIONS[mastery]}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
