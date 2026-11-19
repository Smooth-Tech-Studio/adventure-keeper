import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BellIcon, BookOpenIcon, MailIcon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import type { Campaign, CampaignInvite } from "@adventure-keeper/schemas";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listCampaignsMissingMyCharacter, type WithId } from "@/lib/collections";
import { listUnreadRecaps, type UnreadRecap } from "@/lib/campaigns";
import { declineInvite, subscribeMyPendingInvites } from "@/lib/invites";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";

/**
 * The navbar bell. Three kinds of entries, all derived from existing data:
 * campaign invites waiting for an answer (live), campaigns where the player
 * still has to pick a character, and recaps published since they last read
 * the adventure (both refetched on each navigation).
 */
export function NotificationsBell({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<WithId<CampaignInvite>[]>([]);
  const [missing, setMissing] = useState<WithId<Campaign>[]>([]);
  const [recaps, setRecaps] = useState<UnreadRecap[]>([]);
  const gms = useUserProfiles(invites.map((invite) => invite.gmUid));

  useEffect(() => subscribeMyPendingInvites(uid, setInvites), [uid]);

  const refreshMissing = useCallback(() => {
    listCampaignsMissingMyCharacter(uid)
      .then(setMissing)
      .catch((error) => console.error(error));
    // Opening the adventure marks its recap read: the next navigation drops it.
    listUnreadRecaps(uid)
      .then(setRecaps)
      .catch((error) => console.error(error));
  }, [uid]);

  useEffect(refreshMissing, [refreshMissing, location.pathname]);

  const count = invites.length + missing.length + recaps.length;

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  async function decline(invite: WithId<CampaignInvite>) {
    try {
      await declineInvite(invite.id);
      toast.success(t("notifications.declined", { campaign: invite.campaignName }));
    } catch (error) {
      console.error(error);
      toast.error(t("notifications.declineFailed"));
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            count > 0 ? t("notifications.titleWithCount", { count }) : t("notifications.title")
          }
        >
          <BellIcon />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-3 py-2 text-sm font-medium">{t("notifications.title")}</p>
        {count === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            {t("notifications.empty")}
          </p>
        ) : (
          <ul className="flex max-h-96 flex-col divide-y overflow-y-auto">
            {invites.map((invite) => (
              <li key={invite.id} className="flex gap-3 px-3 py-3 text-sm">
                <MailIcon className="text-primary mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p>
                    <Trans
                      i18nKey="notifications.invite"
                      values={{
                        gm: nameOf(gms, invite.gmUid, invite.gmName),
                        campaign: invite.campaignName,
                      }}
                      components={{ strong: <span className="font-medium" /> }}
                    />
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => go(`/join/${invite.id}`)}>
                      {t("notifications.accept")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decline(invite)}>
                      {t("notifications.decline")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            {missing.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  to={`/campaigns/${campaign.id}#my-character`}
                  onClick={() => setOpen(false)}
                  className="hover:bg-muted/60 flex gap-3 px-3 py-3 text-sm transition-colors"
                >
                  <UserRoundIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span>
                    <Trans
                      i18nKey="notifications.pickCharacter"
                      values={{ campaign: campaign.name }}
                      components={{ strong: <span className="font-medium" /> }}
                    />
                  </span>
                </Link>
              </li>
            ))}
            {recaps.map((recap) => (
              <li key={recap.adventureId}>
                <Link
                  to={`/campaigns/${recap.campaignId}/adventures/${recap.adventureId}`}
                  onClick={() => setOpen(false)}
                  className="hover:bg-muted/60 flex gap-3 px-3 py-3 text-sm transition-colors"
                >
                  <BookOpenIcon className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>
                    <Trans
                      i18nKey="notifications.newRecap"
                      values={{ adventure: recap.adventureTitle, campaign: recap.campaignName }}
                      components={{ strong: <span className="font-medium" /> }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
