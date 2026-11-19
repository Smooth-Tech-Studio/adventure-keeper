import { useRef, type CSSProperties, type ReactNode } from "react";
import { Dice5Icon, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useSwipe } from "@/hooks/use-swipe";
import { cn } from "@/lib/utils";

export interface PhoneTab<Id extends string = string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
  /** Something happened there (a document shown, the player's turn). */
  dot?: boolean;
}

/**
 * The player's session on a phone: a bar at the top, one tab at a time, the
 * tab bar at the bottom — a sideways swipe moves between tabs — and the dice
 * button always within thumb's reach.
 */
export function PhoneLayout<Id extends string>({
  tabs,
  active,
  onActiveChange,
  header,
  onDice,
  accent,
}: {
  tabs: PhoneTab<Id>[];
  active: Id;
  onActiveChange: (id: Id) => void;
  header: ReactNode;
  onDice?: () => void;
  /** The character's colour: the active tab and the dice button take it. */
  accent?: string;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === active),
  );
  const current = tabs[index];

  function show(id: Id) {
    onActiveChange(id);
    scrollRef.current?.scrollTo({ top: 0 });
  }
  const swipe = useSwipe(
    (step) => {
      const target = tabs[index + step];
      if (target) show(target.id);
    },
    { touchOnly: true },
  );

  return (
    // Under the app's navbar (h-14): the whole remaining screen, no page scroll.
    <div
      id="player-phone"
      className="relative flex h-[calc(100dvh-3.5rem)] flex-col"
      style={{ "--char": accent ?? "var(--primary)" } as CSSProperties}
    >
      <div className="bg-background shrink-0 border-b px-3 py-2">{header}</div>
      <div
        ref={scrollRef}
        role="tabpanel"
        id={`player-tab-${current.id}`}
        aria-labelledby={`player-tab-button-${current.id}`}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto"
        {...swipe}
      >
        <div className="flex flex-col gap-3 px-3 pt-3 pb-24">{current.content}</div>
      </div>
      <nav
        role="tablist"
        aria-label={t("tabsLabel")}
        className="bg-card grid shrink-0 border-t pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const selected = tab.id === current.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`player-tab-button-${tab.id}`}
              aria-selected={selected}
              aria-controls={`player-tab-${tab.id}`}
              onClick={() => show(tab.id)}
              className={cn(
                "relative grid justify-items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium",
                selected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {selected && (
                <span className="absolute inset-x-[30%] -top-px h-0.5 rounded-full bg-(--char,var(--primary))" />
              )}
              <Icon className={cn("size-5", selected && "text-(--char,var(--primary))")} />
              {tab.label}
              {tab.dot && !selected && (
                <span className="absolute top-1.5 right-[calc(50%-1rem)] size-2 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>
      {onDice && (
        <button
          type="button"
          onClick={onDice}
          aria-label={t("rollDice")}
          className="absolute right-4 bottom-20 z-20 grid size-14 place-items-center rounded-full bg-(--char,var(--primary)) text-white shadow-lg ring-4 ring-(--char,var(--primary))/20"
        >
          <Dice5Icon className="size-6" />
        </button>
      )}
    </div>
  );
}
