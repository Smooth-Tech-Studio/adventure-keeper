import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  isCharacterDraft,
  type StandardCharacter,
  type StandardCharacterDraft,
  type StandardCharacterDraftInput,
  type StandardCharacterInput,
} from "@adventure-keeper/schemas";

import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUrlField, type ImageUrlValue } from "@/components/image-url-field";
import { ColorField } from "@/components/character/color-field";
import { ItemListEditor } from "@/components/character/item-list-editor";
import { formatCoinPrice } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";
import {
  cleanItems,
  draftFromGearDef,
  toItemDraft,
  type ItemDraft,
} from "@/systems/dnd2024/lib/items";
import { findById, useGearCatalog } from "@/systems/dnd2024/lib/equipment";
import {
  createCharacter,
  createCharacterDraft,
  updateCharacter,
  updateCharacterDraft,
  type WithId,
} from "@/lib/collections";
import { useAuth } from "@/hooks/use-auth";

const formSchema = z.object({
  name: z.string().trim().min(1, "characters:standardForm.nameRequired"),
  /** As typed: turned into a number (at least 1) when the sheet is saved. */
  maxHitPoints: z.string(),
  notes: z.string(),
  color: z.string().optional(),
  image: z.custom<ImageUrlValue>(),
  inventory: z.custom<ItemDraft[]>(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  mode: "create" | "edit";
  /** The sheet being edited — a finished one, or a draft being resumed. */
  character?: WithId<StandardCharacter> | WithId<StandardCharacterDraft>;
  /** Where to go once the sheet is saved (default: the character list). */
  returnTo?: string;
}

export function StandardCharacterForm({ mode, character, returnTo }: Props) {
  const { t } = useTranslation("characters", { keyPrefix: "standardForm" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: character?.name ?? "",
      maxHitPoints: String(character?.maxHitPoints ?? 10),
      notes: character?.notes ?? "",
      color: character?.color,
      image: { imageUrl: character?.imageUrl, imageCrop: character?.imageCrop },
      inventory: (character?.inventory ?? []).map(toItemDraft),
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const gearCatalog = useGearCatalog();
  // A draft has never been playable, so the wording stays that of a creation.
  const editingDraft = Boolean(character && isCharacterDraft(character));
  const creating = mode === "create" || editingDraft;

  async function onSubmit(values: FormValues) {
    if (!user) return;
    const hp = Math.max(1, Math.round(Number(values.maxHitPoints) || 0));
    const input: StandardCharacterInput = {
      system: "standard",
      name: values.name,
      maxHitPoints: hp,
      inventory: cleanItems(values.inventory),
      notes: values.notes.trim() || undefined,
      color: values.color || undefined,
      imageUrl: values.image.imageUrl,
      imageCrop: values.image.imageCrop,
    };
    setSubmitting(true);
    try {
      if (character) {
        // Also the promotion path: `updateCharacter` stamps `status: "ready"`.
        await updateCharacter(character.id, input);
        toast.success(editingDraft ? t("created") : t("updated"));
      } else {
        await createCharacter(input, user.uid);
        toast.success(t("created"));
      }
      navigate(returnTo ?? "/characters", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error(t("saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  /** Save whatever is filled in, without the "Nom requis" check. */
  async function onSaveDraft() {
    if (!user) return;
    const state = form.getValues();
    const hp = Math.round(Number(state.maxHitPoints));
    const input: StandardCharacterDraftInput = {
      system: "standard",
      name: state.name.trim(),
      maxHitPoints: Number.isFinite(hp) && hp > 0 ? hp : undefined,
      inventory: cleanItems(state.inventory),
      notes: state.notes.trim() || undefined,
      color: state.color || undefined,
      imageUrl: state.image.imageUrl,
      imageCrop: state.image.imageCrop,
    };
    setSavingDraft(true);
    try {
      if (character) {
        await updateCharacterDraft(character.id, input);
      } else {
        const id = await createCharacterDraft(input, user.uid);
        navigate(`/characters/${id}/edit`, { replace: true });
      }
      toast.success(t("draftSaved"));
    } catch (err) {
      console.error(err);
      toast.error(t("saveFailed"));
    } finally {
      setSavingDraft(false);
    }
  }

  if (!user) return null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {creating ? t("newTitle") : t("editTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("intro")}</p>
        </div>

        <CollapsibleCard
          title={t("identity")}
          storageKey="std-form-identity"
          contentClassName="grid gap-4 sm:grid-cols-2"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t("name")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("namePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxHitPoints"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("maxHp")}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("color")}</FormLabel>
                <ColorField value={field.value} onChange={field.onChange} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <div className="sm:col-span-2">
                <ImageUrlField
                  value={field.value}
                  onChange={field.onChange}
                  label={t("image")}
                  placeholder={t("imagePlaceholder")}
                />
              </div>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t("notes")}</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder={t("notesPlaceholder")} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </CollapsibleCard>

        <CollapsibleCard title={t("inventory")} storageKey="std-form-inventory">
          <FormField
            control={form.control}
            name="inventory"
            render={({ field }) => (
              <ItemListEditor
                items={field.value}
                onChange={field.onChange}
                addLabel={t("addItem")}
                dialogTitle={t("newItem")}
                namePlaceholder={t("itemPlaceholder")}
                kind="gear"
                catalog={(gearCatalog ?? []).map((def) => ({
                  id: def.id,
                  name: def.name,
                  hint: formatCoinPrice(def.priceCp),
                  group: def.group ?? t("gear"),
                }))}
                buildCatalogDraft={(id) => {
                  const def = findById(gearCatalog, id);
                  return def ? draftFromGearDef(def) : undefined;
                }}
              />
            )}
          />
        </CollapsibleCard>

        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? t("saving") : creating ? t("create") : t("save")}
          </Button>
          {/* Only while the sheet is being created. On a finished character this
            button would send it back to `status: "draft"` — dropping it out of
            its campaigns and sessions, with a stale derived block. */}
          {creating && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled={savingDraft || submitting}
              onClick={onSaveDraft}
            >
              {savingDraft ? t("saving") : t("saveDraft")}
            </Button>
          )}
          <Button type="button" size="lg" variant="ghost" onClick={() => navigate("/characters")}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
