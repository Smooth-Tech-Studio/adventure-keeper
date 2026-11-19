import { useState } from "react";
import { SwordsIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ABILITIES,
  ABILITY_ABBR,
  CREATURE_SIZES,
  CREATURE_SIZE_LABELS,
  feetToMetres,
  metresToFeet,
  type MonsterDef,
} from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EnemyAttackListEditor } from "@/components/adventure/enemy-attack-list-editor";
import {
  LocationLinkSelect,
  type LocationOption,
} from "@/components/adventure/location-link-select";
import { PlannedLootField } from "@/components/adventure/planned-loot-field";
import { MonsterPicker } from "@/components/adventure/monster-picker";
import { monsterEnemyAttacks } from "@/components/adventure/drafts";
import type { EnemyFormValues } from "@/components/adventure/enemy-form";

const NO_SIZE = "__none__";

/** Add / edit dialog for an adventure enemy *type*. Shared by creation & detail. */
export function EnemyFormDialog({
  open,
  onOpenChange,
  initial,
  locationOptions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EnemyFormValues;
  locationOptions: LocationOption[];
  onSave: (values: EnemyFormValues) => void | Promise<void>;
}) {
  const { t, i18n } = useTranslation(["adventures", "common"]);
  // The speed is stored in metres; English shows it in feet.
  const inFeet = i18n.language === "en";
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Refill the form when the dialog opens, not on every render: `initial` is
  // a new object each time the parent renders, which would wipe the typing.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initial);
  }

  const set = (patch: Partial<EnemyFormValues>) => setForm((f) => ({ ...f, ...patch }));

  function applyMonster(monster: MonsterDef) {
    set({
      sourceMonsterId: monster.id,
      name: form.name.trim() && !form.sourceMonsterId ? form.name : monster.name,
      armorClass: String(monster.armorClass),
      maxHitPoints: String(monster.hitPoints),
      // Monsters count in feet; an enemy's speed is in metres.
      speed: String(feetToMetres(monster.speed)),
      challengeRating: monster.cr,
      size: monster.size,
      attacks: monsterEnemyAttacks(monster.id),
      abilityScores: {}, // the catalogue doesn't carry ability scores — start fresh
    });
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error(t("enemies.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("enemies.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <MonsterPicker
            trigger={
              <Button type="button" variant="outline" size="sm" className="self-start">
                <SwordsIcon />
                {form.sourceMonsterId ? t("enemies.changeMonster") : t("enemies.fromMonster")}
              </Button>
            }
            onPick={applyMonster}
          />

          <div className="grid gap-1">
            <Label className="text-xs">{t("enemies.name")}</Label>
            <Input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["armorClass", t("common:stats.acShort")],
                ["maxHitPoints", t("common:stats.hpShort")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid gap-1">
                <Label className="text-[10px]">{label}</Label>
                <Input
                  type="number"
                  value={form[key]}
                  onChange={(e) => set({ [key]: e.target.value } as Partial<EnemyFormValues>)}
                />
              </div>
            ))}
            <div className="grid gap-1">
              <Label className="text-[10px]">
                {inFeet ? t("common:stats.speedFeet") : t("common:stats.speedMetres")}
              </Label>
              <Input
                type="number"
                value={
                  inFeet && form.speed !== ""
                    ? String(metresToFeet(Number(form.speed)))
                    : form.speed
                }
                onChange={(e) =>
                  set({
                    speed:
                      inFeet && e.target.value !== ""
                        ? String(feetToMetres(Number(e.target.value)))
                        : e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px]">{t("enemies.size")}</Label>
              <Select
                value={form.size ?? NO_SIZE}
                onValueChange={(v) =>
                  set({ size: v === NO_SIZE ? undefined : (v as EnemyFormValues["size"]) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SIZE}>—</SelectItem>
                  {CREATURE_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CREATURE_SIZE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-[10px]">{t("enemies.abilities")}</Label>
            <div className="grid grid-cols-6 gap-1">
              {ABILITIES.map((ability) => (
                <div key={ability} className="grid gap-0.5">
                  <span className="text-muted-foreground text-center text-[10px]">
                    {ABILITY_ABBR[ability]}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    className="h-8 px-1 text-center"
                    value={form.abilityScores[ability] ?? ""}
                    onChange={(e) =>
                      set({ abilityScores: { ...form.abilityScores, [ability]: e.target.value } })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <EnemyAttackListEditor value={form.attacks} onChange={(attacks) => set({ attacks })} />

          <LocationLinkSelect
            options={locationOptions}
            value={form.locationId}
            onChange={(locationId) => set({ locationId })}
          />

          <PlannedLootField idPrefix="enemy" value={form.loot} onChange={(loot) => set({ loot })} />

          <Textarea
            rows={2}
            placeholder={t("enemies.notes")}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
