import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Props {
  /** The location image / map surface. */
  map: ReactNode;
  /** Top bar, left side — the current location name, before the clock. */
  location?: ReactNode;
  /** Top bar, left side — the in-game clock. */
  clock?: ReactNode;
  /** Top bar, right side — GM actions (menu, eraser, fog brush…). */
  actions?: ReactNode;
  /** Right bar — the turn-order strip. */
  turnOrder?: ReactNode;
  /** Bottom bar — the active combatant HUD. */
  combatHud?: ReactNode;
  className?: string;
}

/**
 * The play area: the map plus a `pointer-events-none` HUD layer laid out in
 * three bars (top / right / bottom). Only the widgets themselves take pointer
 * events, so dragging tokens and painting fog still work through the gaps.
 */
export function SessionStage({
  map,
  location,
  clock,
  actions,
  turnOrder,
  combatHud,
  className,
}: Props) {
  return (
    <div
      id="session-stage"
      className={cn(
        "bg-muted/20 relative min-h-0 overflow-hidden rounded-lg border max-lg:aspect-video",
        className,
      )}
    >
      {map}

      <div id="session-stage-hud" className="pointer-events-none absolute inset-0">
        <div
          id="session-stage-topbar"
          className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 [&>*]:pointer-events-auto"
        >
          <div id="session-clock-slot" className="flex min-w-0 flex-wrap items-start gap-2">
            {location}
            {clock}
          </div>
          <div id="session-mj-actions" className="flex shrink-0 items-center gap-1.5">
            {actions}
          </div>
        </div>

        {turnOrder && (
          <div
            id="session-stage-rightbar"
            className="absolute top-16 right-3 bottom-16 flex max-w-[calc(100%-1.5rem)] flex-col items-end [&>*]:pointer-events-auto"
          >
            {turnOrder}
          </div>
        )}

        {combatHud && (
          <div
            id="session-stage-bottombar"
            className="absolute inset-x-0 bottom-0 flex justify-end pr-4 [&>*]:pointer-events-auto"
          >
            {combatHud}
          </div>
        )}
      </div>
    </div>
  );
}
