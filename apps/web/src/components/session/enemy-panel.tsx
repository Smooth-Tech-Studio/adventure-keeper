import { useState } from "react";
import { Dice5Icon } from "lucide-react";
import type { AdventureEnemy, EnemyAttack, SessionCombatant } from "@adventure-keeper/schemas";
import {
  ABILITIES,
  ABILITY_ABBR,
  CONDITIONS_BY_LABEL,
  CONDITION_LABELS,
  CREATURE_SIZE_LABELS,
  DAMAGE_KIND_LABELS,
  abilityModifier,
  formatDicePool,
  formatDistance,
  metresToFeet,
  type Condition,
} from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HpPadDialog } from "@/components/session/hp-pad-dialog";
import { HpStepper } from "@/systems/dnd2024/session/player-session/vitals";
import { RollSheet, type RollRecord } from "@/systems/dnd2024/session/player-session/roll-sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStoredFlag } from "@/hooks/use-stored-flag";
import { signed } from "@/lib/format";
import type { RollSpec } from "@/systems/dnd2024/lib/player-actions";
import type { WithId } from "@/lib/collections";

interface Props {
  enemy: WithId<AdventureEnemy>;
  combatant: WithId<SessionCombatant>;
  onHitPoints: (id: string, value: number) => void;
  conditionsEnabled: boolean;
  onSetConditions: (conditions: Condition[]) => void;
}

