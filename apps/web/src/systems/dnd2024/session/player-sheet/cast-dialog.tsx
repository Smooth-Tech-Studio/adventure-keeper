import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import type {
  AdventureParticipant,
  AdventureParticipantPlayerUpdate,
  Dnd2024Character,
} from "@adventure-keeper/schemas";
import type { SpellDef } from "@adventure-keeper/system-dnd2024";
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
import {
  defaultSlot,
  slotOptions,
  spellRoll,
  spendSlot,
  type RollSpec,
} from "@/systems/dnd2024/lib/player-actions";
import { cn } from "@/lib/utils";

/**
 * Casting a spell of level 1 or more: the slot it uses — the lowest one left by
 * default, a higher one to upcast, the pact's for a warlock — or none, only
 * when the rules allow it: a ritual, or a spell a species, a feat or an
 * invocation lets the character cast without a slot. « Lancer » spends the
 * slot, takes up the concentration, then opens the roll at that level.
 */

/** Grants whose spell is cast without a slot (once per long rest, or at will). */
const FREE_CASTING_SOURCES = new Set(["species", "feat", "invocation"]);
export function CastDialog({
  spell,
  character,
  participant,
  onParticipantStateChange,
  onRoll,
  onCast,
  onClose,
}: {
  spell: SpellDef | null;
  character: Dnd2024Character;
  participant: AdventureParticipant;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
  onRoll: (spec: RollSpec) => void;
  /** Once cast — « Appel de familier » then calls the familiar. */
  onCast?: (spell: SpellDef) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={spell !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {spell && (
          <CastBody
            key={spell.id}
            spell={spell}
            character={character}
            participant={participant}
            onParticipantStateChange={onParticipantStateChange}
            onRoll={onRoll}
            onCast={onCast}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CastBody({
  spell,
  character,
  participant,
  onParticipantStateChange,
  onRoll,
  onCast,
  onClose,
}: {
  spell: SpellDef;
  character: Dnd2024Character;
  participant: AdventureParticipant;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
  onRoll: (spec: RollSpec) => void;
  onCast?: (spell: SpellDef) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player.cast" });
  const used = participant.spellSlotsUsed ?? {};
  const options = slotOptions(character, used, spell.level);
  // The grant that lets this spell go without a slot, if any.
  const freeGrant = (character.grantedSpells ?? []).find(
    (grant) => grant.spellId === spell.id && FREE_CASTING_SOURCES.has(grant.source),
  );
  const canGoFree = spell.ritual || freeGrant !== undefined;
  // A slot key, or `"free"`: no slot (a ritual, a free casting from a grant).
  const [picked, setPicked] = useState<string>(
    () => defaultSlot(options)?.key ?? (canGoFree ? "free" : ""),
  );
  const option = options.find((o) => o.key === picked);
  const ready = picked === "free" || (option !== undefined && option.left > 0);
  const concentrating = participant.concentration;

  function cast() {
    const patch: AdventureParticipantPlayerUpdate = {};
    if (option) patch.spellSlotsUsed = spendSlot(used, option);
    if (spell.concentration) patch.concentration = { spellId: spell.id, label: spell.name };
    if (Object.keys(patch).length > 0) onParticipantStateChange(patch);
    toast(t("cast", { name: spell.name }), {
      description: option
        ? option.pact
          ? t("spentPact", { level: option.level })
          : t("spent", { level: option.level })
        : t("noSlotSpent"),
    });
    const roll = spellRoll(character, spell, option?.level);
    onClose();
    if (roll) onRoll(roll);
    onCast?.(spell);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <SparklesIcon className="size-5" /> {spell.name}
        </DialogTitle>
        <DialogDescription>{t("intro", { level: spell.level })}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label={t("slot")} className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={picked === o.key}
              disabled={o.left === 0}
              onClick={() => setPicked(o.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold tabular-nums disabled:line-through disabled:opacity-40",
                picked === o.key && "border-(--char,var(--primary)) bg-(--char,var(--primary))/15",
              )}
            >
              {o.pact ? t("pactOption", { level: o.level }) : t("levelOption", { level: o.level })}{" "}
              <span className="text-muted-foreground">
                {o.left}/{o.max}
              </span>
            </button>
          ))}
          {canGoFree && (
            <button
              type="button"
              role="radio"
              aria-checked={picked === "free"}
              onClick={() => setPicked("free")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                picked === "free" && "border-(--char,var(--primary)) bg-(--char,var(--primary))/15",
              )}
            >
              {spell.ritual ? t("ritual") : t("free", { source: freeGrant!.sourceLabel })}
            </button>
          )}
        </div>
        {options.every((o) => o.left === 0) && !canGoFree && (
          <p className="text-destructive text-xs">{t("noSlotLeft")}</p>
        )}
        {spell.concentration && concentrating && concentrating.spellId !== spell.id && (
          <p className="text-xs text-violet-600 dark:text-violet-300">
            {t("dropsConcentration", { name: concentrating.label })}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="button" disabled={!ready} onClick={cast}>
          {t("confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
