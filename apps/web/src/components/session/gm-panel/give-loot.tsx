import { useEffect, useRef, useState } from "react";
import { GiftIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ZERO_MONEY,
  type AdventureEnemy,
  type AdventureLocation,
  type AdventureParticipant,
  type Item,
  type LiveSession,
  type LootOffer,
  type LootOfferSection,
  type Money,
  type SessionCombatant,
  type WithId,
} from "@adventure-keeper/schemas";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddEquipmentDialog } from "@/systems/dnd2024/session/player-sheet/add-equipment-dialog";
import { CoinFields } from "@/systems/dnd2024/session/player-sheet/purse-sum-dialog";
import {
  createLootOffer,
  deleteLootOffer,
  logAcceptedLootOffer,
  lootOfferLabel,
  subscribeSessionLootOffers,
} from "@/lib/loot-offers";
import { useCodex } from "@/hooks/use-codex";
import { addCoins, formatPurse, toCopper } from "@/systems/dnd2024/lib/money";
import { plannedLootSources, plannedLootToGift } from "@/lib/planned-loot";
import { lootLabel } from "@/lib/recap";

const pathOf = (session: WithId<LiveSession>) => ({
  campaignId: session.campaignId,
  adventureId: session.adventureId,
  sessionId: session.id,
});

/**
 * The offers of the session, kept in step for the GM: an accepted one is
 * written in the session's loot once, and each answer is told in a toast.
 */
function useSessionLootOffers(session: WithId<LiveSession>) {
  const { t } = useTranslation("session", { keyPrefix: "loot" });
  const [offers, setOffers] = useState<WithId<LootOffer>[]>([]);
  const answered = useRef(new Map<string, LootOffer["status"]>());
  const path = pathOf(session);
  const { campaignId, adventureId, sessionId } = path;

  useEffect(
    () => subscribeSessionLootOffers({ campaignId, adventureId, sessionId }, setOffers),
    [campaignId, adventureId, sessionId],
  );

  useEffect(() => {
    for (const offer of offers) {
      const before = answered.current.get(offer.id);
      answered.current.set(offer.id, offer.status);
      if (before === "pending" && offer.status !== "pending") {
        toast.info(
          t(offer.status === "accepted" ? "acceptedToast" : "declinedToast", {
            name: offer.characterName,
          }),
        );
      }
      if (offer.status === "accepted" && !offer.logged) {
        logAcceptedLootOffer({ campaignId, adventureId, sessionId }, offer).catch((error) =>
          console.error(error),
        );
      }
    }
  }, [offers, campaignId, adventureId, sessionId, t]);

  return offers;
}

/** What the GM can give from: the adventure's planned loot and the fight under way. */
export interface GiveLootSources {
  enemies: WithId<AdventureEnemy>[];
  locations: WithId<AdventureLocation>[];
  combatants: WithId<SessionCombatant>[];
}

