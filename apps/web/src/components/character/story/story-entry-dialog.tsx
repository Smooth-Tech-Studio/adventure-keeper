import { useState } from "react";
import { EyeIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";
import type { Campaign, StoryVisibility } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/ui/markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUrlField } from "@/components/image-url-field";
import type { WithId } from "@/lib/collections";

export interface StoryEntryValues {
  title: string;
  body: string;
  /** Chapters only: an illustration, as an external link. */
  imageUrl?: string;
  visibility: StoryVisibility;
  campaignId?: string;
  /** Journal only: the adventure the entry is filed under. */
  adventureId?: string;
}

/** An adventure a journal entry can be filed under, with its campaign. */
export interface StoryAdventure {
  id: string;
  title: string;
  campaignId: string;
}

const NO_ADVENTURE = "none";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description?: string;
  initial: StoryEntryValues;
  /** Campaigns the story can be shared in. Empty: private only. */
  campaigns: WithId<Campaign>[];
  /** The entry belongs to this campaign (a session's journal): no campaign pick. */
  lockedCampaign?: { id: string; name: string };
  /** Journal: the adventures to file the entry under (none: no pick). */
  adventures?: StoryAdventure[];
  titleRequired?: boolean;
  /** Offer an illustration (chapters). */
  withImage?: boolean;
  onSave: (values: StoryEntryValues) => Promise<void>;
}

/**
 * Write a chapter of a character's past or a journal entry: a title, Markdown
 * text with a preview, and who reads it — the player alone, the GM, or the
 * party of one campaign.
 */
export function StoryEntryDialog({
  open,
  onOpenChange,
  heading,
  description,
  initial,
  campaigns,
  lockedCampaign,
  adventures = [],
  titleRequired = false,
  withImage = false,
  onSave,
}: Props) {
  const { t } = useTranslation(["characters", "common"]);
  const [form, setForm] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  // Refill when the dialog opens, not on every parent render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(initial);
      setPreview(false);
    }
  }
  const set = (patch: Partial<StoryEntryValues>) => setForm((f) => ({ ...f, ...patch }));

  const campaignOptions = lockedCampaign
    ? [lockedCampaign]
    : campaigns.map((c) => ({ id: c.id, name: c.name }));
  const canShare = campaignOptions.length > 0;
  const shared = form.visibility !== "private";
  // A session's entry stays in its adventure: the pick is for free entries.
  const canFile = adventures.length > 0 && !lockedCampaign;
  const adventure = adventures.find((a) => a.id === form.adventureId);
  const campaignOf = (adventureId?: string) =>
    adventures.find((a) => a.id === adventureId)?.campaignId;

  async function submit() {
    if (titleRequired && !form.title.trim()) {
      toast.error(t("story.titleRequired"));
      return;
    }
    if (!form.body.trim()) {
      toast.error(t("story.bodyRequired"));
      return;
    }
    if (shared && !form.campaignId) {
      toast.error(t("story.campaignRequired"));
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="story-title" className="text-xs">
              {titleRequired ? t("story.title") : t("story.titleOptional")}
            </Label>
            <Input
              id="story-title"
              maxLength={160}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>

          {canFile && (
            <div className="grid gap-1">
              <Label className="text-xs">{t("story.adventure")}</Label>
              <Select
                value={form.adventureId ?? NO_ADVENTURE}
                onValueChange={(value) => {
                  const adventureId = value === NO_ADVENTURE ? undefined : value;
                  // Shared, an entry is read within its adventure's campaign.
                  set({ adventureId, campaignId: campaignOf(adventureId) ?? form.campaignId });
                }}
              >
                <SelectTrigger aria-label={t("story.adventure")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ADVENTURE}>{t("story.noAdventure")}</SelectItem>
                  {adventures.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {withImage && (
            <ImageUrlField
              value={{ imageUrl: form.imageUrl }}
              onChange={(value) => set({ imageUrl: value.imageUrl })}
              label={t("story.image")}
              placeholder={t("story.imagePlaceholder")}
            />
          )}

          <div className="grid gap-1">
            <div className="flex items-center gap-1">
              <Label htmlFor="story-body" className="mr-auto text-xs">
                {t("story.body")}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={preview}
                onClick={() => setPreview((v) => !v)}
              >
                {preview ? <PencilIcon /> : <EyeIcon />}
                {preview ? t("story.write") : t("story.preview")}
              </Button>
            </div>
            {preview ? (
              <div className="bg-muted/30 min-h-40 rounded-md border p-3">
                <Markdown>{form.body}</Markdown>
              </div>
            ) : (
              <Textarea
                id="story-body"
                rows={10}
                className="min-h-40"
                maxLength={20000}
                value={form.body}
                onChange={(e) => set({ body: e.target.value })}
              />
            )}
            <p className="text-muted-foreground text-xs">{t("story.markdownHint")}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-xs">{t("story.visibility")}</Label>
              <Select
                value={form.visibility}
                onValueChange={(value) => {
                  const visibility = value as StoryVisibility;
                  set({
                    visibility,
                    campaignId:
                      form.campaignId ??
                      (visibility !== "private" ? campaignOptions[0]?.id : undefined),
                  });
                }}
              >
                <SelectTrigger aria-label={t("story.visibility")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">{t("story.visibilities.private")}</SelectItem>
                  <SelectItem value="gm" disabled={!canShare}>
                    {t("story.visibilities.gm")}
                  </SelectItem>
                  <SelectItem value="party" disabled={!canShare}>
                    {t("story.visibilities.party")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shared && !lockedCampaign && !adventure && (
              <div className="grid gap-1">
                <Label className="text-xs">{t("story.campaign")}</Label>
                <Select
                  value={form.campaignId ?? ""}
                  onValueChange={(campaignId) => set({ campaignId })}
                >
                  <SelectTrigger aria-label={t("story.campaign")}>
                    <SelectValue placeholder={t("story.pickCampaign")} />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            {canShare ? t(`story.visibilityHints.${form.visibility}`) : t("story.noCampaign")}
          </p>
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
