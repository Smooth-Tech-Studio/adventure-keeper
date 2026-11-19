import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { CampaignInvite, Character } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { CharacterPicker } from "@/components/campaign/character-picker";
import { getCampaign, listMyCharacters, type WithId } from "@/lib/collections";
import { declineInvite, getInvite, joinCampaign } from "@/lib/invites";
import { getSystem } from "@/systems";
import { useAuth } from "@/hooks/use-auth";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { nameOf, useUserProfiles } from "@/hooks/use-user-profiles";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "member"; campaignId: string }
  | { kind: "ready"; invite: WithId<CampaignInvite>; characters: WithId<Character>[] };

/** A non-member cannot read the campaign, so a successful read means "already in". */
async function alreadyMember(campaignId: string, uid: string): Promise<boolean> {
  try {
    const campaign = await getCampaign(campaignId);
    return Boolean(campaign?.memberIds.includes(uid));
  } catch {
    return false;
  }
}

/**
 * `/join/:inviteId` — where an invite link lands and where "Accepter" in the
 * notifications leads: who invites you to what, pick (or create) a character,
 * join. Joining without a character is not possible.
 */
export function JoinCampaignPage() {
  const { t } = useTranslation(["campaigns", "common"]);
  const { inviteId } = useParams<{ inviteId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  useBreadcrumbs([
    { label: t("common:nav.campaigns"), to: "/campaigns" },
    { label: t("join.crumb") },
  ]);
  const [characterId, setCharacterId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const gms = useUserProfiles([state.kind === "ready" ? state.invite.gmUid : undefined]);

  useEffect(() => {
    if (!inviteId || !user) return;
    let cancelled = false;
    (async () => {
      const invite = await getInvite(inviteId).catch(() => null);
      if (!invite) return { kind: "missing" } as const;
      if (await alreadyMember(invite.campaignId, user.uid)) {
        return { kind: "member", campaignId: invite.campaignId } as const;
      }
      const characters = await listMyCharacters(user.uid);
      return { kind: "ready", invite, characters } as const;
    })()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [inviteId, user]);

  if (!user || state.kind === "loading") {
    return (
      <PageContainer size="narrow">
        <DetailSkeleton />
      </PageContainer>
    );
  }

  if (state.kind === "missing") {
    return <JoinMessage title={t("join.missingTitle")}>{t("join.missing")}</JoinMessage>;
  }

  if (state.kind === "member") {
    return (
      <JoinMessage title={t("join.memberTitle")}>
        <Button asChild className="mt-2 self-start">
          <Link to={`/campaigns/${state.campaignId}`}>{t("join.open")}</Link>
        </Button>
      </JoinMessage>
    );
  }

  const { invite, characters } = state;

  if (invite.status !== "pending") {
    return (
      <JoinMessage title={t("join.expiredTitle")}>
        {invite.status === "declined" ? t("join.declinedByYou") : t("join.cancelled")}
      </JoinMessage>
    );
  }

  const gmName = nameOf(gms, invite.gmUid, invite.gmName);

  async function join() {
    if (!user || !characterId) return;
    setBusy(true);
    try {
      await joinCampaign(invite, user, characterId);
      toast.success(t("join.welcome", { campaign: invite.campaignName }));
      navigate(`/campaigns/${invite.campaignId}`, { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(t("join.joinFailed"));
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await declineInvite(invite.id);
      toast.success(t("join.declined"));
      navigate("/campaigns", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(t("join.declineFailed"));
      setBusy(false);
    }
  }

  return (
    <PageContainer size="narrow" className="flex  flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>{t("join.invites", { gm: gmName })}</CardDescription>
          <CardTitle className="text-2xl">{invite.campaignName}</CardTitle>
          <CardDescription>
            {t("join.sheets", {
              system: getSystem(invite.characterSystem).label,
              gm: gmName,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">{t("join.pickTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("join.pickHint")}</p>
          </div>
          <CharacterPicker
            characters={characters}
            characterSystem={invite.characterSystem}
            selectedId={characterId}
            onSelect={setCharacterId}
            returnTo={`/join/${invite.id}`}
            disabled={busy}
          />
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {invite.kind === "email" && (
            <Button type="button" variant="ghost" onClick={decline} disabled={busy}>
              {t("join.decline")}
            </Button>
          )}
          <Button type="button" onClick={join} disabled={busy || !characterId}>
            {t("join.submit")}
          </Button>
        </CardFooter>
      </Card>
    </PageContainer>
  );
}

function JoinMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PageContainer size="narrow">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col text-sm">
          {children}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
