import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  isCharacterDraft,
  isDnd2024Character,
  type Dnd2024Character,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { LevelUpWizard } from "@/systems/dnd2024/level-up";
import { getCharacter, type WithId } from "@/lib/collections";
import { useAuth } from "@/hooks/use-auth";
import { translateKey } from "@/i18n";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useFullWidthPage } from "@/hooks/use-full-width-page";
import { useLicenceNotice } from "@/hooks/use-licence-notice";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; character: WithId<Dnd2024Character> };

/** `/characters/:id/level-up` — the guided level-up of a finished 5e 2024 sheet. */
export function LevelUpCharacterPage() {
  const { t } = useTranslation(["characters", "common"]);
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  // Only an in-app path: never send the player to another site.
  const requested = params.get("returnTo");
  const returnTo =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : undefined;

  const name = load.status === "ready" ? load.character.name.trim() : undefined;
  useBreadcrumbs([
    { label: t("common:nav.characters"), to: "/characters" },
    { label: name || t("crumbs.character"), to: `/characters/${id}` },
    { label: t("crumbs.levelUp") },
  ]);
  useLicenceNotice("srd521");
  useFullWidthPage(load.status === "ready");

  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    getCharacter(id)
      .then((character) => {
        if (!active) return;
        if (!character) setLoad({ status: "error", message: "characters:load.notFound" });
        else if (character.ownerId !== user.uid)
          setLoad({ status: "error", message: "characters:load.notYours" });
        else if (isCharacterDraft(character) || !isDnd2024Character(character))
          setLoad({
            status: "error",
            message: "characters:load.levelUpOnlyDnd",
          });
        else if ((character.level ?? 1) >= 20)
          setLoad({ status: "error", message: "characters:load.maxLevel" });
        else setLoad({ status: "ready", character });
      })
      .catch((error) => {
        console.error(error);
        if (active) setLoad({ status: "error", message: "characters:load.failed" });
      });
    return () => {
      active = false;
    };
  }, [id, user]);

  if (load.status === "ready") {
    return (
      <PageContainer size="wide" className="p-0">
        <LevelUpWizard character={load.character} returnTo={returnTo} />
      </PageContainer>
    );
  }
  return (
    <PageContainer className="flex flex-col items-start gap-4">
      {load.status === "loading" && <DetailSkeleton />}
      {load.status === "error" && (
        <>
          <p className="text-destructive text-sm">{translateKey(load.message)}</p>
          <Button asChild variant="outline">
            <Link to={`/characters/${id}`}>{t("load.backToSheet")}</Link>
          </Button>
        </>
      )}
    </PageContainer>
  );
}
