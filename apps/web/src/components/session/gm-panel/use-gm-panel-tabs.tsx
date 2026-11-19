import { useState, type ReactNode } from "react";
import {
  Dice5Icon,
  MapIcon,
  NotebookPenIcon,
  SparklesIcon,
  SwordsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { AdventureLocation, LiveSession } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { CombatTab, type CombatTabProps } from "@/components/session/gm-panel/combat-tab";
import { RollsTab } from "@/components/session/gm-panel/rolls-tab";
import { SceneTab } from "@/components/session/gm-panel/scene-tab";
import { StoryTab } from "@/components/session/gm-panel/story-tab";
import { SessionMemoryBlock } from "@/components/session/session-memory-block";
import { useSessionStory } from "@/hooks/use-session-story";
import type { WithId } from "@/lib/collections";

export type GmTabId = "scene" | "combat" | "story" | "rolls" | "group" | "notes";

export interface GmTab {
  id: GmTabId;
  label: string;
  icon: LucideIcon;
  /** A count or a round, next to the label. */
  badge?: ReactNode;
  /** Something waits there (a beat that rings, a combat running). */
  dot?: boolean;
  content: ReactNode;
}

export type GmPanelProps = Omit<CombatTabProps, "session"> & {
  session: WithId<LiveSession>;
  locations: WithId<AdventureLocation>[];
};

/**
 * The GM's tools in tabs — Scène, Combat, Récit, Jets, Notes — shared by the side
 * panel (computer) and the phone remote, which adds the map on top of
 * « Scène » and a « Groupe » tab. Starting a combat brings « Combat » forward.
 */
export function useGmPanelTabs(props: GmPanelProps, phone?: { map: ReactNode; party: ReactNode }) {
  const { t } = useTranslation("session", { keyPrefix: "gm.tabs" });
  const { session, locations, participants, combatants, enemies } = props;
  const story = useSessionStory(session);
  const combat = session.combat;
  const [active, setActive] = useState<GmTabId>(combat ? "combat" : "scene");
  // A combat starts or ends (here or in another tab): follow it.
  const [hadCombat, setHadCombat] = useState(Boolean(combat));
  if (Boolean(combat) !== hadCombat) {
    setHadCombat(Boolean(combat));
    setActive(combat ? "combat" : "scene");
  }

  const tabs: GmTab[] = [
    {
      id: "scene",
      label: t("scene"),
      icon: MapIcon,
      content: (
        <SceneTab
          session={session}
          locations={locations}
          participants={participants}
          combatants={combatants}
          story={story}
          map={phone?.map}
        />
      ),
    },
    {
      id: "combat",
      label: t("combat"),
      icon: SwordsIcon,
      badge: combat ? t("round", { round: combat.round }) : undefined,
      dot: Boolean(combat),
      content: <CombatTab {...props} />,
    },
    {
      id: "story",
      label: t("story"),
      icon: SparklesIcon,
      badge: story.dueCount > 0 ? story.dueCount : undefined,
      dot: story.dueCount > 0,
      content: <StoryTab story={story} session={session} />,
    },
    {
      id: "rolls",
      label: t("rolls"),
      icon: Dice5Icon,
      content: <RollsTab participants={participants} />,
    },
    ...(phone
      ? [
          {
            id: "group" as const,
            label: t("group"),
            icon: UsersIcon,
            content: phone.party,
          },
        ]
      : []),
    {
      id: "notes",
      label: t("notes"),
      icon: NotebookPenIcon,
      content: (
        <SessionMemoryBlock
          session={session}
          participants={participants}
          lootSources={{ enemies, locations, combatants }}
        />
      ),
    },
  ];
  return { tabs, active, setActive, story };
}
