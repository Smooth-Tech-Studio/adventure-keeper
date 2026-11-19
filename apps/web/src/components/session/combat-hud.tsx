import { useState } from "react";
import { ChevronLeftIcon, MinusIcon, PlusIcon, SkipForwardIcon, Trash2Icon } from "lucide-react";
import type { SessionCombat, SessionCombatant } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { tokenLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WithId } from "@/lib/collections";
import { combatantColor } from "@/lib/combatant-color";

interface Props {
  combat: SessionCombat;
  combatantsById: Record<string, WithId<SessionCombatant>>;
  /** GM gets the turn / HP / destroy controls; players just watch. */
  canControl: boolean;
  /** uid of the viewer, to hide HP steppers on their own character. */
  currentUid?: string;
  onNext?: () => void;
  onHitPoints?: (id: string, value: number) => void;
  onDestroy?: (id: string) => void;
}

/** Bottom-of-map bar showing the active combatant; collapsible via the top tab. */
export function CombatHud({
  combat,
  combatantsById,
  canControl,
  currentUid,
  onNext,
  onHitPoints,
  onDestroy,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "hud" });
  const [collapsed, setCollapsed] = useState(false);

  const activeId = combat.order[combat.turnIndex];
  const active = combatantsById[activeId];
  // A stale id (combatant deleted) must not hide the bar: the GM still needs "Suivant".
  if (!active) {
    if (!canControl) return null;
    return (
      <div
        id="session-combat-hud"
        className="bg-background/95 flex items-center gap-3 rounded-t-xl border border-b-0 px-3 py-2 shadow-lg backdrop-blur"
      >
        <span className="text-muted-foreground text-sm">
          {t("removed", { round: combat.round })}
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={onNext}>
          <SkipForwardIcon /> {t("next")}
        </Button>
      </div>
    );
  }

  const isOwnCharacter = active.kind === "participant" && active.playerId === currentUid;
  const showHp = canControl && !isOwnCharacter;
  const clamp = (v: number) => Math.max(0, Math.min(active.maxHitPoints, v));

  return (
    <div
      id="session-combat-hud"
      className="bg-background/95 relative flex max-w-full flex-wrap items-center gap-3 rounded-t-xl border border-b-0 px-3 py-2 shadow-lg backdrop-blur"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t("show") : t("hide")}
        className="bg-background/95 hover:bg-accent absolute top-1/2 -left-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm backdrop-blur"
      >
        <ChevronLeftIcon
          className={cn("size-3.5 transition-transform", !collapsed && "rotate-180")}
        />
      </button>

      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
          style={{
            backgroundColor: combatantColor(active),
          }}
        >
          {tokenLabel(active.name)}
        </span>
        <div className="leading-tight">
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {active.kind !== "enemy"
              ? t("turnPlayer", { round: combat.round })
              : active.ally
                ? t("turnAlly", { round: combat.round })
                : t("turnEnemy", { round: combat.round })}
          </div>
          <div className="text-sm font-semibold">{active.name}</div>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flex items-center gap-1 text-sm">
            {showHp && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={t("minusHp")}
                onClick={() => onHitPoints?.(activeId, clamp(active.currentHitPoints - 1))}
              >
                <MinusIcon className="size-3.5" />
              </Button>
            )}
            <span className="tabular-nums">
              {active.currentHitPoints}/{active.maxHitPoints} PV
            </span>
            {showHp && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={t("plusHp")}
                onClick={() => onHitPoints?.(activeId, clamp(active.currentHitPoints + 1))}
              >
                <PlusIcon className="size-3.5" />
              </Button>
            )}
          </div>

          {canControl && (
            <div className="flex items-center gap-1">
              {active.kind === "enemy" && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDestroy?.(activeId)}
                >
                  <Trash2Icon /> {t("destroy")}
                </Button>
              )}
              <Button type="button" size="sm" variant="secondary" onClick={onNext}>
                <SkipForwardIcon /> {t("next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
