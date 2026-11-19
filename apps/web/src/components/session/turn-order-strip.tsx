import type { SessionCombat, SessionCombatant } from "@adventure-keeper/schemas";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { tokenLabel } from "@/lib/format";
import type { WithId } from "@/lib/collections";
import { combatantColor } from "@/lib/combatant-color";

interface Props {
  combat: SessionCombat;
  combatantsById: Record<string, WithId<SessionCombatant>>;
  className?: string;
  id?: string;
}

/** Turn-order icons, top-to-bottom in initiative order; the active one is larger. */
export function TurnOrderStrip({ combat, combatantsById, className, id }: Props) {
  const items = combat.order
    .map((id, index) => ({ id, index, combatant: combatantsById[id] }))
    .filter((entry) => entry.combatant);

  if (items.length === 0) return null;

  return (
    <div
      id={id}
      className={cn("flex flex-col items-end gap-1 overflow-y-auto rounded-2xl p-1", className)}
    >
      {items.map(({ id, index, combatant }) => {
        const active = index === combat.turnIndex;
        const dead = combatant.currentHitPoints <= 0;
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white transition-all",
                  active ? "size-9 border-white" : "size-7 border-transparent opacity-80",
                  dead && "opacity-40 grayscale",
                )}
                style={{
                  backgroundColor: combatantColor(combatant),
                }}
              >
                {tokenLabel(combatant.name)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              {combatant.name} — init. {combatant.initiative ?? "?"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
