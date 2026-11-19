import { useCallback } from "react";
import { ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { Resource, ResourceKind, ResourceVisibility } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrudSection } from "@/hooks/use-crud-section";
import {
  createResource,
  deleteResource,
  subscribeResources,
  updateResource,
} from "@/lib/resources";
import { run } from "@/lib/run";
import type { WithId } from "@/lib/collections";

/** No Cloud Storage in this project — resources are external URLs only. */
const KINDS = ["link", "image", "map", "handout"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (kind: string): kind is Kind => (KINDS as readonly string[]).includes(kind);

interface Props {
  campaignId: string;
  userId: string;
}

interface Draft {
  title: string;
  url: string;
  kind: ResourceKind;
  visibility: ResourceVisibility;
  description: string;
}

const emptyDraft: Draft = {
  title: "",
  url: "",
  kind: "link",
  visibility: "gm",
  description: "",
};

function isImage(kind: ResourceKind): boolean {
  return kind === "image" || kind === "map";
}

export function ResourcesSection({ campaignId, userId }: Props) {
  const { t } = useTranslation(["campaigns", "common"]);
  const {
    items: resources,
    editingId,
    creating,
    draft,
    setDraft,
    busy,
    startCreate,
    startEdit,
    cancel,
    submit,
  } = useCrudSection<WithId<Resource>, Draft>({
    emptyDraft,
    subscribe: useCallback((onChange) => subscribeResources(campaignId, onChange), [campaignId]),
    toDraft: (resource) => ({
      title: resource.title,
      url: resource.url,
      kind: resource.kind,
      visibility: resource.visibility,
      description: resource.description ?? "",
    }),
    validate: (d) => {
      if (!d.title.trim() || !d.url.trim()) return t("resources.required");
      try {
        void new URL(d.url.trim());
      } catch {
        return t("resources.invalidUrl");
      }
      return null;
    },
    create: (d) => createResource(campaignId, d, userId),
    update: (id, d) =>
      updateResource(campaignId, id, {
        title: d.title.trim(),
        url: d.url.trim(),
        kind: d.kind,
        visibility: d.visibility,
        description: d.description.trim() || undefined,
      }),
    saveErrorMessage: t("resources.saveFailed"),
  });

  const form = (
    <div className="grid gap-2 rounded-md border p-3">
      <Input
        placeholder={t("resources.titlePlaceholder")}
        value={draft.title}
        onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
      />
      <Input
        type="url"
        placeholder="https://…"
        value={draft.url}
        onChange={(event) => setDraft((d) => ({ ...d, url: event.target.value }))}
      />
      <Textarea
        rows={2}
        placeholder={t("resources.descriptionPlaceholder")}
        value={draft.description}
        onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-muted-foreground text-xs">{t("resources.type")}</Label>
        <Select
          value={draft.kind}
          onValueChange={(value) => setDraft((d) => ({ ...d, kind: value as ResourceKind }))}
        >
          <SelectTrigger className="h-8 w-32" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`resources.kinds.${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={busy}>
            {editingId ? t("common:actions.save") : t("common:actions.add")}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {!creating && !editingId && (
        <Button type="button" size="sm" className="self-end" onClick={startCreate}>
          <PlusIcon /> {t("resources.new")}
        </Button>
      )}
      {creating && form}

      {resources.length === 0 && !creating && (
        <p className="text-muted-foreground text-sm">{t("resources.none")}</p>
      )}

      {resources.map((resource) => {
        if (editingId === resource.id) return <div key={resource.id}>{form}</div>;
        return (
          <div key={resource.id} className="flex gap-3 rounded-md border p-3">
            {isImage(resource.kind) && (
              <img
                src={resource.url}
                alt=""
                className="size-16 shrink-0 rounded object-cover"
                onError={(event) => (event.currentTarget.style.display = "none")}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{resource.title}</span>
                <Badge variant="outline">
                  {isKind(resource.kind) ? t(`resources.kinds.${resource.kind}`) : resource.kind}
                </Badge>
              </div>
              {resource.description && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                  {resource.description}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                >
                  <ExternalLinkIcon className="size-3" /> {t("resources.open")}
                </a>
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("common:actions.edit")}
                    onClick={() => startEdit(resource)}
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 size-7"
                    aria-label={t("common:actions.delete")}
                    onClick={() =>
                      run(
                        () => deleteResource(campaignId, resource.id),
                        t("resources.deleteFailed"),
                      )
                    }
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
