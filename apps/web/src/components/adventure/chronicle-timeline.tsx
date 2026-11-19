import { GemIcon, ScrollTextIcon, SkullIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { sessionSpanLabel } from "@/lib/game-time";
import type { ChroniclePart } from "@/lib/chronicle-markdown";

/** One highlight of a session: an icon says what kind, the label says it aloud. */
interface Line {
  icon: LucideIcon;
  label: string;
  text: string;
}
const line = (icon: LucideIcon, label: string, text: string): Line => ({ icon, label, text });

/**
 * The story at a glance, before the recaps: one stop per session — when it
 * was played, the date in the world if the GM kept one — with its highlights,
 * the foes that fell, the quests that moved and what was found.
 */
export function ChronicleTimeline({
  parts,
  showAdventures,
  heading,
}: {
  parts: (ChroniclePart & { adventureId: string })[];
  /** The campaign book: each adventure opens its stretch of the timeline. */
  showAdventures: boolean;
  heading: (number: number, title?: string) => string;
}) {
  const { t } = useTranslation(["adventures", "session"]);
  return (
    <section
      id="chronicle-timeline"
      aria-label={t("book.timeline")}
      className="flex flex-col gap-3"
    >
      <h2 className="text-lg font-semibold">{t("book.timeline")}</h2>
      {parts
        .filter((part) => part.chapters.length > 0)
        .map((part) => (
          <div key={part.adventureId} className="flex flex-col gap-2">
            {showAdventures && (
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {part.adventure}
              </p>
            )}
            <ol className="border-border ml-1.5 flex flex-col gap-4 border-l-2 pl-5">
              {part.chapters.map((c) => {
                const lines: Line[] = [
                  ...c.events.map((e) => line(SparklesIcon, t("book.lineEvent"), e.title)),
                  ...(c.defeated.length > 0
                    ? [line(SkullIcon, t("recap.prefillDefeated"), c.defeated.join(", "))]
                    : []),
                  ...c.quests.map((q) => line(ScrollTextIcon, t("book.lineQuest"), q)),
                  ...(c.loot.length > 0
                    ? [line(GemIcon, t("recap.prefillLoot"), c.loot.join(", "))]
                    : []),
                ];
                return (
                  <li key={c.sessionId} className="relative">
                    <span
                      aria-hidden
                      className="bg-primary ring-background absolute top-1.5 -left-[27px] size-2.5 rounded-full ring-4"
                    />
                    <p className="text-sm font-semibold">{heading(c.number, c.title)}</p>
                    <p className="text-muted-foreground text-xs">
                      {[
                        sessionSpanLabel(c.playedAt, c.endedAt),
                        c.gameDay && t("session:clock.day", { day: c.gameDay }),
                        c.gameDate,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {lines.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                        {lines.map(({ icon: Icon, label, text }, index) => (
                          <li key={index} className="flex items-start gap-1.5">
                            <Icon
                              aria-label={label}
                              className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
                            />
                            <span>{text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
    </section>
  );
}
