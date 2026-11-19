import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SheetStory } from "@/components/character/character-sheet/types";

/**
 * The sheet's « Histoire », in three: the backstory (with the personality),
 * the chapters of the past, and the journal of play.
 */
export function StoryTabs({ backstory, story }: { backstory: ReactNode; story: SheetStory }) {
  const { t } = useTranslation("sheet", { keyPrefix: "storyTabs" });
  const tabs: { id: string; label: string; count?: number; content: ReactNode }[] = [
    {
      id: "backstory",
      label: t("backstory"),
      content: (
        <>
          {backstory}
          {story.personality}
        </>
      ),
    },
    { id: "chapters", label: t("chapters"), count: story.chapterCount, content: story.chapters },
    { id: "journal", label: t("journal"), count: story.journalCount, content: story.journal },
  ];

  return (
    <Tabs defaultValue="backstory" className="gap-3">
      <TabsList variant="pill" aria-label={t("label")}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
            {tab.count ? <span className="tabular-nums opacity-70">{tab.count}</span> : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="grid gap-3">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
