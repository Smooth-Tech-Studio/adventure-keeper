import { useEffect, useState } from "react";
import { CopyIcon, LinkIcon, MailIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import {
  memberCharacterIds,
  type Campaign,
  type CampaignInvite,
  type CampaignMember,
  type CampaignPack,
  type ReadyCharacter,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignCard } from "@/components/campaign/campaign-card";
import { MemberRow } from "@/components/campaign/member-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { WithId } from "@/lib/collections";
import { getCompanionSheet } from "@/lib/characters";
import {
  createInviteLink,
  deleteInvite,
  inviteByEmail,
  inviteUrl,
  revokeInvite,
  subscribeCampaignInvites,
  type InviteSender,
} from "@/lib/invites";
import { currentLanguage } from "@/i18n";

interface MembersCardProps {
  campaign: WithId<Campaign>;
  members: WithId<CampaignMember>[];
  /** The signed-in user. */
  me: InviteSender;
  isGm: boolean;
  /** Packs the GM allowed — a member whose sheet uses another one is flagged. */
  campaignPacks: readonly CampaignPack[];
}

/**
 * The party: each player with their character — portrait, name opening the
 * sheet, species, class and level, who plays it. A player sees their
 * companions (their own character has its card); the GM sees everyone, follows
 * the invitations, and invites from the « Inviter » button.
 */
export function MembersCard({
  campaign,
  members,
  me,
  isGm,
  campaignPacks,
  titled = true,
}: MembersCardProps & {
  /** Off in a phone's tab, which names it already. */
  titled?: boolean;
}) {
  const { t } = useTranslation(["campaigns", "common"]);
  const [invites, setInvites] = useState<WithId<CampaignInvite>[]>([]);
  const [sheets, setSheets] = useState<Record<string, WithId<ReadyCharacter>>>({});
  const [inviting, setInviting] = useState(false);
  useEffect(() => {
    if (!isGm) return;
    return subscribeCampaignInvites(campaign.id, me.uid, setInvites);
  }, [campaign.id, isGm, me.uid]);

  // Every character players brought — sheets are readable by anyone signed in.
  const pickedKey = members.flatMap((m) => memberCharacterIds(m)).join(",");
  useEffect(() => {
    if (!pickedKey) return;
    let cancelled = false;
    Promise.all(pickedKey.split(",").map((id) => getCompanionSheet(id))).then((found) => {
      if (!cancelled) setSheets(Object.fromEntries(found.flatMap((c) => (c ? [[c.id, c]] : []))));
    });
    return () => {
      cancelled = true;
    };
  }, [pickedKey]);

  // Current names and avatars: the member doc keeps the name of the day they joined.
  const profiles = useUserProfiles(members.map((member) => member.uid));
  const nameOfMember = (member: CampaignMember) => nameOf(profiles, member.uid, member.displayName);

  const allowed = new Set(campaignPacks.map((pack) => pack.packId));
  const players = members
    .filter((member) => member.role !== "gm" && (isGm || member.uid !== me.uid))
    .sort((a, b) => nameOfMember(a).localeCompare(nameOfMember(b), currentLanguage()));
  const emailInvites = invites.filter(
    (i) => i.kind === "email" && (i.status === "pending" || i.status === "declined"),
  );
  const link = (id: string) => ({
    characterId: id,
    campaignId: campaign.id,
    from: [
      { label: t("common:nav.campaigns"), to: "/campaigns" },
      { label: campaign.name, to: `/campaigns/${campaign.id}` },
    ],
  });

  return (
    <CampaignCard
      title={titled ? (isGm ? t("members.titleGm") : t("members.titlePlayer")) : undefined}
      icon={UsersIcon}
      action={
        isGm && (
          <Button type="button" size="sm" variant="outline" onClick={() => setInviting(true)}>
            <UserPlusIcon /> {t("members.invite")}
          </Button>
        )
      }
    >
      {!titled && isGm && (
        <div className="mb-2 flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={() => setInviting(true)}>
            <UserPlusIcon /> {t("members.invite")}
          </Button>
        </div>
      )}
      {players.length === 0 && emailInvites.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {isGm ? t("members.noPlayersGm") : t("members.noCompanions")}
        </p>
      )}
      <ul className="divide-y">
        {players.map((member) => (
          <MemberRow
            key={member.uid}
            member={member}
            player={nameOfMember(member)}
            profile={profiles[member.uid]}
            sheets={sheets}
            isGm={isGm}
            allowedPacks={allowed}
            sheetLink={link}
          />
        ))}
        {emailInvites.map((invite) => (
          <li
            key={invite.id}
            className="text-muted-foreground flex items-center gap-2 py-2.5 text-sm"
          >
            <MailIcon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{invite.invitedName}</span>
            <Badge variant="outline">
              {invite.status === "pending" ? t("members.inviteSent") : t("members.declined")}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                (invite.status === "pending" ? revokeInvite : deleteInvite)(invite.id).catch(
                  (error) => {
                    console.error(error);
                    toast.error(t("members.actionFailed"));
                  },
                )
              }
            >
              {invite.status === "pending" ? t("common:actions.cancel") : t("members.remove")}
            </Button>
          </li>
        ))}
      </ul>
      {isGm && (
        <Dialog open={inviting} onOpenChange={setInviting}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("members.inviteTitle")}</DialogTitle>
              <DialogDescription>{t("members.introGm")}</DialogDescription>
            </DialogHeader>
            <InvitePlayers campaign={campaign} me={me} />
          </DialogContent>
        </Dialog>
      )}
    </CampaignCard>
  );
}

