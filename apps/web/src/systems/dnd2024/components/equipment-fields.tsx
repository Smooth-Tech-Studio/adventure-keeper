import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  ABILITIES,
  ABILITY_LABELS,
  ARMOR_CATEGORIES,
  ARMOR_CATEGORY_LABELS,
  COIN_ABBR,
  DAMAGE_TYPE_LABELS,
  DAMAGE_TYPES,
  feetToMetres,
  metresToFeet,
  TOOL_CATEGORIES,
  TOOL_CATEGORY_LABELS,
  WEAPON_CATEGORIES,
  WEAPON_CATEGORY_LABELS,
  WEAPON_MASTERIES,
  WEAPON_MASTERY_LABELS,
  WEAPON_PROPERTIES,
  WEAPON_PROPERTY_DESCRIPTIONS,
  WEAPON_PROPERTY_LABELS,
  type Ability,
  type ArmorProps,
  type ToolProps,
  type WeaponProps,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DicePoolField } from "@/systems/dnd2024/components/dice-pool-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArmorItemProps } from "@/systems/dnd2024/lib/items";

// --- Small shared bits -------------------------------------------------

function numberOrUndef(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/** Shared price (in gold) + weight (kg) inputs. */
export function PriceWeightFields({
  priceCp,
  weightKg,
  onPriceCp,
  onWeightKg,
}: {
  priceCp?: number;
  weightKg?: number;
  onPriceCp: (value: number | undefined) => void;
  onWeightKg: (value: number | undefined) => void;
}) {
  const { t, i18n } = useTranslation("characters", { keyPrefix: "fields" });
  // Weights are stored in kilograms; English enters them in pounds (1 lb = 0.5 kg).
  const pounds = i18n.language === "en";
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t("price", { coin: COIN_ABBR.gold })}>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={priceCp === undefined ? "" : priceCp / 100}
          onChange={(event) => {
            const gold = numberOrUndef(event.target.value);
            onPriceCp(gold === undefined ? undefined : Math.max(0, Math.round(gold * 100)));
          }}
        />
      </Field>
      <Field label={pounds ? t("weightLb") : t("weightKg")}>
        <Input
          type="number"
          min={0}
          step={pounds ? "0.25" : "0.1"}
          value={weightKg === undefined ? "" : pounds ? weightKg * 2 : weightKg}
          onChange={(event) => {
            const value = numberOrUndef(event.target.value);
            onWeightKg(value === undefined || !pounds ? value : value / 2);
          }}
        />
      </Field>
    </div>
  );
}

// --- Weapon fieldset -------------------------------------------------

const RANGED_NEEDS_RANGE = new Set(["thrown", "ammunition"]);

