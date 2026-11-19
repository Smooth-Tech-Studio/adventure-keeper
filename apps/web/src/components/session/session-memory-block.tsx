import { useEffect, useState } from "react";
import { CalendarIcon, GemIcon, StickyNoteIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { AdventureParticipant, LiveSession, QuickNote } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";
import { lootLabel } from "@/lib/recap";

import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { GiveLoot, type GiveLootSources } from "@/components/session/gm-panel/give-loot";
import { Input } from "@/components/ui/input";
import { currentLanguage } from "@/i18n";
import type { WithId } from "@/lib/collections";
import {
  addLoot,
  addQuickNote,
  removeLoot,
  setGameDate,
  subscribeQuickNotes,
} from "@/lib/session-memory";

const time = (at: number) =>
  new Date(at).toLocaleTimeString(currentLanguage(), { hour: "2-digit", minute: "2-digit" });

/**
 * GM panel block: what the session should remember — notes jotted on the fly
 * (they come back when writing the recap), the loot found, the in-game date.
 */
export function SessionMemoryBlock({
  session,
  participants,
  lootSources,
}: {
  session: WithId<LiveSession>;
  /** The characters at the table: the loot is given to one of them. */
  participants: WithId<AdventureParticipant>[];
  /** The planned loot to give, with the fight under way. */
  lootSources: GiveLootSources;
}) {
  const { t } = useTranslation(["session", "common"]);
  const { campaignId, adventureId } = session;
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [note, setNote] = useState("");
  const [lootName, setLootName] = useState("");
  const [lootQty, setLootQty] = useState("");
  const [lootWhere, setLootWhere] = useState("");
  const [date, setDate] = useState(session.gameDate ?? "");
  const [syncedDate, setSyncedDate] = useState(session.gameDate);
  if (session.gameDate !== syncedDate) {
    setSyncedDate(session.gameDate);
    setDate(session.gameDate ?? "");
  }

  useEffect(
    () => subscribeQuickNotes(campaignId, adventureId, session.id, setNotes),
    [campaignId, adventureId, session.id],
  );

  async function guarded(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    }
  }

  return (
    <CollapsibleCard
      id="gm-panel-memory"
      dense
      storageKey="gm-panel-memory"
      title={<span className="text-sm">{t("memory.title")}</span>}
      summary={t("memory.summary", { notes: notes.length, loot: session.loot?.length ?? 0 })}
    >
      <div className="flex flex-col gap-3 text-sm">
        <form
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (date.trim() === (session.gameDate ?? "")) return;
            void guarded(() => setGameDate(campaignId, adventureId, session.id, date));
          }}
        >
          <label
            htmlFor="session-game-date"
            className="text-muted-foreground flex items-center gap-1 text-xs"
          >
            <CalendarIcon className="size-3" /> {t("memory.gameDate")}
          </label>
          <div className="flex gap-1">
            <Input
              id="session-game-date"
              className="h-8"
              maxLength={80}
              placeholder={t("memory.gameDatePlaceholder")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8">
              {t("common:actions.save")}
            </Button>
          </div>
        </form>

        <form
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            const text = note;
            setNote("");
            void guarded(() => addQuickNote(campaignId, adventureId, session.id, text));
          }}
        >
          <label
            htmlFor="session-quick-note"
            className="text-muted-foreground flex items-center gap-1 text-xs"
          >
            <StickyNoteIcon className="size-3" /> {t("memory.quickNote")}
          </label>
          <div className="flex gap-1">
            <Input
              id="session-quick-note"
              className="h-8"
              maxLength={1000}
              placeholder={t("memory.quickNotePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8">
              {t("common:actions.add")}
            </Button>
          </div>
          <Input
            className="h-8"
            maxLength={160}
            aria-label={t("memory.lootWhere")}
            placeholder={t("memory.lootWherePlaceholder")}
            value={lootWhere}
            onChange={(e) => setLootWhere(e.target.value)}
          />
          {notes.length > 0 && (
            <ul className="text-muted-foreground flex max-h-32 flex-col gap-0.5 overflow-y-auto text-xs">
              {notes.map((n) => (
                <li key={n.at}>
                  <span className="tabular-nums">{time(n.at)}</span> — {n.text}
                </li>
              ))}
            </ul>
          )}
        </form>
        <GiveLoot session={session} participants={participants} sources={lootSources} />

        <form
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!lootName.trim()) return;
            const name = lootName;
            const quantity = Number.parseInt(lootQty, 10) || undefined;
            const where = lootWhere;
            setLootName("");
            setLootQty("");
            setLootWhere("");
            void guarded(() =>
              addLoot(campaignId, adventureId, session.id, { name, quantity, where }),
            );
          }}
        >
          <label
            htmlFor="session-loot"
            className="text-muted-foreground flex items-center gap-1 text-xs"
          >
            <GemIcon className="size-3" /> {t("memory.loot")}
          </label>
          <div className="flex gap-1">
            <Input
              id="session-loot"
              className="h-8"
              maxLength={160}
              placeholder={t("memory.lootPlaceholder")}
              value={lootName}
              onChange={(e) => setLootName(e.target.value)}
            />
            <Input
              className="h-8 w-16"
              type="number"
              min={1}
              aria-label={t("memory.quantity")}
              placeholder="×1"
              value={lootQty}
              onChange={(e) => setLootQty(e.target.value)}
            />
            <Button type="submit" size="sm" variant="secondary" className="h-8">
              {t("common:actions.add")}
            </Button>
          </div>
          {(session.loot ?? []).length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {session.loot.map((item) => (
                <li key={item.id} className="flex items-center gap-1 text-xs">
                  <span className="min-w-0 flex-1 truncate">{lootLabel(item)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={t("memory.removeLoot", { name: item.name })}
                    onClick={() =>
                      guarded(() => removeLoot(campaignId, adventureId, session.id, item))
                    }
                  >
                    <XIcon className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </div>
    </CollapsibleCard>
  );
}
