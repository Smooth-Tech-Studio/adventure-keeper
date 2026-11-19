import { useCallback, useEffect, useState } from "react";
import { EyeIcon, EyeOffIcon, NotebookPenIcon } from "lucide-react";
import { toast } from "sonner";
import type { AdventureParticipant, JournalEntry, LiveSession } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { StoryEntryDialog } from "@/components/character/story/story-entry-dialog";
import { StoryVisibilityBadge } from "@/components/character/story/visibility-badge";
import {
  addJournalEntry,
  listMySessionEntries,
  listSessionJournal,
  updateJournalEntry,
} from "@/lib/character-story";
import { setJournalEntryHidden } from "@/lib/sessions";
import type { WithId } from "@/lib/collections";

interface Props {
  campaignId: string;
  campaignName: string;
  adventureId: string;
  adventureTitle: string;
  session: WithId<LiveSession>;
  number: number;
  isGm: boolean;
  userId: string;
  participants: WithId<AdventureParticipant>[];
  onSessionChange: () => void | Promise<void>;
  /** Told how many entries this reader sees (for a tab label). */
  onCount?: (count: number) => void;
}

/**
 * Under a session's recap: what the characters wrote about it in their
 * journals. A player writes (or edits) their character's entry here; the GM
 * may keep one out of the chronicle — it stays in the character's journal.
 */
export function SessionJournal({
  campaignId,
  campaignName,
  adventureId,
  adventureTitle,
  session,
  number,
  isGm,
  userId,
  participants,
  onSessionChange,
  onCount,
}: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const [shared, setShared] = useState<WithId<JournalEntry>[]>([]);
  const [mine, setMine] = useState<WithId<JournalEntry>[]>([]);
  const [writing, setWriting] = useState<WithId<AdventureParticipant> | null>(null);

  const reload = useCallback(async () => {
    const [s, m] = await Promise.all([
      listSessionJournal(campaignId, session.id, isGm).catch((error) => {
        console.error(error);
        return [] as WithId<JournalEntry>[];
      }),
      isGm
        ? Promise.resolve([] as WithId<JournalEntry>[])
        : listMySessionEntries(userId, session.id).catch(() => [] as WithId<JournalEntry>[]),
    ]);
    setShared(s);
    setMine(m);
  }, [campaignId, session.id, isGm, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const hidden = new Set(session.hiddenEntryIds ?? []);
  const visible = shared.filter((e) => isGm || !hidden.has(e.id));
  // The characters this reader plays in the adventure (and who were there).
  const myCharacters = participants.filter((p) => p.playerId === userId);
  const entryOf = (characterId: string) => mine.find((e) => e.characterId === characterId);
  const editing = writing ? entryOf(writing.characterId) : undefined;

  async function toggleHidden(entry: WithId<JournalEntry>) {
    try {
      await setJournalEntryHidden(
        campaignId,
        adventureId,
        session.id,
        entry.id,
        !hidden.has(entry.id),
      );
      await onSessionChange();
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    }
  }

  const visibleCount = visible.length;
  useEffect(() => onCount?.(visibleCount), [onCount, visibleCount]);

  if (visible.length === 0 && myCharacters.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("journal.none")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.length > 0 && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
          <NotebookPenIcon className="size-3" /> {t("journal.title")}
        </p>
      )}
      {visible.map((entry) => {
        const isHidden = hidden.has(entry.id);
        return (
          <blockquote key={entry.id} className={`border-l-2 pl-3 ${isHidden ? "opacity-50" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {entry.title
                  ? t("journal.byTitled", { name: entry.characterName, title: entry.title })
                  : t("journal.by", { name: entry.characterName })}
              </span>
              {isGm && entry.visibility === "gm" && <StoryVisibilityBadge visibility="gm" />}
              {isGm && isHidden && <Badge variant="outline">{t("journal.hidden")}</Badge>}
              {isGm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7"
                  onClick={() => toggleHidden(entry)}
                >
                  {isHidden ? <EyeIcon /> : <EyeOffIcon />}
                  {isHidden ? t("journal.show") : t("journal.hide")}
                </Button>
              )}
            </div>
            <Markdown className="text-muted-foreground">{entry.body}</Markdown>
          </blockquote>
        );
      })}
      {myCharacters.map((participant) => (
        <Button
          key={participant.characterId}
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setWriting(participant)}
        >
          <NotebookPenIcon />
          {entryOf(participant.characterId)
            ? t("journal.editMine", { name: participant.characterName })
            : t("journal.writeMine", { name: participant.characterName })}
        </Button>
      ))}

      <StoryEntryDialog
        open={writing !== null}
        onOpenChange={(open) => !open && setWriting(null)}
        heading={t("journal.dialogTitle", { name: writing?.characterName ?? "", number })}
        description={t("journal.dialogHint")}
        campaigns={[]}
        lockedCampaign={{ id: campaignId, name: campaignName }}
        initial={
          editing
            ? {
                title: editing.title ?? "",
                body: editing.body,
                visibility: editing.visibility,
                campaignId,
              }
            : { title: "", body: "", visibility: "party", campaignId }
        }
        onSave={async (values) => {
          if (!writing) return;
          if (editing) await updateJournalEntry(writing.characterId, editing.id, values);
          else {
            await addJournalEntry(writing.characterId, userId, writing.characterName, values, {
              campaignId,
              campaignName,
              adventureId,
              adventureTitle,
              sessionId: session.id,
              sessionNumber: number,
            });
          }
          await reload();
        }}
      />
    </div>
  );
}
