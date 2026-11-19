import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  ScrollTextIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  QUEST_STATUSES,
  type CodexEntry,
  type Quest,
  type QuestStatus,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignCard } from "@/components/campaign/campaign-card";
import { CodexLinksProvider } from "@/hooks/codex-links";
import type { QuestEditor, QuestReader } from "@/hooks/use-quest-editor";
import type { WithId } from "@/lib/collections";
import { milestoneLine } from "@/lib/quest-milestones";
import { cn } from "@/lib/utils";

/** « Quête de Thorin », « Personnelle » / « Partagée » — a player's own quest, labelled. */
export function QuestOwnerBadges({ quest, reader }: { quest: Quest; reader: QuestReader }) {
  const { t } = useTranslation("quests");
  if (!quest.ownerUid) return null;
  const mine = quest.ownerUid === reader.uid;
  return (
    <>
      {!mine && quest.ownerName && (
        <Badge variant="secondary">{t("ownedBy", { name: quest.ownerName })}</Badge>
      )}
      {(mine || reader.isGm) && (
        <Badge variant="outline">{quest.revealed ? t("shared") : t("personal")}</Badge>
      )}
    </>
  );
}

const STATUS_ORDER = Object.fromEntries(QUEST_STATUSES.map((status, index) => [status, index]));

/** A quest's state as a round mark: dashed for a rumour, ringed under way, ticked, crossed. */
function QuestMark({ status }: { status: QuestStatus }) {
  const { t } = useTranslation("quests");
  return (
    <span
      role="img"
      aria-label={t(`statuses.${status}`)}
      title={t(`statuses.${status}`)}
      className={cn(
        "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border-2",
        status === "rumor" && "border-muted-foreground/60 border-dashed",
        status === "active" && "border-chart-4",
        status === "done" && "border-emerald-500 bg-emerald-500 text-white",
        status === "failed" && "border-muted-foreground/40 text-muted-foreground",
      )}
    >
      {status === "done" && <CheckIcon className="size-3" strokeWidth={3} />}
      {status === "failed" && <XIcon className="size-3" strokeWidth={3} />}
    </span>
  );
}

/**
 * « Quêtes » on the campaign page — rumours and quests under way first, then
 * the ones accomplished or failed, struck through. The GM writes the
 * campaign's and decides what players see; each player may add their own,
 * personal or shared.
 */
export function QuestsCard({
  campaignId,
  reader,
  editor,
  codex,
  adventureTitles = {},
  titled = true,
}: {
  campaignId: string;
  reader: QuestReader;
  /** The quests and their dialogs (`useQuestEditor`), shared with the page's counts. */
  editor: QuestEditor;
  /** The codex this reader sees, for the `[[mentions]]`. */
  codex: WithId<CodexEntry>[];
  /** Adventure titles by id, to say where a quest moved (« en séance 3 (Le puits) »). */
  adventureTitles?: Readonly<Record<string, string>>;
  /** Off in a phone's tab, which names it already. */
  titled?: boolean;
}) {
  const { t } = useTranslation(["quests", "common"]);
  const { isGm } = reader;
  const quests = [...editor.quests].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const open = quests.filter((q) => q.status === "rumor" || q.status === "active").length;

  return (
    <CodexLinksProvider campaignId={campaignId} entries={codex}>
      <CampaignCard
        title={titled ? t("title") : undefined}
        icon={ScrollTextIcon}
        action={
          open > 0 && (
            <span className="text-muted-foreground text-xs">{t("openCount", { count: open })}</span>
          )
        }
      >
        {quests.length === 0 && (
          <p className="text-muted-foreground text-sm">{isGm ? t("emptyGm") : t("empty")}</p>
        )}
        <ul className="divide-y">
          {quests.map((quest) => (
            <QuestRow
              key={quest.id}
              quest={quest}
              reader={reader}
              editor={editor}
              adventureTitles={adventureTitles}
            />
          ))}
        </ul>
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={editor.create}>
          <PlusIcon /> {t("new")}
        </Button>
      </CampaignCard>
      {editor.dialogs}
    </CodexLinksProvider>
  );
}

/** A quest in the list: its mark, title and badges, the controls of who may change it, its summary and milestones. */
export function QuestRow({
  quest,
  reader,
  editor,
  adventureTitles = {},
}: {
  quest: WithId<Quest>;
  reader: QuestReader;
  editor: QuestEditor;
  /** Adventure titles by id, to say where the quest moved. */
  adventureTitles?: Readonly<Record<string, string>>;
}) {
  const { t } = useTranslation("quests");
  const { isGm } = reader;
  const finished = quest.status === "done" || quest.status === "failed";
  return (
    <li className="flex items-start gap-2.5 py-2 first:pt-0">
      <QuestMark status={quest.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={cn(
              "min-w-0 flex-1 text-sm font-medium",
              finished && "text-muted-foreground line-through",
            )}
          >
            {quest.title}
          </span>
          <QuestOwnerBadges quest={quest} reader={reader} />
          {isGm && !quest.ownerUid && !quest.revealed && (
            <Badge variant="outline">{t("hidden")}</Badge>
          )}
          {editor.canEdit(quest) && <QuestControls quest={quest} editor={editor} isGm={isGm} />}
        </div>
        {quest.summary.trim() && !finished && (
          <Markdown className="text-muted-foreground mt-0.5 text-xs">{quest.summary}</Markdown>
        )}
        {(quest.milestones ?? []).length > 0 && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {quest.milestones
              .map((milestone) => milestoneLine(milestone, adventureTitles))
              .join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}

/** Status, the GM's eye, edit and delete — for who may change the quest. */
function QuestControls({
  quest,
  editor,
  isGm,
}: {
  quest: WithId<Quest>;
  editor: QuestEditor;
  isGm: boolean;
}) {
  const { t } = useTranslation(["quests", "common"]);
  return (
    <span className="flex items-center">
      <Select value={quest.status} onValueChange={(v) => editor.setStatus(quest, v as QuestStatus)}>
        <SelectTrigger
          size="sm"
          className="h-7 w-32"
          aria-label={t("statusOf", { title: quest.title })}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUEST_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`statuses.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* A player's quest is theirs to share: no eye for the GM. */}
      {isGm && !quest.ownerUid && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={
            quest.revealed
              ? t("hideWhat", { title: quest.title })
              : t("revealWhat", { title: quest.title })
          }
          onClick={() => editor.toggleRevealed(quest)}
        >
          {quest.revealed ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={t("common:actions.edit")}
        onClick={() => editor.edit(quest)}
      >
        <PencilIcon className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive size-7"
        aria-label={t("common:actions.delete")}
        onClick={() => editor.remove(quest)}
      >
        <Trash2Icon className="size-3.5" />
      </Button>
    </span>
  );
}
