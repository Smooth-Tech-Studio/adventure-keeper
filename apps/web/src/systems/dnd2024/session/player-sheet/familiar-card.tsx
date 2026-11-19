import { useState } from "react";
import { PawPrintIcon, SwordsIcon, XIcon } from "lucide-react";
import type { Companion, EnemyAttack } from "@adventure-keeper/schemas";
import {
  DAMAGE_KIND_LABELS,
  beastStats,
  familiarForms,
  formatDicePool,
  formatDistance,
  monsterMeta,
  type MonsterDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HpStepper } from "@/systems/dnd2024/session/player-session/vitals";
import { attackRoll } from "@/systems/dnd2024/lib/companions";
import { signed } from "@/lib/format";
import type { RollSpec } from "@/systems/dnd2024/lib/player-actions";
import { cn } from "@/lib/utils";

/** A creature's attacks as rows to tap: the attack roll, then the damage. */
export function CreatureAttacks({
  owner,
  attacks,
  onRoll,
}: {
  owner: string;
  attacks: EnemyAttack[];
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "creature" });
  return (
    <ul className="divide-y rounded-lg border">
      {attacks.map((attack, i) => {
        const roll = attackRoll(owner, attack);
        const damage = attack.damage
          ? `${formatDicePool(attack.damage)}${attack.damageBonus ? signed(attack.damageBonus) : ""}`
          : null;
        return (
          <li key={i}>
            <button
              type="button"
              disabled={!roll}
              onClick={() => roll && onRoll(roll)}
              aria-label={t("roll", { name: attack.name })}
              className="hover:bg-accent/60 flex w-full items-center gap-2 px-2.5 py-2 text-left disabled:cursor-default"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{attack.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {[attack.damageKind && DAMAGE_KIND_LABELS[attack.damageKind], attack.notes]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="text-muted-foreground shrink-0 text-sm font-semibold tabular-nums">
                {attack.toHit !== undefined && (
                  <span className="text-foreground">{signed(attack.toHit)}</span>
                )}
                {attack.toHit !== undefined && damage && " · "}
                {damage}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The familiar, on the player's « Actions »: its numbers, its HP (on its token
 * during a fight), its attacks — and bringing it into the fight, or sending it
 * away. Without one, a button calls it.
 */
export function FamiliarCard({
  companion,
  hitPoints,
  canSummon,
  inCombat,
  onSummon,
  onHitPoints,
  onJoinCombat,
  onDismiss,
  onRoll,
}: {
  companion: Companion | undefined;
  /** Its HP: the token's in a fight, else the sheet's. */
  hitPoints: number | undefined;
  /** The character knows how to call one (the spell, the pact, Wild Companion). */
  canSummon: boolean;
  /** A fight is running and the familiar is not in it yet: offer to join. */
  inCombat: "none" | "joinable" | "in";
  onSummon: () => void;
  onHitPoints: (value: number) => void;
  onJoinCombat: () => void;
  onDismiss: () => void;
  onRoll: (spec: RollSpec) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "familiar" });
  if (!companion) {
    if (!canSummon) return null;
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t("title")}
        </h3>
        <Button type="button" variant="outline" className="self-start" onClick={onSummon}>
          <PawPrintIcon /> {t("summon")}
        </Button>
      </section>
    );
  }
  const hp = hitPoints ?? companion.currentHitPoints;
  return (
    <section className="flex flex-col gap-2" aria-label={t("title")}>
      <div className="flex items-center gap-2">
        <h3 className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
          {t("title")}
        </h3>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-7 px-2 text-xs"
          onClick={onDismiss}
        >
          <XIcon className="size-3.5" /> {t("dismiss")}
        </Button>
      </div>
      <div className="bg-card flex flex-col gap-2.5 rounded-xl border p-3">
        <div className="flex items-center gap-2">
          <PawPrintIcon className="text-muted-foreground size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{companion.name}</div>
            <div className="text-muted-foreground truncate text-xs">
              {[
                companion.formName !== companion.name && companion.formName,
                t("ac", { ac: companion.armorClass }),
                formatDistance(companion.speed),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <HpStepper
            size="sm"
            current={hp}
            max={companion.maxHitPoints}
            temp={0}
            onHitPoints={onHitPoints}
            onTemp={() => {}}
          />
        </div>
        {hp <= 0 && <p className="text-destructive text-xs">{t("down")}</p>}
        {companion.attacks.length > 0 && (
          <CreatureAttacks owner={companion.name} attacks={companion.attacks} onRoll={onRoll} />
        )}
        <p className="text-muted-foreground text-xs">{t("rules")}</p>
        {inCombat === "joinable" && (
          <Button type="button" size="sm" className="self-start" onClick={onJoinCombat}>
            <SwordsIcon /> {t("join")}
          </Button>
        )}
      </div>
    </section>
  );
}

/** Calling a familiar: its form (the listed beasts, any beast of CR 0), then its name. */
export function SummonFamiliarDialog({
  open,
  onOpenChange,
  onSummon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSummon: (monster: MonsterDef, name: string) => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "familiar" });
  const forms = familiarForms();
  const [picked, setPicked] = useState<string>(forms[0]?.id ?? "");
  const [name, setName] = useState("");
  const form = forms.find((m) => m.id === picked);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] grid-cols-1 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("summonTitle")}</DialogTitle>
          <DialogDescription>{t("summonIntro")}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={t("form")} className="grid gap-1.5 sm:grid-cols-2">
          {forms.map((monster) => {
            const stats = beastStats(monster.id);
            const moves = [
              stats?.fly && t("fly", { speed: formatDistance(stats.fly) }),
              stats?.swim && t("swim", { speed: formatDistance(stats.swim) }),
              stats?.climb && t("climb", { speed: formatDistance(stats.climb) }),
            ].filter(Boolean);
            return (
              <button
                key={monster.id}
                type="button"
                role="radio"
                aria-checked={picked === monster.id}
                onClick={() => setPicked(monster.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left",
                  picked === monster.id &&
                    "border-(--char,var(--primary)) bg-(--char,var(--primary))/10",
                )}
              >
                <span className="block text-sm font-semibold">{monster.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {[
                    t("ac", { ac: monster.armorClass }),
                    t("hp", { hp: monster.hitPoints }),
                    ...moves,
                  ].join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
        <label className="grid gap-1.5 text-sm">
          {t("name")}
          <Input
            value={name}
            placeholder={form?.name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </label>
        {form && <p className="text-muted-foreground text-xs">{monsterMeta(form)}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!form}
            onClick={() => {
              if (!form) return;
              onSummon(form, name);
              setName("");
            }}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
