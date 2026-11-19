import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { isCharacterDraft, type Character } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/page-container";
import { useFullWidthPage } from "@/hooks/use-full-width-page";
import { DetailSkeleton } from "@/components/ui/page-loading";
import { getCharacter, type WithId } from "@/lib/collections";
import { useAuth } from "@/hooks/use-auth";
import { translateKey } from "@/i18n";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { useLicenceNotice } from "@/hooks/use-licence-notice";
import { systemOf } from "@/systems";
import { screensOf } from "@/systems/screens";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; character: WithId<Character> };

export function EditCharacterPage() {
  const { t } = useTranslation(["characters", "common"]);
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const name = load.status === "ready" ? load.character.name.trim() : undefined;
  useBreadcrumbs([
    { label: t("common:nav.characters"), to: "/characters" },
    ...(load.status === "error"
      ? []
      : [
          {
            label: load.status === "ready" ? name || t("crumbs.untitled") : undefined,
            to: `/characters/${id}`,
          },
        ]),
    { label: t("crumbs.edit") },
  ]);
  useLicenceNotice(load.status === "ready" ? systemOf(load.character).licenceNotice : null);

  useEffect(() => {
    if (!id || !user) return;
    let active = true;
    setLoad({ status: "loading" });
    getCharacter(id)
      .then((character) => {
        if (!active) return;
        if (!character) {
          setLoad({ status: "error", message: "characters:load.notFound" });
        } else if (character.ownerId !== user.uid) {
          setLoad({ status: "error", message: "characters:load.notYours" });
        } else {
          setLoad({ status: "ready", character });
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) setLoad({ status: "error", message: "characters:load.failed" });
      });
    return () => {
      active = false;
    };
  }, [id, user]);

  // A draft reopens in the guided creation, which uses the whole window.
  const wizardOpen = load.status === "ready" && isCharacterDraft(load.character);
  useFullWidthPage(wizardOpen);
  // The all-sections form lays its cards out in a grid; the standard form stays
  // a single readable column.
  const grid =
    load.status === "ready" &&
    screensOf(load.character).OwnerSheet !== undefined &&
    !isCharacterDraft(load.character);

  const Edit = load.status === "ready" ? screensOf(load.character).Edit : null;
  return (
    <PageContainer
      size={wizardOpen || grid ? "wide" : "form"}
      // The wizard sits right under the navbar, flush with the window edges.
      className={wizardOpen ? "p-0" : "flex flex-col gap-4"}
    >
      {load.status === "loading" && <DetailSkeleton />}
      {load.status === "error" && (
        <p className="text-destructive text-sm">{translateKey(load.message)}</p>
      )}
      {load.status === "ready" && Edit && <Edit character={load.character} />}
    </PageContainer>
  );
}
