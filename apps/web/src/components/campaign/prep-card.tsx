import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { NotebookPenIcon, PaperclipIcon, StickyNoteIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CampaignCard } from "@/components/campaign/campaign-card";
import { NotesSection } from "@/components/campaign/notes-section";
import { ResourcesSection } from "@/components/campaign/resources-section";
import { subscribeNotes } from "@/lib/notes";
import { subscribeResources } from "@/lib/resources";

type Panel = "notes" | "resources";

/**
 * The GM's preparation, never shown to players: the notebook and the
 * resources, each a chip with its count that opens it in a side panel.
 */
export function PrepCard({
  campaignId,
  userId,
  titled = true,
}: {
  campaignId: string;
  userId: string;
  /** Off in a phone's tab, which names it already. */
  titled?: boolean;
}) {
  const { t } = useTranslation("campaigns");
  const [open, setOpen] = useState<Panel | null>(null);
  const [counts, setCounts] = useState<Record<Panel, number>>({ notes: 0, resources: 0 });
  useEffect(
    () => subscribeNotes(campaignId, (notes) => setCounts((c) => ({ ...c, notes: notes.length }))),
    [campaignId],
  );
  useEffect(
    () =>
      subscribeResources(campaignId, (resources) =>
        setCounts((c) => ({ ...c, resources: resources.length })),
      ),
    [campaignId],
  );

  const panels: Record<Panel, { icon: ComponentType<{ className?: string }>; body: ReactNode }> = {
    notes: {
      icon: StickyNoteIcon,
      body: <NotesSection campaignId={campaignId} userId={userId} />,
    },
    resources: {
      icon: PaperclipIcon,
      body: <ResourcesSection campaignId={campaignId} userId={userId} />,
    },
  };

  return (
    <CampaignCard
      title={titled ? t("prep.title") : undefined}
      icon={NotebookPenIcon}
      action={
        <span className="text-[10px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-400">
          {t("prep.gmOnly")}
        </span>
      }
      className="border-dashed border-amber-500/50"
      contentClassName="flex flex-wrap gap-2"
    >
      {(Object.keys(panels) as Panel[]).map((panel) => {
        const Icon = panels[panel].icon;
        return (
          <Button
            key={panel}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setOpen(panel)}
          >
            <Icon /> {t(`${panel}.title`)}
            <span className="text-muted-foreground tabular-nums">· {counts[panel]}</span>
          </Button>
        );
      })}
      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent>
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{t(`${open}.title`)}</SheetTitle>
                <SheetDescription>{t(`${open}.intro`)}</SheetDescription>
              </SheetHeader>
              <SheetBody>{panels[open].body}</SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </CampaignCard>
  );
}
