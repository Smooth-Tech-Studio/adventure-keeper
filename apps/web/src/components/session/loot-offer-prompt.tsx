import { useEffect, useState } from "react";
import { GiftIcon } from "lucide-react";
import { toast } from "sonner";
import type { LiveSession, LootOffer, ReadyCharacter, WithId } from "@adventure-keeper/schemas";
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
import { acceptLootOffer, declineLootOffer, subscribeMyLootOffers } from "@/lib/loot-offers";
import { formatPurse, toCopper } from "@/systems/dnd2024/lib/money";

/**
 * What the GM gives this player, one offer at a time: the items and the coins,
 * then « Accepter » (into the bag and the purse) or « Refuser ».
 */
export function LootOfferPrompt({
  session,
  uid,
  character,
}: {
  session: WithId<LiveSession>;
  uid: string;
  character: WithId<ReadyCharacter>;
}) {
  const { t } = useTranslation("session", { keyPrefix: "loot" });
  const [offers, setOffers] = useState<WithId<LootOffer>[]>([]);
  const [busy, setBusy] = useState(false);
  const path = {
    campaignId: session.campaignId,
    adventureId: session.adventureId,
    sessionId: session.id,
  };
  const { campaignId, adventureId, sessionId } = path;

  useEffect(
    () => subscribeMyLootOffers({ campaignId, adventureId, sessionId }, uid, setOffers),
    [campaignId, adventureId, sessionId, uid],
  );

  // The oldest one first: offers are answered in the order they came.
  const offer = offers.filter((entry) => entry.status === "pending").at(-1);
  if (!offer) return null;

  async function answer(accept: boolean) {
    if (!offer) return;
    setBusy(true);
    try {
      if (accept) await acceptLootOffer(path, offer, character);
      else await declineLootOffer(path, offer.id);
    } catch (error) {
      console.error(error);
      toast.error(t("answerFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GiftIcon className="size-5" /> {t("offerTitle")}
          </DialogTitle>
          {offer.where && (
            <DialogDescription>{t("foundWhere", { where: offer.where })}</DialogDescription>
          )}
        </DialogHeader>
        <ul className="bg-muted/50 grid gap-1 rounded-lg px-3 py-2 text-sm">
          {offer.items.map(({ item }) => (
            <li key={item.id}>
              {item.name}
              {item.quantity > 1 ? ` ×${item.quantity}` : ""}
            </li>
          ))}
          {toCopper(offer.money) > 0 && (
            <li className="font-semibold tabular-nums">{formatPurse(offer.money)}</li>
          )}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => answer(false)}>
            {t("decline")}
          </Button>
          <Button type="button" disabled={busy} onClick={() => answer(true)}>
            {t("accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
