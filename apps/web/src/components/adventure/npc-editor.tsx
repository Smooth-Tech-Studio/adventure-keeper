import { useState, type ReactNode } from "react";
import { MapPinIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { EntityRow } from "@/components/adventure/entity-row";
import { NpcFormDialog } from "@/components/adventure/npc-form-dialog";
import { emptyNpcForm, type NpcFormValues } from "@/components/adventure/npc-form";
import type { LocationOption } from "@/components/adventure/location-link-select";

export type NpcEntry = NpcFormValues & { key: string };

interface Props {
  items: NpcEntry[];
  locationOptions: LocationOption[];
  /** Enemy profiles an NPC may fight with (detail page only). */
  enemyOptions?: { id: string; name: string }[];
  onAdd: (values: NpcFormValues) => void | Promise<void>;
  onUpdate: (key: string, values: NpcFormValues) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
  /** Extra row buttons for a saved NPC (detail page only). */
  rowExtra?: (key: string) => ReactNode;
}

/** List + add/edit popup for adventure NPCs. Persistence-agnostic. */
export function NpcEditor({
  items,
  locationOptions,
  enemyOptions,
  onAdd,
  onUpdate,
  onRemove,
  rowExtra,
}: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const [editing, setEditing] = useState<{ mode: "add" } | { mode: "edit"; key: string } | null>(
    null,
  );

  const initial =
    editing?.mode === "edit"
      ? (items.find((i) => i.key === editing.key) ?? emptyNpcForm())
      : emptyNpcForm();

  const locationName = (id: string) => locationOptions.find((o) => o.id === id)?.name;

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="text-muted-foreground text-sm">{t("npcs.none")}</p>}
      {items.map((item) => {
        const locName = locationName(item.locationId);
        return (
          <EntityRow
            key={item.key}
            name={item.name || t("common:untitled")}
            badges={[
              item.personality.trim() || undefined,
              locName && (
                <>
                  <MapPinIcon className="size-3" /> {locName}
                </>
              ),
            ].filter(Boolean)}
            detail={item.lore.trim() || undefined}
            onEdit={() => setEditing({ mode: "edit", key: item.key })}
            onDelete={() => onRemove(item.key)}
            deleteLabel={t("npcs.deleteWhat")}
            extra={rowExtra?.(item.key)}
          />
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setEditing({ mode: "add" })}
      >
        <PlusIcon /> {t("npcs.add")}
      </Button>

      <NpcFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={initial}
        locationOptions={locationOptions}
        enemyOptions={enemyOptions}
        onSave={async (values) => {
          if (editing?.mode === "edit") await onUpdate(editing.key, values);
          else await onAdd(values);
        }}
      />
    </div>
  );
}
