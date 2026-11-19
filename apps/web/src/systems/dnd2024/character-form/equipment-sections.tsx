import {
  weaponMasteryCount,
  type CharacterDerived,
  formatDistance,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { ItemListEditor } from "@/components/character/item-list-editor";
import { WeaponMasteryPicker } from "@/systems/dnd2024/components/weapon-mastery-picker";
import { ToolProficiencyList } from "@/systems/dnd2024/components/tool-proficiency-list";
import { FieldError, MoneyField } from "@/systems/dnd2024/character-form/fields";
import { sectionHasError } from "@/systems/dnd2024/character-form/errors";
import type { FormErrors, FormState, SetForm } from "@/systems/dnd2024/character-form/state";
import {
  draftFromArmorDef,
  draftFromGearDef,
  draftFromToolDef,
  draftFromWeaponDef,
  itemListSummary,
} from "@/systems/dnd2024/lib/items";
import {
  armorItemBadges,
  armorTrainingWarning,
  weaponTrainingWarning,
  signedModifier,
  toolItemBadges,
  toolUsage,
  weaponItemBadges,
} from "@/systems/dnd2024/lib/equipment-format";
import {
  findById,
  useArmorCatalog,
  useGearCatalog,
  useToolCatalog,
  useWeaponCatalog,
} from "@/systems/dnd2024/lib/equipment";
import {
  armorOptions,
  gearOptions,
  toolOptions,
  weaponOptions,
} from "@/systems/dnd2024/lib/equipment-catalog";
import { COINS, formatPurse } from "@/systems/dnd2024/lib/money";

interface SectionProps {
  state: FormState;
  errors: FormErrors;
  set: SetForm;
  derived: CharacterDerived | null;
}

// --- Weapons & armour ------------------------------------------------

export function WeaponsArmorSection({ state, errors, set, derived }: SectionProps) {
  const { t } = useTranslation("characters", { keyPrefix: "equipment" });
  const weaponCatalog = useWeaponCatalog();
  const armorCatalog = useArmorCatalog();

  const masterySlots = state.classId ? weaponMasteryCount(state.classId, state.level) : 0;
  return (
    <CollapsibleCard
      title={t("weaponsArmor")}
      summary={
        <div className="truncate">
          {itemListSummary([...state.weapons, ...state.armors], t("noWeaponArmor"))}
        </div>
      }
      storageKey="form-weapons"
      invalid={sectionHasError(errors, "weapons")}
      contentClassName="flex flex-col gap-6"
    >
      <ItemListEditor
        label={t("weapons")}
        description={t("weaponsHint")}
        items={state.weapons}
        onChange={(items) => set("weapons", items)}
        addLabel={t("addWeapon")}
        dialogTitle={t("newWeapon")}
        namePlaceholder={t("weaponPlaceholder")}
        kind="weapon"
        catalog={weaponOptions(weaponCatalog)}
        buildCatalogDraft={(id) => {
          const def = findById(weaponCatalog, id);
          return def ? draftFromWeaponDef(def) : undefined;
        }}
        itemBadges={(item) => weaponItemBadges(item, masterySlots > 0)}
        itemWarning={(item) => weaponTrainingWarning(item, state.classId)}
        allowWeaponMastery={masterySlots > 0}
      />

      {masterySlots > 0 && (
        <WeaponMasteryPicker
          classId={state.classId}
          level={state.level}
          weapons={state.weapons}
          value={state.weaponMasteries}
          onChange={(ids) => set("weaponMasteries", ids)}
        />
      )}

      <FieldError>{errors.weaponMasteries}</FieldError>

      <ItemListEditor
        label={t("armors")}
        description={t("armorsHint")}
        items={state.armors}
        onChange={(items) => set("armors", items)}
        addLabel={t("addArmor")}
        dialogTitle={t("newArmor")}
        namePlaceholder={t("armorPlaceholder")}
        kind="armor"
        catalog={armorOptions(armorCatalog)}
        buildCatalogDraft={(id) => {
          const def = findById(armorCatalog, id);
          return def ? draftFromArmorDef(def) : undefined;
        }}
        itemBadges={(item) => armorItemBadges(item)}
        itemWarning={(item) => armorTrainingWarning(item, state.classId)}
        withEquipped
      />

      {derived && (
        <p className="text-muted-foreground text-sm">
          {t("currentAc")} <span className="text-foreground font-medium">{derived.armorClass}</span>{" "}
          · {t("speed", { speed: formatDistance(derived.speed) })}
          {!derived.armorProficient && (
            <span className="text-destructive">{t("armorNotProficient")}</span>
          )}
        </p>
      )}
    </CollapsibleCard>
  );
}

// --- Tools ---------------------------------------------------------------

export function ToolsSection({ state, errors, set, derived }: SectionProps) {
  const { t } = useTranslation("characters", { keyPrefix: "equipment" });
  const toolCatalog = useToolCatalog();

  return (
    <CollapsibleCard
      title={t("tools")}
      summary={<div className="truncate">{itemListSummary(state.tools, t("noTool"))}</div>}
      storageKey="form-tools"
      invalid={sectionHasError(errors, "tools")}
      contentClassName="flex flex-col gap-6"
    >
      <ToolProficiencyList
        classId={state.classId}
        backgroundId={state.backgroundId}
        value={state.toolProficiencies}
        onChange={(value) => set("toolProficiencies", value)}
        expertise={state.toolExpertise}
        onExpertiseChange={(value) => set("toolExpertise", value)}
      />
      <FieldError>{errors.toolProficiencies}</FieldError>

      <ItemListEditor
        label={t("ownedTools")}
        description={t("ownedToolsHint")}
        items={state.tools}
        onChange={(items) => set("tools", items)}
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

      {state.tools.some((tool) => toolUsage(tool)) && (
        <dl className="grid gap-1 text-sm">
          {state.tools
            .filter((tool) => toolUsage(tool))
            .map((tool) => {
              const mod =
                derived && tool.catalogId && tool.catalogId in derived.toolCheckModifiers
                  ? derived.toolCheckModifiers[tool.catalogId]
                  : undefined;
              return (
                <div key={tool.id}>
                  <dt className="flex justify-between font-medium">
                    <span>{tool.name}</span>
                    {mod !== undefined && (
                      <span className="tabular-nums">{signedModifier(mod)}</span>
                    )}
                  </dt>
                  <dd className="text-muted-foreground text-xs">{toolUsage(tool)}</dd>
                </div>
              );
            })}
        </dl>
      )}
    </CollapsibleCard>
  );
}

// --- Inventory & money -------------------------------------------------

export function InventoryMoneySection({ state, set }: SectionProps) {
  const { t } = useTranslation("characters", { keyPrefix: "equipment" });
  const gearCatalog = useGearCatalog();

  const summary = (
    <div className="grid gap-0.5">
      <div className="truncate">{formatPurse(state.money)}</div>
      <div className="truncate">{itemListSummary(state.inventory, t("emptyInventory"))}</div>
    </div>
  );

  return (
    <CollapsibleCard
      title={t("inventoryMoney")}
      summary={summary}
      storageKey="form-inventory"
      contentClassName="flex flex-col gap-6"
    >
      <ItemListEditor
        label={t("inventory")}
        description={t("inventoryHint")}
        items={state.inventory}
        onChange={(items) => set("inventory", items)}
        addLabel={t("addItem")}
        dialogTitle={t("newItem")}
        namePlaceholder={t("itemPlaceholder")}
        kind="gear"
        catalog={gearOptions(gearCatalog)}
        buildCatalogDraft={(id) => {
          const def = findById(gearCatalog, id);
          return def ? draftFromGearDef(def) : undefined;
        }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {COINS.map(({ key, label }) => (
          <MoneyField
            key={key}
            label={label}
            value={state.money[key]}
            onChange={(value) => set("money", { ...state.money, [key]: value })}
          />
        ))}
      </div>
    </CollapsibleCard>
  );
}
