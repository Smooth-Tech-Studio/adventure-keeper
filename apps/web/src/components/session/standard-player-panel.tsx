import { useRef, useState } from "react";
import type { AdventureParticipant, Item, StandardCharacter } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { initials } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CropIcon } from "@/components/character/crop-icon";
import { DiceRollerBlock } from "@/components/session/dice-roller-block";
import { HpControl } from "@/components/session/hp-control";
import { ItemListEditor, type ItemListEditorHandle } from "@/components/character/item-list-editor";
import { useDebouncedNotes } from "@/hooks/use-debounced-notes";
import { cleanItems, normalizeItems, toItemDraft } from "@/systems/dnd2024/lib/items";
import type { CharacterItemsPatch, WithId } from "@/lib/collections";

interface Props {
  character: WithId<StandardCharacter>;
  participant: AdventureParticipant;
  currentHitPoints: number;
  maxHitPoints: number;
  onHitPointsChange: (value: number) => void;
  onNotesChange: (value: string) => void;
  /** Patch the character sheet's own inventory (owner-only write). */
  onCharacterItemsChange: (patch: CharacterItemsPatch) => void;
}

/** Right-hand panel for a "standard" (system-agnostic) character in a session. */
export function StandardPlayerPanel({
  character,
  participant,
  currentHitPoints,
  maxHitPoints,
  onHitPointsChange,
  onNotesChange,
  onCharacterItemsChange,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "standard" });
  const [showInventory, setShowInventory] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const inventoryEditor = useRef<ItemListEditorHandle>(null);
  const [notes, editNotes] = useDebouncedNotes(participant.notes ?? "", onNotesChange);

  const inventory = normalizeItems(character.inventory);
  const setInventory = (items: Item[]) => onCharacterItemsChange({ inventory: items });

  return (
    <ScrollArea className="@container min-h-0">
      <div className="flex flex-col gap-3 pr-3 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] @3xl:items-start">
        <Card className="flex min-h-0 flex-col overflow-hidden max-lg:min-h-[20rem]">
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
            <CropIcon
              imageUrl={character.imageUrl}
              crop={character.imageCrop}
              color={character.color}
              fallback={initials(character.name)}
              size={32}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{character.name}</p>
              <p className="text-muted-foreground text-xs">{t("subtitle")}</p>
            </div>
          </div>

          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-1 pb-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <HpControl
                current={currentHitPoints}
                max={maxHitPoints}
                onChange={onHitPointsChange}
              />
            </div>

            <CollapsibleSection
              open={showInventory}
              onToggle={() => setShowInventory((v) => !v)}
              label={t("inventory")}
              onAdd={() => {
                setShowInventory(true);
                inventoryEditor.current?.openAdd();
              }}
            >
              <div className="pt-1">
                <ItemListEditor
                  items={inventory.map(toItemDraft)}
                  onChange={(drafts) => setInventory(cleanItems(drafts))}
                  addLabel={t("addItem")}
                  dialogTitle={t("newItem")}
                  namePlaceholder={t("item")}
                  ref={inventoryEditor}
                  inlineQuantity
                  externalAdd
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              open={showNotes}
              onToggle={() => setShowNotes((v) => !v)}
              label={t("notes")}
            >
              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => editNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="mt-1 text-xs"
              />
            </CollapsibleSection>
          </CardContent>
        </Card>

        <DiceRollerBlock className="shrink-0" />
      </div>
    </ScrollArea>
  );
}
