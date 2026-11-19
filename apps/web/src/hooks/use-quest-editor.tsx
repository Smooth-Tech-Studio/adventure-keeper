import { useState } from "react";
import { toast } from "sonner";
import type { Quest, QuestStatus } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuestFormDialog } from "@/components/quests/quest-form-dialog";
import { useQuests } from "@/hooks/use-quests";
import {
  EMPTY_QUEST,
  addPlayerQuest,
  addQuest,
  deleteQuest,
  updateQuest,
  type QuestInput,
} from "@/lib/quests";
import type { WithId } from "@/lib/collections";

/** Who reads the board: the GM writes the campaign's quests, a player their own. */
export interface QuestReader {
  isGm: boolean;
  uid: string;
  /** The player's character, to sign their quests (« Quête de Thorin »). */
  name: string;
}

/**
 * The editor of the quest board, shared by the campaign page and the session:
 * who may change a quest (the GM any, a player their own), the form and the
 * delete confirmation.
 */
export function useQuestEditor(campaignId: string, reader: QuestReader) {
  const { t } = useTranslation(["quests", "common"]);
  const quests = useQuests(campaignId, reader.isGm, reader.isGm ? undefined : reader.uid);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [deleting, setDeleting] = useState<WithId<Quest> | null>(null);
  const current = editing?.id ? quests.find((q) => q.id === editing.id) : undefined;
  const canEdit = (quest: Quest) => reader.isGm || quest.ownerUid === reader.uid;

  async function guarded(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    }
  }

  const dialogs = (
    <>
      <QuestFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        editing={Boolean(current)}
        audience={reader.isGm && !current?.ownerUid ? "gm" : "player"}
        // The GM editing a player's quest leaves its sharing to the player.
        sharing={!(reader.isGm && current?.ownerUid)}
        initial={
          current
            ? {
                title: current.title,
                summary: current.summary,
                status: current.status,
                revealed: current.revealed,
              }
            : reader.isGm
              ? EMPTY_QUEST
              : { ...EMPTY_QUEST, status: "active" }
        }
        onSave={async (values: QuestInput) => {
          if (current) await updateQuest(campaignId, current.id, values);
          else if (reader.isGm) {
            const order = quests.reduce((max, q) => Math.max(max, q.order + 1), 0);
            await addQuest(campaignId, values, order);
          } else {
            await addPlayerQuest(
              campaignId,
              { uid: reader.uid, name: reader.name },
              { ...values, shared: values.revealed },
            );
          }
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle", { title: deleting?.title ?? "" })}
        description={t("deleteText")}
        onConfirm={() =>
          deleting ? guarded(() => deleteQuest(campaignId, deleting.id)) : undefined
        }
      />
    </>
  );

  return {
    quests,
    canEdit,
    create: () => setEditing({ id: null }),
    edit: (quest: WithId<Quest>) => setEditing({ id: quest.id }),
    remove: (quest: WithId<Quest>) => setDeleting(quest),
    setStatus: (quest: WithId<Quest>, status: QuestStatus) =>
      guarded(() => updateQuest(campaignId, quest.id, { status })),
    toggleRevealed: (quest: WithId<Quest>) =>
      guarded(() => updateQuest(campaignId, quest.id, { revealed: !quest.revealed })),
    dialogs,
  };
}

export type QuestEditor = ReturnType<typeof useQuestEditor>;
