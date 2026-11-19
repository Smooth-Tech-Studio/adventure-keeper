import { useState } from "react";
import { MapPinIcon, PlusIcon } from "lucide-react";
import { CREATURE_SIZE_ABBR } from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { EntityRow } from "@/components/adventure/entity-row";
import { EnemyFormDialog } from "@/components/adventure/enemy-form-dialog";
import { emptyEnemyForm, type EnemyFormValues } from "@/components/adventure/enemy-form";
import type { LocationOption } from "@/components/adventure/location-link-select";

export type EnemyEntry = EnemyFormValues & { key: string };

interface Props {
  items: EnemyEntry[];
  locationOptions: LocationOption[];
  onAdd: (values: EnemyFormValues) => void | Promise<void>;
  onUpdate: (key: string, values: EnemyFormValues) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
}

/** List + add/edit popup for adventure enemy types. Persistence-agnostic. */
export function EnemyEditor({ items, locationOptions, onAdd, onUpdate, onRemove }: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const [editing, setEditing] = useState<{ mode: "add" } | { mode: "edit"; key: string } | null>(
    null,
  );

  const initial =
    editing?.mode === "edit"
      ? (items.find((i) => i.key === editing.key) ?? emptyEnemyForm())
      : emptyEnemyForm();

  const locationName = (id: string) => locationOptions.find((o) => o.id === id)?.name;

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="text-muted-foreground text-sm">{t("enemies.none")}</p>}
      {items.map((item) => {
        const locName = locationName(item.locationId);
        return (
          <EntityRow
            key={item.key}
            name={item.name || t("common:untitled")}
            badges={[
              t("common:stats.hp", { value: item.maxHitPoints }),
              t("common:stats.ac", { value: item.armorClass }),
              item.size && CREATURE_SIZE_ABBR[item.size],
              item.challengeRating && t("common:stats.cr", { value: item.challengeRating }),
              item.attacks.length > 0 && t("common:stats.attacks", { count: item.attacks.length }),
              locName && (
                <>
                  <MapPinIcon className="size-3" /> {locName}
                </>
              ),
            ].filter(Boolean)}
            onEdit={() => setEditing({ mode: "edit", key: item.key })}
            onDelete={() => onRemove(item.key)}
            deleteLabel={t("enemies.deleteWhat")}
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
        <PlusIcon /> {t("enemies.add")}
      </Button>

      <EnemyFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={initial}
        locationOptions={locationOptions}
        onSave={async (values) => {
          if (editing?.mode === "edit") await onUpdate(editing.key, values);
          else await onAdd(values);
        }}
      />
    </div>
  );
}
