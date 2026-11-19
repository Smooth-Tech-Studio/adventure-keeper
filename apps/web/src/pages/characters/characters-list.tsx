import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListSkeleton } from "@/components/ui/page-loading";
import { CharacterListCard } from "@/components/character/character-list-card";
import { deleteCharacter, listMyCharacters, type WithId } from "@/lib/collections";
import { useAuth } from "@/hooks/use-auth";
import { useLicenceNotice } from "@/hooks/use-licence-notice";
import { systemOf } from "@/systems";
import type { Character } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";
import { useContentPacks, useRegisterPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { packContentOf } from "@/systems/dnd2024/lib/character-storage";

export function CharactersListPage() {
  const { t } = useTranslation(["characters", "common"]);
  const { user } = useAuth();
  const [characters, setCharacters] = useState<WithId<Character>[] | null>(null);
  // 5E cards show SRD species, class and background names.
  useLicenceNotice(
    characters?.map((c) => systemOf(c).licenceNotice).find((notice) => notice !== null) ?? null,
  );
  // Each sheet's own copy of its pack entries, so pack species names resolve.
  useRegisterPacks(packContentOf(characters ?? []));
  useContentPacks();
  const [error, setError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WithId<Character> | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setCharacters(null);
    setError(false);
    listMyCharacters(user.uid)
      .then((rows) => active && setCharacters(rows))
      .catch((err) => {
        console.error(err);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("list.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("list.intro")}</p>
        </div>
        <Button asChild>
          <Link to="/characters/new">
            <PlusIcon /> {t("list.new")}
          </Link>
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{t("list.loadFailed")}</p>}

      {!error && characters === null && <ListSkeleton />}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("list.deleteTitle", { name: pendingDelete?.name?.trim() || t("list.untitled") })}
        description={t("list.deleteText")}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteCharacter(pendingDelete.id);
            setCharacters((prev) => prev?.filter((c) => c.id !== pendingDelete.id) ?? null);
            toast.success(t("list.deleted"));
          } catch (err) {
            console.error(err);
            toast.error(t("list.deleteFailed"));
          } finally {
            setPendingDelete(null);
          }
        }}
      />

      {!error && characters?.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("list.emptyTitle")}</CardTitle>
            <CardDescription>{t("list.emptyText")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/characters/new">
                <PlusIcon /> {t("list.create")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
        {characters?.map((character) => (
          <CharacterListCard
            key={character.id}
            character={character}
            onDelete={() => setPendingDelete(character)}
          />
        ))}
      </div>
    </PageContainer>
  );
}
