import type { Quest, QuestMilestone } from "@adventure-keeper/schemas";

import { tr } from "@/i18n";

/** « Révélée », « Accomplie »… — what happened, as a word. */
export function milestoneKind(kind: QuestMilestone["kind"]): string {
  return tr(`quests:milestones.${kind}`);
}

/** « Révélée en séance 3 (Le puits) » — the adventure only when its title is known. */
export function milestoneLine(
  milestone: QuestMilestone,
  adventureTitles: Readonly<Record<string, string>> = {},
): string {
  const when = milestone.sessionNumber
    ? tr("quests:milestones.inSession", { number: milestone.sessionNumber })
    : tr("quests:milestones.inASession");
  const adventure = adventureTitles[milestone.adventureId];
  return `${milestoneKind(milestone.kind)} ${when}${adventure ? ` (${adventure})` : ""}`;
}

/**
 * The quests that moved during one session, one line each:
 * « Le trésor d'Ashmoor : révélée, accomplie ».
 */
export function questsOfSession(
  quests: readonly Pick<Quest, "title" | "milestones">[],
  sessionId: string,
): string[] {
  return quests.flatMap((quest) => {
    const kinds = (quest.milestones ?? [])
      .filter((milestone) => milestone.sessionId === sessionId)
      .map((milestone) => milestoneKind(milestone.kind).toLocaleLowerCase());
    return kinds.length > 0
      ? [
          tr("quests:milestones.line", {
            title: quest.title,
            kinds: [...new Set(kinds)].join(", "),
          }),
        ]
      : [];
  });
}
