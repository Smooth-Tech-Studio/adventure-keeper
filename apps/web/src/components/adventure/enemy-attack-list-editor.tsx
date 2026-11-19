import { PlusIcon, Trash2Icon } from "lucide-react";
import type { EnemyAttack } from "@adventure-keeper/schemas";
import { DAMAGE_KINDS, DAMAGE_KIND_LABELS } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DicePoolField } from "@/systems/dnd2024/components/dice-pool-field";

interface Props {
  value: EnemyAttack[];
  onChange: (next: EnemyAttack[]) => void;
}

const blank = (): EnemyAttack => ({
  name: "",
  toHit: 4,
  damage: { count: 1, die: "d6" },
  damageBonus: 2,
  damageKind: "slashing",
});

/** Editor for an enemy's attack list — the "simple" model. */
export function EnemyAttackListEditor({ value, onChange }: Props) {
  const { t } = useTranslation("adventures", { keyPrefix: "enemies" });
  const patch = (i: number, p: Partial<EnemyAttack>) =>
    onChange(value.map((atk, index) => (index === i ? { ...atk, ...p } : atk)));

  return (
    <div className="grid gap-2">
      <Label className="text-xs">{t("attacks")}</Label>
      {value.map((atk, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder={t("attackName")}
              value={atk.name}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 shrink-0"
              aria-label={t("deleteAttack")}
              onClick={() => onChange(value.filter((_, index) => index !== i))}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <div className="grid gap-1">
              <Label className="text-[10px]">{t("toHit")}</Label>
              <Input
                type="number"
                value={atk.toHit ?? ""}
                onChange={(e) =>
                  patch(i, {
                    toHit: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px]">{t("reach")}</Label>
              <Input
                placeholder={t("reachPlaceholder")}
                value={atk.reach ?? ""}
                onChange={(e) => patch(i, { reach: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_4rem_1fr] items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-[10px]">{t("dice")}</Label>
              <DicePoolField
                value={atk.damage}
                onChange={(damage) => patch(i, { damage })}
                clearable
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px]">{t("bonus")}</Label>
              <Input
                type="number"
                value={atk.damageBonus ?? ""}
                onChange={(e) =>
                  patch(i, {
                    damageBonus: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px]">{t("type")}</Label>
              <Select
                value={atk.damageKind ?? "slashing"}
                onValueChange={(v) => patch(i, { damageKind: v as EnemyAttack["damageKind"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAMAGE_KINDS.filter((k) => k !== "heal").map((k) => (
                    <SelectItem key={k} value={k}>
                      {DAMAGE_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Input
            placeholder={t("attackNotes")}
            value={atk.notes ?? ""}
            onChange={(e) => patch(i, { notes: e.target.value || undefined })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...value, blank()])}
      >
        <PlusIcon /> {t("addAttack")}
      </Button>
    </div>
  );
}
