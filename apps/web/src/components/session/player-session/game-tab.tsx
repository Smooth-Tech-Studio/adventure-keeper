import { useState, type ReactNode } from "react";
import {
  FileTextIcon,
  Maximize2Icon,
  PencilIcon,
  PlusIcon,
  ScrollTextIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { SessionCombat, SessionCombatant, ShownDocument } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { HandoutView } from "@/components/session/handout-dialog";
import { QuestOwnerBadges } from "@/components/quests/quests-card";
import { useQuestEditor, type QuestReader } from "@/hooks/use-quest-editor";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlayerTurn } from "@/lib/combat-turn";
import type { WithId } from "@/lib/collections";
import { combatantColor } from "@/lib/combatant-color";

/** The initiative order as a row of dots, the active one ringed. */
export function OrderDots({
  combat,
  combatantsById,
}: {
  combat: SessionCombat;
  combatantsById: Record<string, WithId<SessionCombatant>>;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
      {combat.order.map((id, index) => {
        const combatant = combatantsById[id];
        if (!combatant) return null;
        return (
          <span
            key={id}
            title={combatant.name}
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full border-2 border-transparent text-[9px] font-bold text-white",
              index === combat.turnIndex && "border-amber-300 ring-2 ring-amber-300/30",
              combatant.currentHitPoints <= 0 && "opacity-30 grayscale",
            )}
            style={{
              backgroundColor: combatantColor(combatant),
            }}
          >
            {initials(combatant.name)}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The fight, for the player: the round, whose turn it is — « À toi ! » in gold
 * when it is theirs — and the order of the round.
 */
export function TurnBanner({
  turn,
  combatantsById,
  characterName,
}: {
  turn: PlayerTurn;
  combatantsById: Record<string, WithId<SessionCombatant>>;
  characterName: string;
}) {
  const { t } = useTranslation("session", { keyPrefix: "player.turn" });
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-3 py-2",
        turn.mine
          ? "border-amber-400/50 bg-gradient-to-r from-amber-400/20 to-amber-400/5"
          : "bg-card",
      )}
    >
      <div
        className={cn(
          "text-sm font-semibold",
          turn.mine ? "text-amber-200" : "text-muted-foreground",
        )}
      >
        {t("round", { round: turn.combat.round })} ·{" "}
        {turn.mine ? (
          <span>{t("yours", { name: characterName })}</span>
        ) : (
          <span>
            {t("theirs")} <span className="text-foreground">{turn.active?.name}</span>
          </span>
        )}
      </div>
      <OrderDots combat={turn.combat} combatantsById={combatantsById} />
    </div>
  );
}

/** Ends the player's turn; shown only while it is theirs. */
export function EndTurnButton({ onEndTurn }: { onEndTurn: () => void }) {
  const { t } = useTranslation("session", { keyPrefix: "player.turn" });
  return (
    <Button
      type="button"
      onClick={onEndTurn}
      className="w-full bg-amber-400 font-semibold text-amber-950 hover:bg-amber-300"
    >
      {t("end")}
    </Button>
  );
}

/** The map in the Jeu tab, with a button to see it on the whole screen. */
export function MapCard({ map, fullMap }: { map: ReactNode; fullMap: ReactNode }) {
  const { t } = useTranslation("session", { keyPrefix: "player" });
  const [full, setFull] = useState(false);
  return (
    <div className="relative">
      <div className="[&_#session-stage]:aspect-[4/3]">{map}</div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute right-3 bottom-3 z-10 shadow"
        onClick={() => setFull(true)}
      >
        <Maximize2Icon /> {t("fullMap")}
      </Button>
      {full && (
        <div
          role="dialog"
          aria-label={t("map")}
          className="bg-background fixed inset-0 z-50 flex flex-col"
        >
          <div className="min-h-0 flex-1 [&_#session-stage]:h-full [&_#session-stage]:rounded-none [&_#session-stage]:aspect-auto">
            {fullMap}
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label={t("closeMap")}
            className="absolute top-3 right-3 z-10 rounded-full shadow"
            onClick={() => setFull(false)}
          >
            <XIcon />
          </Button>
        </div>
      )}
    </div>
  );
}

/** The handout the GM is showing: a card that opens it again. */
export function ShownDocumentCard({ shown }: { shown: ShownDocument | undefined }) {
  const { t } = useTranslation("session", { keyPrefix: "player" });
  const [open, setOpen] = useState(false);
  if (!shown) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-2.5 text-left"
      >
        {shown.imageUrl ? (
          <img src={shown.imageUrl} alt="" className="h-14 w-11 shrink-0 rounded object-cover" />
        ) : (
          <span className="grid h-14 w-11 shrink-0 place-items-center rounded bg-amber-500/20">
            <FileTextIcon className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-300">
            {t("shownByGm")}
          </span>
          <span className="block truncate font-semibold">{shown.name}</span>
        </span>
        <span className="text-muted-foreground text-xs">{t("open")}</span>
      </button>
      <HandoutView shown={shown} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * The quests the party knows of, and the player's own: they write theirs here
 * (personal, or shared with the party) and keep them up to date.
 */
export function QuestList({ campaignId, reader }: { campaignId: string; reader: QuestReader }) {
  const { t } = useTranslation(["session", "quests", "common"]);
  const editor = useQuestEditor(campaignId, reader);
  const quests = editor.quests;
  return (
    <section className="flex flex-col gap-2" id="session-quests">
      <div className="flex items-center gap-2">
        <h3 className="text-muted-foreground flex flex-1 items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <ScrollTextIcon className="size-3.5" /> {t("session:player.quests")}
        </h3>
        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={editor.create}>
          <PlusIcon /> {t("quests:new")}
        </Button>
      </div>
      {quests.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("session:player.noQuest")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {quests.map((quest) => (
            <li key={quest.id} className="flex items-start gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1 text-sm font-medium">
                  <span className="mr-1">{quest.title}</span>
                  <QuestOwnerBadges quest={quest} reader={reader} />
                </div>
                {quest.summary && (
                  <Markdown className="text-muted-foreground line-clamp-2 text-xs">
                    {quest.summary}
                  </Markdown>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  quest.status === "active" &&
                    "border-emerald-500/50 text-emerald-600 dark:text-emerald-300",
                )}
              >
                {t(`quests:statuses.${quest.status}`)}
              </span>
              {editor.canEdit(quest) && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-my-1 size-7"
                    aria-label={t("quests:editWhat", { title: quest.title })}
                    onClick={() => editor.edit(quest)}
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive -my-1 size-7"
                    aria-label={t("quests:deleteWhat", { title: quest.title })}
                    onClick={() => editor.remove(quest)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {editor.dialogs}
    </section>
  );
}
