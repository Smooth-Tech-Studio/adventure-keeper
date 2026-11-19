import { useState } from "react";
import { EyeOffIcon, ImageIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { EntityRow } from "@/components/adventure/entity-row";
import { LocationFormDialog } from "@/components/adventure/location-form-dialog";
import { emptyLocationForm, type LocationFormValues } from "@/components/adventure/location-form";

export type LocationEntry = LocationFormValues & { key: string };

interface Props {
  items: LocationEntry[];
  onAdd: (values: LocationFormValues) => void | Promise<void>;
  onUpdate: (key: string, values: LocationFormValues) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
}

/**
 * List + add/edit popup for adventure locations. Persistence-agnostic: the
 * creation form wires the callbacks to in-memory state, the detail page wires
 * them to Firestore.
 */
export function LocationEditor({ items, onAdd, onUpdate, onRemove }: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const [editing, setEditing] = useState<{ mode: "add" } | { mode: "edit"; key: string } | null>(
    null,
  );

  const initial =
    editing?.mode === "edit"
      ? (items.find((i) => i.key === editing.key) ?? emptyLocationForm())
      : emptyLocationForm();

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="text-muted-foreground text-sm">{t("locations.none")}</p>}
      {items.map((item) => (
        <EntityRow
          key={item.key}
          name={item.name || t("common:untitled")}
          badges={[
            item.hidden && (
              <>
                <EyeOffIcon className="size-3" /> {t("locations.hidden")}
              </>
            ),
            item.imageUrl.trim() && (
              <>
                <ImageIcon className="size-3" /> {t("locations.image")}
              </>
            ),
          ].filter(Boolean)}
          detail={item.description.trim() || undefined}
          onEdit={() => setEditing({ mode: "edit", key: item.key })}
          onDelete={() => onRemove(item.key)}
          deleteLabel={t("locations.deleteWhat")}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setEditing({ mode: "add" })}
      >
        <PlusIcon /> {t("locations.add")}
      </Button>

      <LocationFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={initial}
        onSave={async (values) => {
          if (editing?.mode === "edit") await onUpdate(editing.key, values);
          else await onAdd(values);
        }}
      />
    </div>
  );
}