/** « Donner du butin » and the offers made, with their answers. */
export function GiveLoot({
  session,
  participants,
  sources,
}: {
  session: WithId<LiveSession>;
  participants: WithId<AdventureParticipant>[];
  sources: GiveLootSources;
}) {
  const { t } = useTranslation("session", { keyPrefix: "loot" });
  const offers = useSessionLootOffers(session);
  const [open, setOpen] = useState(false);
  const path = pathOf(session);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 self-start"
        disabled={participants.length === 0}
        onClick={() => setOpen(true)}
      >
        <GiftIcon className="size-3.5" /> {t("give")}
      </Button>
      {offers.length > 0 && (
        <ul aria-label={t("offers")} className="flex flex-col gap-0.5">
          {offers.map((offer) => (
            <li key={offer.id} className="flex items-center gap-1 text-xs">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{offer.characterName}</span> · {lootOfferLabel(offer)}
              </span>
              <span
                className={
                  offer.status === "accepted"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : offer.status === "declined"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }
              >
                {t(`status.${offer.status}`)}
              </span>
              {offer.status !== "accepted" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={t("withdraw", { name: offer.characterName })}
                  onClick={() =>
                    deleteLootOffer(path, offer.id).catch((error) => console.error(error))
                  }
                >
                  <XIcon className="size-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <GiveLootDialog
        open={open}
        onOpenChange={setOpen}
        session={session}
        participants={participants}
        sources={sources}
      />
    </div>
  );
}

/** An item of the gift; `codexEntryId` when it comes from the codex. */
interface GiftItem {
  section: LootOfferSection;
  item: Item;
  codexEntryId?: string;
}

/**
 * To whom, what (items from the catalogue, the codex or a free line, a line of
 * the session's loot, the loot planned on an enemy or the place) and how much
 * (coins), found where.
 */
function GiveLootDialog({
  open,
  onOpenChange,
  session,
  participants,
  sources,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: WithId<LiveSession>;
  participants: WithId<AdventureParticipant>[];
  sources: GiveLootSources;
}) {
  const { t } = useTranslation("session", { keyPrefix: "loot" });
  const [to, setTo] = useState("");
  const [items, setItems] = useState<GiftItem[]>([]);
  // Planned loot already put in the gift: one tap each.
  const [taken, setTaken] = useState<string[]>([]);
  const [money, setMoney] = useState<Money>(ZERO_MONEY);
  const [where, setWhere] = useState("");
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const recipient = participants.find((participant) => participant.characterId === to);
  // The session's loot not given yet: one tap puts a line in the gift.
  const found = (session.loot ?? []).filter((line) => !line.recipient);
  const planned = plannedLootSources({
    enemies: sources.enemies,
    locations: sources.locations,
    combatants: sources.combatants,
    currentLocationId: session.currentLocationId,
  }).filter((source) => !taken.includes(source.key));
  const codexObjects = useCodex(session.campaignId, true).filter(
    (entry) => entry.kind === "item" && !items.some((line) => line.codexEntryId === entry.id),
  );
  const empty = items.length === 0 && toCopper(money) === 0;

  function reset() {
    setTo("");
    setItems([]);
    setTaken([]);
    setMoney(ZERO_MONEY);
    setWhere("");
  }

  async function send() {
    if (!recipient || empty) return;
    setSending(true);
    try {
      await createLootOffer(pathOf(session), {
        toUid: recipient.playerId,
        characterId: recipient.characterId,
        characterName: recipient.characterName,
        items: items.map(({ section, item }) => ({ section, item })),
        codexEntryIds: items.flatMap((line) => (line.codexEntryId ? [line.codexEntryId] : [])),
        money,
        where,
      });
      toast.success(t("sent", { name: recipient.characterName }));
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(t("sendFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) reset();
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("giveTitle")}</DialogTitle>
            <DialogDescription>{t("giveHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="give-loot-to">{t("to")}</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger id="give-loot-to" className="w-full">
                  <SelectValue placeholder={t("toPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((participant) => (
                    <SelectItem key={participant.characterId} value={participant.characterId}>
                      {participant.characterName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{t("items")}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
                  <PlusIcon className="size-3.5" /> {t("addItem")}
                </Button>
              </div>
              {items.length > 0 && (
                <ul className="bg-muted/50 grid gap-0.5 rounded-lg px-2.5 py-1.5 text-sm">
                  {items.map(({ item }, index) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {item.name}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={t("removeItem", { name: item.name })}
                        onClick={() => setItems(items.filter((_, at) => at !== index))}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {codexObjects.length > 0 && (
                <Select
                  value=""
                  onValueChange={(entryId) => {
                    const entry = codexObjects.find((candidate) => candidate.id === entryId);
                    if (!entry) return;
                    setItems((current) => [
                      ...current,
                      {
                        section: "inventory",
                        codexEntryId: entry.id,
                        item: {
                          id: crypto.randomUUID(),
                          name: entry.name,
                          ...(entry.summary.trim() ? { lore: entry.summary.slice(0, 2000) } : {}),
                          quantity: 1,
                          consumable: false,
                        },
                      },
                    ]);
                  }}
                >
                  <SelectTrigger aria-label={t("fromCodex")} className="w-full">
                    <SelectValue placeholder={t("fromCodex")} />
                  </SelectTrigger>
                  <SelectContent>
                    {codexObjects.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                        {entry.revealed ? "" : ` (${t("codexHidden")})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {planned.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">{t("planned")}</span>
                  {planned.map((source) => (
                    <Button
                      key={source.key}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        const gift = plannedLootToGift(source.loot);
                        setItems((current) => [...current, ...gift.items]);
                        setMoney((current) => addCoins(current, gift.money));
                        setTaken((current) => [...current, source.key]);
                        if (!where) setWhere(source.name);
                      }}
                    >
                      {source.name}
                      {" · "}
                      {[
                        ...source.loot.items.map(({ name, quantity }) =>
                          quantity > 1 ? `${name} ×${quantity}` : name,
                        ),
                        ...(toCopper(source.loot.money) > 0
                          ? [formatPurse(source.loot.money)]
                          : []),
                      ].join(", ")}
                    </Button>
                  ))}
                </div>
              )}
              {found.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">{t("fromLoot")}</span>
                  {found.map((line) => (
                    <Button
                      key={line.id}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setItems([
                          ...items,
                          {
                            section: "inventory",
                            item: {
                              id: crypto.randomUUID(),
                              name: line.name,
                              quantity: line.quantity ?? 1,
                              consumable: (line.quantity ?? 1) > 1,
                            },
                          },
                        ]);
                        if (line.where && !where) setWhere(line.where);
                      }}
                    >
                      {lootLabel(line)}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <span className="text-sm font-medium">{t("coins")}</span>
              <CoinFields idPrefix="give-loot" value={money} onChange={setMoney} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="give-loot-where">{t("where")}</Label>
              <Input
                id="give-loot-where"
                placeholder={t("wherePlaceholder")}
                value={where}
                onChange={(event) => setWhere(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={!recipient || empty || sending} onClick={send}>
              <GiftIcon /> {t("send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddEquipmentDialog
        open={adding}
        onOpenChange={setAdding}
        onAdd={(section, item) => {
          if (section === "money") return;
          setItems((current) => [...current, { section: section as LootOfferSection, item }]);
        }}
      />
    </>
  );
}