/**
 * Invite players, outside the members card: by email, or with a link — the
 * last screen of the campaign creation. Emails sent show up below the form.
 */
export function InvitePlayers({ campaign, me }: { campaign: WithId<Campaign>; me: InviteSender }) {
  const { t } = useTranslation("campaigns");
  const [invites, setInvites] = useState<WithId<CampaignInvite>[]>([]);
  useEffect(() => subscribeCampaignInvites(campaign.id, me.uid, setInvites), [campaign.id, me.uid]);
  const sent = invites.filter((i) => i.kind === "email" && i.status === "pending");
  const activeLink = invites.find((i) => i.kind === "link" && i.status === "pending");
  return (
    <div className="flex flex-col gap-5">
      <EmailInviteForm campaign={campaign} me={me} />
      {sent.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sent.map((invite) => (
            <li key={invite.id} className="flex items-center gap-2 text-sm">
              <MailIcon className="text-muted-foreground size-4" />
              <span className="min-w-0 flex-1 truncate">{invite.invitedName}</span>
              <Badge variant="outline">{t("members.inviteSent")}</Badge>
            </li>
          ))}
        </ul>
      )}
      <Separator />
      <InviteLinkPanel campaign={campaign} me={me} link={activeLink} />
    </div>
  );
}

function EmailInviteForm({ campaign, me }: { campaign: WithId<Campaign>; me: InviteSender }) {
  const { t } = useTranslation("campaigns", { keyPrefix: "members" });
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const result = await inviteByEmail(campaign, me, email);
      if (result.ok) {
        toast.success(t("sentTo", { name: result.displayName }));
        setEmail("");
      } else {
        toast.error(result.reason);
      }
    } catch (error) {
      console.error(error);
      toast.error(t("sendFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className="grid gap-2">
      <Label htmlFor="invite-email">{t("byEmail")}</Label>
      <p className="text-muted-foreground text-xs">{t("byEmailHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          id="invite-email"
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-0 flex-1 sm:max-w-80"
        />
        <Button type="submit" disabled={sending}>
          <MailIcon /> {t("invite")}
        </Button>
      </div>
    </form>
  );
}

function InviteLinkPanel({
  campaign,
  me,
  link,
}: {
  campaign: WithId<Campaign>;
  me: InviteSender;
  link?: WithId<CampaignInvite>;
}) {
  const { t } = useTranslation(["campaigns", "common"]);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error(error);
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("members.linkCopied"));
    } catch {
      toast.error(t("members.copyFailed"));
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="invite-link">{t("members.link")}</Label>
      <p className="text-muted-foreground text-xs">{t("members.linkHint")}</p>
      {link ? (
        <div className="flex flex-wrap gap-2">
          <Input
            id="invite-link"
            readOnly
            value={inviteUrl(link.id)}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 font-mono text-xs sm:max-w-80"
          />
          <Button type="button" variant="outline" onClick={() => copy(inviteUrl(link.id))}>
            <CopyIcon /> {t("common:actions.copy")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => revokeInvite(link.id), t("members.disableFailed"))}
          >
            {t("members.disable")}
          </Button>
        </div>
      ) : (
        <Button
          id="invite-link"
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={busy}
          onClick={() => run(() => createInviteLink(campaign, me), t("members.createLinkFailed"))}
        >
          <LinkIcon /> {t("members.createLink")}
        </Button>
      )}
    </div>
  );
}
