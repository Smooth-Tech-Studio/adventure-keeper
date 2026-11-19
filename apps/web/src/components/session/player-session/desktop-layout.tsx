import { useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SheetTab<Id extends string = string> {
  id: Id;
  label: string;
  content: ReactNode;
}

/**
 * The player's sheet as a column beside the map: a fixed header (identity,
 * hit points, key numbers), tabs, and a footer that stays in place (« Fin de
 * mon tour »).
 */
export function SheetColumn<Id extends string>({
  header,
  tabs,
  footer,
  className,
  accent,
}: {
  header: ReactNode;
  tabs: SheetTab<Id>[];
  footer?: ReactNode;
  className?: string;
  /** The character's colour, for the selected tab. */
  accent?: string;
}) {
  const [active, setActive] = useState<Id>(tabs[0].id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section
      id="player-sheet-column"
      className={cn("bg-card flex min-h-0 flex-col overflow-hidden rounded-lg border", className)}
      style={{ "--char": accent ?? "var(--primary)" } as CSSProperties}
    >
      {header && <div className="shrink-0 border-b">{header}</div>}
      {tabs.length > 1 && (
        // The line under the tabs is drawn inside (a shadow): the selected tab's
        // border covers it without sticking out, so the row only scrolls sideways.
        <div
          role="tablist"
          className="flex shrink-0 gap-0.5 overflow-x-auto overflow-y-hidden px-2 shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none]"
        >
          {tabs.map((tab) => {
            const selected = tab.id === current.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`player-sheet-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls="player-sheet-panel"
                onClick={() => setActive(tab.id)}
                className={cn(
                  "text-muted-foreground hover:text-foreground border-b-2 border-transparent px-2.5 pt-2.5 pb-2 text-sm font-medium whitespace-nowrap",
                  selected && "text-foreground border-(--char,var(--primary))",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
      <div
        role="tabpanel"
        id="player-sheet-panel"
        aria-labelledby={`player-sheet-tab-${current.id}`}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [&>*]:shrink-0"
      >
        {current.content}
      </div>
      {footer && <div className="shrink-0 border-t p-3">{footer}</div>}
    </section>
  );
}
