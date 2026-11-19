import { useState, type ReactNode } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { Campaign, JournalEntry } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Markdown } from "@/components/ui/markdown";
import { StoryBox } from "@/components/character/story/story-box";
import {
  StoryEntryDialog,
  type StoryAdventure,
  type StoryEntryValues,
} from "@/components/character/story/story-entry-dialog";
import { StoryVisibilityBadge } from "@/components/character/story/visibility-badge";
import { addJournalEntry, deleteJournalEntry, updateJournalEntry } from "@/lib/character-story";
import { toMillis } from "@/lib/firestore";
import type { WithId } from "@/lib/collections";
import { currentLanguage } from "@/i18n";

const EMPTY: StoryEntryValues = { title: "", body: "", visibility: "private" };

/** When an entry was lived: « Séance 3 — 12 mars 2026 », else its date (the adventure heads its box). */
function useEntryContext() {
  const { t } = useTranslation("characters", { keyPrefix: "story.journal" });
  return (entry: JournalEntry) => {
    const date = toMillis(entry.createdAt)
      ? new Date(toMillis(entry.createdAt)).toLocaleDateString(currentLanguage(), {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
    if (entry.sessionNumber) return t("sessionContext", { number: entry.sessionNumber, date });
    return date;
  };
}

interface Props {
  characterId: string;
  ownerId: string;
  characterName: string;
  entries: WithId<JournalEntry>[];
  campaigns: WithId<Campaign>[];
  /** The adventures of those campaigns the character plays: what an entry can be filed under. */
  adventures: StoryAdventure[];
  onChange: () => void | Promise<void>;
}

const NO_ADVENTURE = "none";

/**
 * The journal, one box per adventure — its title on top, its entries newest
 * first — and the entries filed under none last. A box hides with its title.
 */
export function JournalByAdventure({
  entries,
  campaignName,
  actions,
}: {
  entries: WithId<JournalEntry>[];
  campaignName?: (entry: JournalEntry) => string | undefined;
  actions?: (entry: WithId<JournalEntry>) => ReactNode;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "story.journal" });
  const groups = new Map<string, { title: string; entries: WithId<JournalEntry>[] }>();
  for (const entry of entries) {
    const key = entry.adventureId ?? NO_ADVENTURE;
    const group = groups.get(key) ?? {
      title: entry.adventureId
        ? (entry.adventureTitle ?? t("untitledAdventure"))
        : t("noAdventure"),
      entries: [],
    };
    group.entries.push(entry);
    groups.set(key, group);
  }
  const ordered = [...groups].sort(([a], [b]) =>
    a === NO_ADVENTURE ? 1 : b === NO_ADVENTURE ? -1 : 0,
  );

  return ordered.map(([key, group]) => (
    <StoryBox
      key={key}
      storageKey={`journal.${key}`}
      title={group.title}
      large
      aside={
        <Badge variant="secondary" className="tabular-nums">
          {t("count", { count: group.entries.length })}
        </Badge>
      }
    >
      {group.entries.map((entry) => (
        <JournalEntryArticle
          key={entry.id}
          entry={entry}
          campaignName={campaignName?.(entry)}
          actions={actions?.(entry)}
        />
      ))}
    </StoryBox>
  ));
}

/** One journal entry, read-only: its title, where it was lived, who reads it, its text. */
export function JournalEntryArticle({
  entry,
  campaignName,
  actions,
}: {
  entry: WithId<JournalEntry>;
  campaignName?: string;
  actions?: React.ReactNode;
}) {
  const context = useEntryContext();
  return (
    <article className="flex flex-col gap-1.5 border-b pb-4 last:border-b-0 last:pb-0">
      <header className="flex flex-wrap items-center justify-end gap-2">
        <div className="min-w-0 flex-1 basis-48">
          {entry.title && (
            <h4 className="text-xl leading-snug font-semibold tracking-tight">{entry.title}</h4>
          )}
          <p className="text-muted-foreground text-xs">{context(entry)}</p>
        </div>
        <StoryVisibilityBadge visibility={entry.visibility} campaignName={campaignName} />
        {actions}
      </header>
      <Markdown compact>{entry.body}</Markdown>
    </article>
  );
}

/** The owner's journal: what the character lived, session after session. */
export function JournalCard({
  characterId,
  ownerId,
  characterName,
  entries,
  campaigns,
  adventures,
  onChange,
}: Props) {
  const { t } = useTranslation(["characters", "common"]);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [deleting, setDeleting] = useState<WithId<JournalEntry> | null>(null);
  const current = editing?.id ? entries.find((e) => e.id === editing.id) : undefined;
  const campaignName = (entry: JournalEntry) =>
    campaigns.find((c) => c.id === entry.campaignId)?.name ?? entry.campaignName;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-muted-foreground min-w-0 flex-1 basis-72 text-sm">
          {t("story.journal.intro")}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ id: null })}>
          <PlusIcon /> {t("story.journal.add")}
        </Button>
      </div>
      {entries.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("story.journal.empty")}</p>
      )}
      <JournalByAdventure
        entries={entries}
        campaignName={campaignName}
        actions={(entry) => (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("common:actions.edit")}
              onClick={() => setEditing({ id: entry.id })}
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive size-8"
              aria-label={t("common:actions.delete")}
              onClick={() => setDeleting(entry)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </>
        )}
      />

      <StoryEntryDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        heading={current ? t("story.journal.editTitle") : t("story.journal.newTitle")}
        campaigns={campaigns}
        adventures={adventures}
        lockedCampaign={
          current?.sessionId && current.campaignId
            ? { id: current.campaignId, name: campaignName(current) ?? "" }
            : undefined
        }
        initial={
          current
            ? {
                title: current.title ?? "",
                body: current.body,
                visibility: current.visibility,
                campaignId: current.campaignId,
                adventureId: current.adventureId,
              }
            : EMPTY
        }
        onSave={async (values) => {
          const { adventureId, ...rest } = values;
          const adventure = adventures.find((a) => a.id === adventureId);
          // A session's entry keeps the adventure it was written in; so does an untouched pick.
          const filed =
            current?.sessionId || adventureId === current?.adventureId
              ? {}
              : { adventureId: adventure?.id ?? null, adventureTitle: adventure?.title ?? null };
          if (current) await updateJournalEntry(characterId, current.id, { ...rest, ...filed });
          else {
            await addJournalEntry(characterId, ownerId, characterName, values, {
              campaignName: campaigns.find((c) => c.id === values.campaignId)?.name,
              adventureId: adventure?.id,
              adventureTitle: adventure?.title,
            });
          }
          await onChange();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("story.journal.deleteTitle")}
        description={t("story.deleteText")}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteJournalEntry(characterId, deleting.id);
            await onChange();
          } catch (error) {
            console.error(error);
            toast.error(t("common:deleteFailed"));
          }
        }}
      />
    </div>
  );
}