/** GM side panel for the selected enemy combatant: stats + tappable attacks. */
export function EnemyPanel({
  enemy,
  combatant,
  onHitPoints,
  conditionsEnabled,
  onSetConditions,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "enemy" });
  const conditions = combatant.conditions ?? [];
  const [pad, setPad] = useState(false);

  return (
    <div className="grid gap-2 rounded-md border p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{enemy.name}</span>
        <span className="text-muted-foreground">
          {enemy.size ? `${CREATURE_SIZE_LABELS[enemy.size]} · ` : ""}
          {t("stats", {
            ac: enemy.armorClass,
            speed: formatDistance(metresToFeet(enemy.speed ?? 9)),
          })}
          {enemy.challengeRating ? t("cr", { cr: enemy.challengeRating }) : ""}
        </span>
      </div>

      {ABILITIES.some((a) => enemy.abilityScores?.[a] != null) && (
        <div className="grid grid-cols-6 gap-1">
          {ABILITIES.map((ability) => {
            const score = enemy.abilityScores?.[ability];
            return (
              <div key={ability} className="bg-muted/30 rounded border py-1 text-center">
                <div className="text-muted-foreground text-[10px]">{ABILITY_ABBR[ability]}</div>
                <div className="font-semibold">{score ?? "—"}</div>
                <div className="text-muted-foreground text-[10px] tabular-nums">
                  {score != null ? signed(abilityModifier(score)) : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{t("hp")}</span>
        <HpStepper
          size="sm"
          current={combatant.currentHitPoints}
          max={combatant.maxHitPoints}
          temp={0}
          onHitPoints={(value) => onHitPoints(combatant.id, value)}
          onTemp={() => {}}
          onValueClick={() => setPad(true)}
        />
      </div>
      <HpPadDialog
        target={
          pad
            ? {
                name: combatant.name,
                current: combatant.currentHitPoints,
                max: combatant.maxHitPoints,
              }
            : null
        }
        onClose={() => setPad(false)}
        onHitPoints={(value) => onHitPoints(combatant.id, value)}
      />

      <EnemyAttacks enemy={enemy} />

      {conditionsEnabled && (
        <div className="flex flex-wrap items-center gap-1 border-t pt-1">
          <span className="text-muted-foreground">{t("conditions")}</span>
          <ToggleGroup
            type="multiple"
            value={conditions}
            onValueChange={(v) => onSetConditions(v as Condition[])}
            className="gap-1"
          >
            {CONDITIONS_BY_LABEL.map((c) => (
              <ToggleGroupItem
                key={c}
                value={c}
                className="text-muted-foreground h-6 rounded border px-1.5"
              >
                {CONDITION_LABELS[c]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {enemy.notes && <p className="text-muted-foreground border-t pt-1">{enemy.notes}</p>}
    </div>
  );
}

/** An enemy attack as the roll sheet takes it: the attack, then the damage on a hit. */
function attackSpec(enemy: AdventureEnemy, atk: EnemyAttack): RollSpec | null {
  const label = `${enemy.name} · ${atk.name}`;
  const kind = atk.damageKind ? ` (${DAMAGE_KIND_LABELS[atk.damageKind]})` : "";
  const damage: RollSpec | undefined = atk.damage
    ? {
        label: `${label}${kind}`,
        kind: "degats",
        bonus: atk.damageBonus ?? 0,
        pool: atk.damage,
      }
    : undefined;
  if (atk.toHit !== undefined) {
    return { label, kind: "attaque", bonus: atk.toHit, next: damage };
  }
  return damage ?? null;
}

/**
 * An enemy's attacks, one tap to roll — in the same roll sheet as the
 * players': advantage / disadvantage, the app's dice or the GM's own, and
 * « Touché → dégâts » (doubled on a critical hit). `compact`: just the
 * buttons, for the turn's row in the combat list.
 */
export function EnemyAttacks({
  enemy,
  compact = false,
}: {
  enemy: WithId<AdventureEnemy>;
  compact?: boolean;
}) {
  const { t } = useTranslation("session", { keyPrefix: "enemy" });
  const wide = useMediaQuery("(min-width: 1024px)");
  const [ownDice, setOwnDice] = useStoredFlag("session-own-dice", false);
  const [spec, setSpec] = useState<RollSpec | null>(null);
  const [history, setHistory] = useState<RollRecord[]>([]);

  if (enemy.attacks.length === 0) {
    return compact ? null : <p className="text-muted-foreground text-xs">{t("noAttack")}</p>;
  }

  return (
    <div className="grid gap-1.5 text-xs">
      <ul className="grid gap-1">
        {enemy.attacks.map((atk, i) => {
          const roll = attackSpec(enemy, atk);
          const damage = atk.damage
            ? `${formatDicePool(atk.damage)}${atk.damageBonus ? signed(atk.damageBonus) : ""}`
            : null;
          return (
            <li
              key={i}
              className={compact ? "flex items-center gap-2" : "bg-muted/30 rounded border p-1.5"}
            >
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{atk.name}</span>
                {roll && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 shrink-0 px-1.5 text-[11px] tabular-nums"
                    aria-label={t("roll", { name: atk.name })}
                    onClick={() => setSpec(roll)}
                  >
                    <Dice5Icon className="size-3" />
                    {atk.toHit !== undefined ? signed(atk.toHit) : damage}
                    {atk.toHit !== undefined && damage && (
                      <span className="text-muted-foreground">· {damage}</span>
                    )}
                  </Button>
                )}
              </div>
              {!compact && (
                <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                  {atk.reach && <span>{atk.reach}</span>}
                  {atk.damageKind && <span>{DAMAGE_KIND_LABELS[atk.damageKind]}</span>}
                  {atk.notes && <span>{atk.notes}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {history[0] && !compact && (
        <p className="bg-muted/40 rounded border px-2 py-1 tabular-nums">
          {history[0].label} — <b>{history[0].total}</b>{" "}
          <span className="text-muted-foreground">{history[0].detail}</span>
        </p>
      )}
      <RollSheet
        spec={spec}
        wide={wide}
        ownDice={ownDice}
        onOwnDiceChange={setOwnDice}
        history={history}
        onRolled={(record) => setHistory((list) => [record, ...list].slice(0, 20))}
        onOpen={setSpec}
        onClose={() => setSpec(null)}
      />
    </div>
  );
}
