import { MapPinIcon, SwordsIcon } from "lucide-react";
import { toast } from "sonner";
import type { AdventureEnemy, AdventureLocation } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { EnemyEditor, type EnemyEntry } from "@/components/adventure/enemy-editor";
import { enemyFormToInput as toEnemyInput, enemyToForm } from "@/components/adventure/enemy-form";
import { addEnemy, deleteEnemy, updateEnemy } from "@/lib/adventures";
import type { WithId } from "@/lib/collections";

interface Props {
  campaignId: string;
  adventureId: string;
  isGm: boolean;
  enemies: WithId<AdventureEnemy>[];
  locations: WithId<AdventureLocation>[];
  onChange: () => void | Promise<void>;
}

export function EnemiesCard({
  campaignId,
  adventureId,
  isGm,
  enemies,
  locations,
  onChange,
}: Props) {
  const { t } = useTranslation(["adventures", "common"]);
  const locationName = (locationId?: string) =>
    locations.find((loc) => loc.id === locationId)?.name;

  const title = (
    <span className="flex items-center gap-2">
      <SwordsIcon className="size-4" /> {t("enemies.title")}
    </span>
  );
  const summary = enemies.length > 0 ? enemies.map((e) => e.name).join(" · ") : t("enemies.none");
  const action =
    enemies.length > 0 ? <Badge variant="secondary">{enemies.length}</Badge> : undefined;

  if (!isGm) {
    return (
      <CollapsibleCard title={title} storageKey="adv-enemies" summary={summary} action={action}>
        {enemies.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("enemies.none")}</p>
        )}
        <div className="flex flex-col gap-2">
          {enemies.map((enemy) => (
            <div
              key={enemy.id}
              className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
            >
              <span className="min-w-0 flex-1 font-medium">{enemy.name}</span>
              <Badge variant="secondary">
                {t("common:stats.hp", { value: enemy.maxHitPoints })}
              </Badge>
              <Badge variant="outline">{t("common:stats.ac", { value: enemy.armorClass })}</Badge>
              {locationName(enemy.locationId) && (
                <Badge variant="outline" className="gap-1">
                  <MapPinIcon className="size-3" /> {locationName(enemy.locationId)}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CollapsibleCard>
    );
  }

  const items: EnemyEntry[] = enemies.map((e) => ({ key: e.id, ...enemyToForm(e) }));
  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }));

  return (
    <CollapsibleCard
      title={title}
      description={t("enemies.intro")}
      storageKey="adv-enemies"
      summary={summary}
      action={action}
    >
      <EnemyEditor
        items={items}
        locationOptions={locationOptions}
        onAdd={async (v) => {
          await addEnemy(campaignId, adventureId, toEnemyInput(v));
          await onChange();
        }}
        onUpdate={async (key, v) => {
          await updateEnemy(campaignId, adventureId, key, toEnemyInput(v));
          await onChange();
        }}
        onRemove={async (key) => {
          try {
            await deleteEnemy(campaignId, adventureId, key);
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