export function WeaponFields({
  value,
  onChange,
  allowMastery = true,
}: {
  value: WeaponProps;
  onChange: (value: WeaponProps) => void;
  /** `false` for classes without a Weapon Mastery feature — hides the "botte" picker. */
  allowMastery?: boolean;
}) {
  const { t, i18n } = useTranslation("characters", { keyPrefix: "fields" });
  // Ranges are stored in metres; English enters them in feet.
  const feet = i18n.language === "en";
  const shownRange = (metres: number | undefined) =>
    metres === undefined ? "" : feet ? metresToFeet(metres) : metres;
  const storedRange = (input: string) => {
    const number = numberOrUndef(input) ?? 0;
    return feet ? feetToMetres(number) : number;
  };
  const [addingProperty, setAddingProperty] = useState(false);
  const set = (patch: Partial<WeaponProps>) => onChange({ ...value, ...patch });
  const isFocus = value.category === "focus";
  const needsRange = value.properties.some((p) => RANGED_NEEDS_RANGE.has(p));
  const isVersatile = value.properties.includes("versatile");
  const availableProperties = WEAPON_PROPERTIES.filter((p) => !value.properties.includes(p));

  function addProperty(property: WeaponProps["properties"][number]) {
    set({ properties: [...value.properties, property] });
    setAddingProperty(false);
  }

  function removeProperty(property: WeaponProps["properties"][number]) {
    set({ properties: value.properties.filter((p) => p !== property) });
  }

  return (
    <div className="grid gap-3">
      <Field label={t("category")}>
        <Select
          value={value.category}
          onValueChange={(v) => set({ category: v as WeaponProps["category"] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEAPON_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {WEAPON_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isFocus && <p className="text-muted-foreground text-xs">{t("focus")}</p>}

      {!isFocus && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("damage")}>
              <DicePoolField
                value={value.damageDice}
                onChange={(damageDice) => set({ damageDice })}
              />
            </Field>
            <Field label={t("damageType")}>
              <Select
                value={value.damageType ?? "bludgeoning"}
                onValueChange={(v) => set({ damageType: v as WeaponProps["damageType"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAMAGE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DAMAGE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={t("properties")}>
            <div className="grid gap-1.5">
              {value.properties.length === 0 && !addingProperty && (
                <p className="text-muted-foreground text-sm">{t("noProperty")}</p>
              )}

              {value.properties.map((property) => (
                <div
                  key={property}
                  className="bg-muted/30 flex items-start gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{WEAPON_PROPERTY_LABELS[property]}</span>
                    <p className="text-muted-foreground text-xs">
                      {WEAPON_PROPERTY_DESCRIPTIONS[property]}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 size-7 shrink-0"
                    aria-label={t("removeProperty", { name: WEAPON_PROPERTY_LABELS[property] })}
                    onClick={() => removeProperty(property)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              ))}

              {availableProperties.length > 0 &&
                (addingProperty ? (
                  <ul className="max-h-52 overflow-y-auto rounded-md border">
                    {availableProperties.map((property) => (
                      <li key={property}>
                        <button
                          type="button"
                          className="hover:bg-accent block w-full px-2 py-1.5 text-left text-sm"
                          onClick={() => addProperty(property)}
                        >
                          <span className="font-medium">{WEAPON_PROPERTY_LABELS[property]}</span>
                          <p className="text-muted-foreground text-xs">
                            {WEAPON_PROPERTY_DESCRIPTIONS[property]}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setAddingProperty(true)}
                  >
                    <PlusIcon /> {t("addProperty")}
                  </Button>
                ))}
            </div>
          </Field>

          {needsRange && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={feet ? t("rangeNormalFt") : t("rangeNormalM")}>
                <Input
                  type="number"
                  min={0}
                  value={shownRange(value.range?.normal)}
                  onChange={(event) =>
                    set({
                      range: {
                        normal: storedRange(event.target.value),
                        max: value.range?.max ?? 0,
                      },
                    })
                  }
                />
              </Field>
              <Field label={feet ? t("rangeLongFt") : t("rangeLongM")}>
                <Input
                  type="number"
                  min={0}
                  value={shownRange(value.range?.max)}
                  onChange={(event) =>
                    set({
                      range: {
                        normal: value.range?.normal ?? 0,
                        max: storedRange(event.target.value),
                      },
                    })
                  }
                />
              </Field>
            </div>
          )}

          {isVersatile && (
            <Field label={t("versatile")}>
              <DicePoolField
                value={value.versatileDice}
                onChange={(versatileDice) => set({ versatileDice })}
                clearable
              />
            </Field>
          )}

          {allowMastery && (
            <Field label={t("mastery")}>
              <Select
                value={value.mastery ?? "none"}
                onValueChange={(v) =>
                  set({ mastery: v === "none" ? undefined : (v as WeaponProps["mastery"]) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("none")}</SelectItem>
                  {WEAPON_MASTERIES.map((mastery) => (
                    <SelectItem key={mastery} value={mastery}>
                      {WEAPON_MASTERY_LABELS[mastery]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </>
      )}
    </div>
  );
}

// --- Armor fieldset -------------------------------------------------

export function ArmorFields({
  value,
  onChange,
}: {
  value: ArmorItemProps;
  onChange: (value: ArmorItemProps) => void;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "fields" });
  const set = (patch: Partial<ArmorItemProps>) => onChange({ ...value, ...patch });
  const isShield = value.category === "shield";

  return (
    <div className="grid gap-3">
      <Field label={t("category")}>
        <Select
          value={value.category}
          onValueChange={(v) => set({ category: v as ArmorProps["category"] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ARMOR_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {ARMOR_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {isShield ? (
          <Field label={t("acBonus")}>
            <Input
              type="number"
              value={value.acBonus ?? ""}
              onChange={(event) => set({ acBonus: numberOrUndef(event.target.value) })}
            />
          </Field>
        ) : (
          <Field label={t("baseAc")}>
            <Input
              type="number"
              value={value.baseAc ?? ""}
              onChange={(event) => set({ baseAc: numberOrUndef(event.target.value) })}
            />
          </Field>
        )}
        <Field label="Force requise">
          <Input
            type="number"
            min={0}
            value={value.strengthMin ?? ""}
            onChange={(event) => set({ strengthMin: numberOrUndef(event.target.value) })}
          />
        </Field>
      </div>

      {!isShield && (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.addsDex}
              onCheckedChange={(checked) => set({ addsDex: checked === true })}
            />
            {t("addsDex")}
          </label>
          {value.addsDex && (
            <div className="flex items-center gap-2 text-sm">
              <Label className="text-xs">{t("maxDex")}</Label>
              <Input
                type="number"
                className="h-8 w-20"
                value={value.maxDex ?? ""}
                onChange={(event) => set({ maxDex: numberOrUndef(event.target.value) })}
              />
            </div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={value.stealthDisadvantage}
          onCheckedChange={(checked) => set({ stealthDisadvantage: checked === true })}
        />
        {t("stealth")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={value.equipped}
          onCheckedChange={(checked) => set({ equipped: checked === true })}
        />
        {t("equipped")}
      </label>
    </div>
  );
}

// --- Tool fieldset -------------------------------------------------

export function ToolFields({
  value,
  onChange,
}: {
  value: ToolProps;
  onChange: (value: ToolProps) => void;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "fields" });
  const set = (patch: Partial<ToolProps>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t("toolType")}>
        <Select
          value={value.category}
          onValueChange={(v) => set({ category: v as ToolProps["category"] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOOL_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {TOOL_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("ability")}>
        <Select value={value.ability} onValueChange={(v) => set({ ability: v as Ability })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ABILITIES.map((ability) => (
              <SelectItem key={ability} value={ability}>
                {ABILITY_LABELS[ability]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
