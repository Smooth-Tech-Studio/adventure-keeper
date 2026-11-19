import { useState } from "react";
import type {
  AdventureParticipant,
  AdventureParticipantPlayerUpdate,
  Dnd2024Character,
} from "@adventure-keeper/schemas";
import {
  CONDITION_LABELS,
  CONDITION_SUMMARY,
  type Condition,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Item } from "@/components/ui/item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WithId } from "@/lib/collections";
import { Pips } from "@/systems/dnd2024/session/player-sheet/pips";

interface Props {
  character: WithId<Dnd2024Character>;
  participant: WithId<AdventureParticipant>;
  /** GM has turned on condition tracking for this adventure. */
  conditionsEnabled: boolean;
  currentHitPoints: number;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
}

/** A compact label/value pill, with an optional tooltip explaining it. */
function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "accent";
  hint?: string;
}) {
  const pill = (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 rounded border px-1.5 py-0.5 text-xs tabular-nums",
        tone === "accent" ? "border-primary/40 bg-primary/5" : "bg-muted/40",
        hint && "cursor-help",
      )}
    >
      <span className="text-muted-foreground text-[10px] uppercase">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
  if (!hint) return pill;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

export function SessionHud({
  character,
  participant,
  conditionsEnabled,
  currentHitPoints,
  onParticipantStateChange,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.hud" });
  const [viewedCondition, setViewedCondition] = useState<Condition | null>(null);

  const deathSaves = participant.deathSaves ?? { successes: 0, failures: 0 };
  const conditions = participant.conditions ?? [];
  const exhaustion = participant.exhaustion ?? 0;
  const caster = character.spellcastingAbility != null;
  return (
    <div className="flex flex-col gap-2">
      {/* Death saves — only at 0 HP */}
      {currentHitPoints <= 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("successes")}</span>
            <Pips
              total={3}
              filled={deathSaves.successes}
              tone="success"
              label={t("saveSuccess")}
              onChange={(successes) =>
                onParticipantStateChange({ deathSaves: { ...deathSaves, successes } })
              }
            />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("failures")}</span>
            <Pips
              total={3}
              filled={deathSaves.failures}
              tone="destructive"
              label={t("saveFailure")}
              onChange={(failures) =>
                onParticipantStateChange({ deathSaves: { ...deathSaves, failures } })
              }
            />
          </span>
        </div>
      )}

      {/* Derived stats */}
      <div className="flex flex-wrap gap-1">
        {caster && character.spellSaveDc != null && (
          <Stat
            label={t("spellDc")}
            value={character.spellSaveDc}
            tone="accent"
            hint={t("spellDcHint")}
          />
        )}
        {conditionsEnabled && exhaustion > 0 && (
          <span className="border-destructive/40 bg-destructive/10 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs">
            {t("exhaustion", { level: exhaustion })}
          </span>
        )}
      </div>

      {/* Conditions — set by the GM, read-only here (tap for the effect) */}
      {conditionsEnabled && conditions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">{t("conditions")}</span>
          {conditions.map((c) => (
            <Item asChild key={c} size="chip" variant="muted" className="border text-xs">
              <button type="button" onClick={() => setViewedCondition(c)}>
                {CONDITION_LABELS[c]}
              </button>
            </Item>
          ))}
        </div>
      )}

      {/* Condition reminder */}
      <Dialog open={viewedCondition !== null} onOpenChange={(o) => !o && setViewedCondition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewedCondition ? CONDITION_LABELS[viewedCondition] : ""}</DialogTitle>
          </DialogHeader>
          {viewedCondition && (
            <p className="text-muted-foreground text-sm">{CONDITION_SUMMARY[viewedCondition]}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
