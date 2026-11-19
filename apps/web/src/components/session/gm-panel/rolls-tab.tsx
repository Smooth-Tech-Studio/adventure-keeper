import type { AdventureParticipant } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import type { WithId } from "@/lib/collections";

/** How many rolls the tab lists, every player together. */
const SHOWN = 60;

/**
 * « Jets » — every player's last rolls, newest first, as each sheet keeps
 * them on its participant: who, what, the dice and the total.
 */
export function RollsTab({ participants }: { participants: WithId<AdventureParticipant>[] }) {
  const { t, i18n } = useTranslation("session", { keyPrefix: "gm.rolls" });
  const rolls = participants
    .flatMap((participant) =>
      (participant.rolls ?? []).map((roll) => ({ ...roll, who: participant.characterName })),
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, SHOWN);
  const time = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" });

  if (rolls.length === 0) {
    return <p className="text-muted-foreground p-3 text-sm">{t("empty")}</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5 p-3">
      {rolls.map((roll) => (
        <li
          key={`${roll.who}-${roll.at}`}
          className="bg-muted/40 flex items-center gap-3 rounded-lg border px-3 py-2"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold">{roll.who}</span>
              <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                {time.format(roll.at)}
              </span>
            </span>
            <span className="block truncate text-sm">{roll.label}</span>
            <span className="text-muted-foreground block truncate text-xs">{roll.detail}</span>
          </span>
          <span className="shrink-0 text-2xl font-black tabular-nums">{roll.total}</span>
        </li>
      ))}
    </ul>
  );
}
