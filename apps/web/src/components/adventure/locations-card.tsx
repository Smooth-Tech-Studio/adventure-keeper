import { MapPinIcon } from "lucide-react";
import { toast } from "sonner";
import type { AdventureLocation } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { LocationEditor, type LocationEntry } from "@/components/adventure/location-editor";
import { draftToLoot } from "@/lib/planned-loot";
import { locationToForm } from "@/components/adventure/location-form";
import { addLocation, deleteLocation, updateLocation } from "@/lib/adventures";
import type { WithId } from "@/lib/collections";
import { playerLocationView } from "@/lib/location-player-view";

interface Props {
  campaignId: string;
  adventureId: string;
  isGm: boolean;
  locations: WithId<AdventureLocation>[];
  onChange: () => void | Promise<void>;
}

export function LocationsCard({ campaignId, adventureId, isGm, locations, onChange }: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const title = (
    <span className="flex items-center gap-2">
      <MapPinIcon className="size-4" /> {t("locations.title")}
    </span>
  );
  const summary =
    locations.length > 0 ? locations.map((l) => l.name).join(" · ") : t("locations.none");
  const action =
    locations.length > 0 ? <Badge variant="secondary">{locations.length}</Badge> : undefined;

  if (!isGm) {
    return (
      <CollapsibleCard title={title} storageKey="adv-locations" summary={summary} action={action}>
        {locations.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("locations.none")}</p>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {locations.map(playerLocationView).map((location) => (
            <li key={location.id} className="overflow-hidden rounded-md border">
              {location.imageUrl && (
                <img
                  src={location.imageUrl}
                  alt=""
                  className="h-28 w-full object-cover"
                  onError={(event) => (event.currentTarget.style.display = "none")}
                />
              )}
              <div className="p-2 text-sm">
                <span className="font-medium">{location.name}</span>
              </div>
            </li>
          ))}
        </ul>
      </CollapsibleCard>
    );
  }

  const items: LocationEntry[] = locations.map((l) => ({ key: l.id, ...locationToForm(l) }));

  return (
    <CollapsibleCard
      title={title}
      description={t("locations.intro")}
      storageKey="adv-locations"
      summary={summary}
      action={action}
    >
      <LocationEditor
        items={items}
        onAdd={async (v) => {
          await addLocation(campaignId, adventureId, {
            name: v.name,
            description: v.description,
            imageUrl: v.imageUrl,
            hidden: v.hidden,
            scale: v.scale,
            loot: draftToLoot(v.loot),
          });
          await onChange();
        }}
        onUpdate={async (key, v) => {
          await updateLocation(campaignId, adventureId, key, { ...v, loot: draftToLoot(v.loot) });
          await onChange();
        }}
        onRemove={async (key) => {
          try {
            await deleteLocation(campaignId, adventureId, key);
            await onChange();
          } catch (error) {
            console.error(error);
            toast.error(t("common:deleteFailed"));
          }
        }}
      />
    </CollapsibleCard>
  );
}
