import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { Campaign, CharacterChapter } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Markdown } from "@/components/ui/markdown";
import { StoryBox } from "@/components/character/story/story-box";
import {
  StoryEntryDialog,
  type StoryEntryValues,
} from "@/components/character/story/story-entry-dialog";
import { StoryVisibilityBadge } from "@/components/character/story/visibility-badge";
import { addChapter, deleteChapter, swapChapters, updateChapter } from "@/lib/character-story";
import type { WithId } from "@/lib/collections";

const EMPTY: StoryEntryValues = { title: "", body: "", visibility: "private" };

/** One chapter, read-only, in its own box: its title hides its text; who reads it, on the right. */
export function ChapterArticle({
  chapter,
  campaignName,
  actions,
}: {
  chapter: WithId<CharacterChapter>;
  campaignName?: string;
  actions?: React.ReactNode;
}) {
  return (
    <StoryBox
      storageKey={`chapter.${chapter.id}`}
      title={chapter.title}
      aside={
        <>
          <StoryVisibilityBadge visibility={chapter.visibility} campaignName={campaignName} />
          {actions}
        </>
      }
    >
      {chapter.imageUrl && (
        <img
          src={chapter.imageUrl}
          alt={chapter.title}
          loading="lazy"
          className="max-h-80 self-start rounded-md border object-contain"
        />
      )}
      <Markdown compact>{chapter.body}</Markdown>
    </StoryBox>
  );
}

interface Props {
  characterId: string;
  ownerId: string;
  chapters: WithId<CharacterChapter>[];
  campaigns: WithId<Campaign>[];
  onChange: () => void | Promise<void>;
}

/** The owner's chapters of their character's past: write, reorder, share. */
export function ChaptersCard({ characterId, ownerId, chapters, campaigns, onChange }: Props) {
  const { t } = useTranslation(["characters", "common"]);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [deleting, setDeleting] = useState<WithId<CharacterChapter> | null>(null);
  const current = editing?.id ? chapters.find((c) => c.id === editing.id) : undefined;
  const campaignName = (id?: string) => campaigns.find((c) => c.id === id)?.name;

  async function guarded(action: () => Promise<void>, failure = t("common:saveFailed")) {
    try {
      await action();
      await onChange();
    } catch (error) {
      console.error(error);
      toast.error(failure);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{t("story.chapters.intro")}</p>
      {chapters.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("story.chapters.empty")}</p>
      )}
      {chapters.map((chapter, index) => (
        <ChapterArticle
          key={chapter.id}
          chapter={chapter}
          campaignName={campaignName(chapter.campaignId)}
          actions={
            <div className="flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t("story.moveUp")}
                disabled={index === 0}
                onClick={() =>
                  guarded(() => swapChapters(characterId, chapter, chapters[index - 1]!))
                }
              >
                <ArrowUpIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t("story.moveDown")}
                disabled={index === chapters.length - 1}
                onClick={() =>
                  guarded(() => swapChapters(characterId, chapter, chapters[index + 1]!))
                }
              >
                <ArrowDownIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t("common:actions.edit")}
                onClick={() => setEditing({ id: chapter.id })}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive size-8"
                aria-label={t("common:actions.delete")}
                onClick={() => setDeleting(chapter)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          }
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setEditing({ id: null })}
      >
        <PlusIcon /> {t("story.chapters.add")}
      </Button>

      <StoryEntryDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        heading={current ? t("story.chapters.editTitle") : t("story.chapters.newTitle")}
        titleRequired
        withImage
        campaigns={campaigns}
        initial={
          current
            ? {
                title: current.title,
                body: current.body,
                imageUrl: current.imageUrl,
                visibility: current.visibility,
                campaignId: current.campaignId,
              }
            : EMPTY
        }
        onSave={async (values) => {
          if (current) await updateChapter(characterId, current.id, values);
          else {
            const order = chapters.reduce((max, c) => Math.max(max, c.order + 1), 0);
            await addChapter(characterId, ownerId, values, order);
          }
          await onChange();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("story.chapters.deleteTitle", { title: deleting?.title ?? "" })}
        description={t("story.deleteText")}
        onConfirm={() =>
          deleting
            ? guarded(() => deleteChapter(characterId, deleting.id), t("common:deleteFailed"))
            : undefined
        }
      />
    </div>
  );
}
