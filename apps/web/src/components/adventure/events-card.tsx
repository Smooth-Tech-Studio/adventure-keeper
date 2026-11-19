import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import type { AdventureEvent } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityRow } from "@/components/adventure/entity-row";
import {
  addEvent,
  deleteEvent,
  swapEventOrder,
  updateEvent,
  type EventInput,
} from "@/lib/adventures";
import type { WithId } from "@/lib/collections";
import { momentLabel } from "@/lib/game-time";

const emptyEvent = (): EventInput => ({ title: "", description: "", trigger: "" });

function EventFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EventInput;
  onSave: (values: EventInput) => Promise<void>;
}) {
  const { t } = useTranslation(["adventures", "common"]);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Refill when the dialog opens, not on every parent render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initial);
  }
  const set = (patch: Partial<EventInput>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    if (!form.title.trim()) {
      toast.error(t("events.titleRequired"));
      return;
    }
    setBusy(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("events.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="event-title" className="text-xs">
              {t("events.name")}
            </Label>
            <Input
              id="event-title"
              autoFocus
              maxLength={160}
              placeholder={t("events.namePlaceholder")}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="event-trigger" className="text-xs">
              {t("events.trigger")}
            </Label>
            <Input
              id="event-trigger"
              maxLength={500}
              placeholder={t("events.triggerPlaceholder")}
              value={form.trigger}
              onChange={(e) => set({ trigger: e.target.value })}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">{t("events.due")}</Label>
            <div className="flex items-center gap-2">
              <Input
                aria-label={t("events.dueDay")}
                type="number"
                min={1}
                className="w-24"
                placeholder={t("events.dueDayPlaceholder")}
                value={form.dueDay ?? ""}
                onChange={(e) => {
                  const day = Math.round(Number(e.target.value));
                  set({ dueDay: e.target.value && day >= 1 ? day : undefined });
                }}
              />
              <Input
                aria-label={t("events.dueTime")}
                type="time"
                className="w-32"
                value={form.dueTime ?? ""}
                onChange={(e) => set({ dueTime: e.target.value || undefined })}
              />
            </div>
            <p className="text-muted-foreground text-xs">{t("events.dueHint")}</p>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="event-description" className="text-xs">
              {t("events.description")}
            </Label>
            <Textarea
              id="event-description"
              rows={3}
              maxLength={5000}
              placeholder={t("events.descriptionPlaceholder")}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
            <p className="text-muted-foreground text-xs">{t("events.descriptionHint")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  campaignId: string;
  adventureId: string;
  events: WithId<AdventureEvent>[];
  onChange: () => void | Promise<void>;
}

/**
 * « Événements » — the story beats the GM plans for the adventure, in order.
 * GM-only: they are revealed during a session, and the revealed ones reach the
 * players through the chronicle.
 */
export function EventsCard({ campaignId, adventureId, events, onChange }: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const [editing, setEditing] = useState<{ mode: "add" } | { mode: "edit"; id: string } | null>(
    null,
  );
  const sorted = [...events].sort((a, b) => a.order - b.order);
  const current = editing?.mode === "edit" ? sorted.find((e) => e.id === editing.id) : undefined;
  const revealed = events.filter((e) => e.isRevealed).length;

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
    <CollapsibleCard
      title={
        <span className="flex items-center gap-2">
          <SparklesIcon className="size-4" /> {t("events.title")}
        </span>
      }
      description={t("events.intro")}
      storageKey="adv-events"
      summary={
        events.length > 0
          ? t("events.summary", { count: events.length, revealed })
          : t("events.none")
      }
      action={events.length > 0 ? <Badge variant="secondary">{events.length}</Badge> : undefined}
    >
      <div className="flex flex-col gap-3">
        {sorted.length === 0 && <p className="text-muted-foreground text-sm">{t("events.none")}</p>}
        {sorted.map((event, index) => (
          <div key={event.id} className="flex items-start gap-1">
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t("events.moveUp")}
                disabled={index === 0}
                onClick={() =>
                  guarded(() => swapEventOrder(campaignId, adventureId, event, sorted[index - 1]!))
                }
              >
                <ArrowUpIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t("events.moveDown")}
                disabled={index === sorted.length - 1}
                onClick={() =>
                  guarded(() => swapEventOrder(campaignId, adventureId, event, sorted[index + 1]!))
                }
              >
                <ArrowDownIcon className="size-3.5" />
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <EntityRow
                name={event.title}
                badges={[
                  event.isRevealed ? t("events.revealed") : undefined,
                  event.trigger ? t("events.triggerBadge", { value: event.trigger }) : undefined,
                  event.dueDay != null || event.dueTime
                    ? t("events.dueBadge", {
                        value: momentLabel({ day: event.dueDay, time: event.dueTime }),
                      })
                    : undefined,
                ].filter(Boolean)}
                detail={event.description}
                onEdit={() => setEditing({ mode: "edit", id: event.id })}
                onDelete={() =>
                  guarded(
                    () => deleteEvent(campaignId, adventureId, event.id),
                    t("common:deleteFailed"),
                  )
                }
                deleteLabel={t("events.deleteWhat")}
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setEditing({ mode: "add" })}
        >
          <PlusIcon /> {t("events.add")}
        </Button>
      </div>

      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={
          current
            ? {
                title: current.title,
                description: current.description ?? "",
                trigger: current.trigger ?? "",
                dueDay: current.dueDay,
                dueTime: current.dueTime,
              }
            : emptyEvent()
        }
        onSave={async (values) => {
          if (current) await updateEvent(campaignId, adventureId, current.id, values);
          else await addEvent(campaignId, adventureId, values);
          await onChange();
        }}
      />
    </CollapsibleCard>
  );
}
