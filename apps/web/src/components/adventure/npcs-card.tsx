import { BookPlusIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import type { AdventureEnemy, AdventureLocation, AdventureNpc } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { NpcEditor, type NpcEntry } from "@/components/adventure/npc-editor";
import { npcToForm } from "@/components/adventure/npc-form";
import { addNpc, deleteNpc, updateNpc } from "@/lib/adventures";
import { addNpcToCodex } from "@/lib/codex";
import type { WithId } from "@/lib/collections";

interface Props {
  campaignId: string;
  adventureId: string;
  isGm: boolean;
  npcs: WithId<AdventureNpc>[];
  locations: WithId<AdventureLocation>[];
  /** Profiles an NPC may fight with, as an ally. */
  enemies: WithId<AdventureEnemy>[];
  onChange: () => void | Promise<void>;
}

export function NpcsCard({
  campaignId,
  adventureId,
  isGm,
  npcs,
  locations,
  enemies,
  onChange,
}: Props) {
  const { t } = useTranslation(["adventures", "common", "codex"]);
  const locationName = (locationId?: string) =>
    locations.find((loc) => loc.id === locationId)?.name;

  const title = (
    <span className="flex items-center gap-2">
      <UsersIcon className="size-4" /> {t("npcs.title")}
    </span>
  );
  const summary = npcs.length > 0 ? npcs.map((n) => n.name).join(" · ") : t("npcs.none");
  const action = npcs.length > 0 ? <Badge variant="secondary">{npcs.length}</Badge> : undefined;

  if (!isGm) {
    return (
      <CollapsibleCard title={title} storageKey="adv-npcs" summary={summary} action={action}>
        {npcs.length === 0 && <p className="text-muted-foreground text-sm">{t("npcs.none")}</p>}
        <ul className="flex flex-col gap-2">
          {npcs.map((npc) => (
            <li key={npc.id} className="bg-muted/30 grid gap-1 rounded-md border p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-medium">{npc.name}</span>
                {locationName(npc.locationId) && (
                  <Badge variant="outline" className="gap-1">
                    <MapPinIcon className="size-3" /> {locationName(npc.locationId)}
                  </Badge>
                )}
              </div>
              {npc.personality && (
                <p className="text-muted-foreground text-xs">
                  {t("npcs.personalityLine", { value: npc.personality })}
                </p>
              )}
              {npc.lore && (
                <p className="text-muted-foreground text-xs whitespace-pre-wrap">{npc.lore}</p>
              )}
            </li>
          ))}
        </ul>
      </CollapsibleCard>
    );
  }

  const items: NpcEntry[] = npcs.map((n) => ({ key: n.id, ...npcToForm(n) }));
  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }));

  return (
    <CollapsibleCard
      title={title}
      description={t("npcs.intro")}
      storageKey="adv-npcs"
      summary={summary}
      action={action}
    >
      <NpcEditor
        items={items}
        locationOptions={locationOptions}
        enemyOptions={enemies.map((e) => ({ id: e.id, name: e.name }))}
        onAdd={async (v) => {
          await addNpc(campaignId, adventureId, {
            name: v.name,
            personality: v.personality,
            lore: v.lore,
            locationId: v.locationId || undefined,
            enemyId: v.enemyId || undefined,
          });
          await onChange();
        }}
        onUpdate={async (key, v) => {
          await updateNpc(campaignId, adventureId, key, {
            name: v.name,
            personality: v.personality,
            lore: v.lore,
            locationId: v.locationId || undefined,
            enemyId: v.enemyId || undefined,
          });
          await onChange();
        }}
        rowExtra={(key) => {
          const npc = npcs.find((n) => n.id === key);
          return (
            npc && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`${t("codex:session.addNpc")} — ${npc.name}`}
                title={t("codex:session.addNpc")}
                onClick={async () => {
                  try {
                    const { created } = await addNpcToCodex(campaignId, adventureId, npc);
                    toast.success(
                      t(created ? "codex:session.npcAdded" : "codex:session.npcExists", {
                        name: npc.name,
                      }),
                    );
                  } catch (error) {
                    console.error(error);
                    toast.error(t("common:saveFailed"));
                  }
                }}
              >
                <BookPlusIcon className="size-4" />
              </Button>
            )
          );
        }}
        onRemove={async (key) => {
          try {
            await deleteNpc(campaignId, adventureId, key);
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
