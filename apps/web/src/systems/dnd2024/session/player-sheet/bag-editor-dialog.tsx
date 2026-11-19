import { useMemo } from "react";
import type { Dnd2024Character } from "@adventure-keeper/schemas";
import { weaponMasteryCount } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemListEditor } from "@/components/character/item-list-editor";
import {
  armorOptions,
  gearOptions,
  toolOptions,
  weaponOptions,
} from "@/systems/dnd2024/lib/equipment-catalog";
import {
  findById,
  useArmorCatalog,
  useGearCatalog,
  useToolCatalog,
  useWeaponCatalog,
} from "@/systems/dnd2024/lib/equipment";
import {
  armorItemBadges,
  toolItemBadges,
  weaponItemBadges,
} from "@/systems/dnd2024/lib/equipment-format";
import {
  cleanItems,
  draftFromArmorDef,
  draftFromGearDef,
  draftFromToolDef,
  draftFromWeaponDef,
  normalizeItems,
  toItemDraft,
} from "@/systems/dnd2024/lib/items";
import type { CharacterItemsPatch, WithId } from "@/lib/collections";
import { tr } from "@/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: WithId<Dnd2024Character>;
  onCharacterItemsChange: (patch: CharacterItemsPatch) => void;
}

/** The full character-sheet bag editor, in a dialog, for use during a session. */
export function BagEditorDialog({ open, onOpenChange, character, onCharacterItemsChange }: Props) {
  const { t } = useTranslation("characters", { keyPrefix: "equipment" });
  const weaponCatalog = useWeaponCatalog();
  const armorCatalog = useArmorCatalog();
  const toolCatalog = useToolCatalog();
  const gearCatalog = useGearCatalog();

  const weapons = useMemo(
    () => normalizeItems(character.weapons).map(toItemDraft),
    [character.weapons],
  );
  const armors = useMemo(
    () => normalizeItems(character.armors).map(toItemDraft),
    [character.armors],
  );
  const tools = useMemo(() => normalizeItems(character.tools).map(toItemDraft), [character.tools]);
  const inventory = useMemo(
    () => normalizeItems(character.inventory).map(toItemDraft),
    [character.inventory],
  );

  const hasWeaponMastery = weaponMasteryCount(character.classId, character.level ?? 1) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] grid-cols-1 overflow-x-hidden overflow-y-auto p-4 sm:max-w-3xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{tr("session:sheet.bag.editTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6">
          <ItemListEditor
            label={t("weapons")}
            items={weapons}
            onChange={(items) => onCharacterItemsChange({ weapons: cleanItems(items) })}
            addLabel={t("addWeapon")}
            dialogTitle={t("newWeapon")}
            namePlaceholder={t("weaponPlaceholder")}
            kind="weapon"
            catalog={weaponOptions(weaponCatalog)}
            buildCatalogDraft={(id) => {
              const def = findById(weaponCatalog, id);
              return def ? draftFromWeaponDef(def) : undefined;
            }}
            itemBadges={(item) => weaponItemBadges(item, hasWeaponMastery)}
            allowWeaponMastery={hasWeaponMastery}
          />

          <ItemListEditor
            label={t("armors")}
            items={armors}
            onChange={(items) => onCharacterItemsChange({ armors: cleanItems(items) })}
            addLabel={t("addArmor")}
            dialogTitle={t("newArmor")}
            namePlaceholder={t("armorPlaceholder")}
            kind="armor"
            catalog={armorOptions(armorCatalog)}
            buildCatalogDraft={(id) => {
              const def = findById(armorCatalog, id);
              return def ? draftFromArmorDef(def) : undefined;
            }}
            itemBadges={armorItemBadges}
            withEquipped
          />

          <ItemListEditor
            label={t("tools")}
            items={tools}
            onChange={(items) => onCharacterItemsChange({ tools: cleanItems(items) })}
            addLabel={t("addTool")}
            dialogTitle={t("newTool")}
            namePlaceholder={t("toolPlaceholder")}
            kind="tool"
            catalog={toolOptions(toolCatalog)}
            buildCatalogDraft={(id) => {
              const def = findById(toolCatalog, id);
              return def ? draftFromToolDef(def) : undefined;
            }}
            itemBadges={toolItemBadges}
          />

          <ItemListEditor
            label={t("inventory")}
            items={inventory}
            onChange={(items) => onCharacterItemsChange({ inventory: cleanItems(items) })}
            addLabel={t("addItem")}
            dialogTitle={t("newItem")}
            namePlaceholder={t("itemPlaceholder")}
            kind="gear"
            inlineQuantity
            catalog={gearOptions(gearCatalog)}
            buildCatalogDraft={(id) => {
              const def = findById(gearCatalog, id);
              return def ? draftFromGearDef(def) : undefined;
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
