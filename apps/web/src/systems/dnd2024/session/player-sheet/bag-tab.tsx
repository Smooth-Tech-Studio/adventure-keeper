import { useEffect, useState } from "react";
import { MinusIcon, PencilIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import type { Dnd2024Character, Item, Money } from "@adventure-keeper/schemas";
import {
  hasPowerfulBuild,
  carryingCapacityKg,
  formatWeight,
  largerSize,
  weaponMasteryCount,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemDetailDialog } from "@/systems/dnd2024/components/item-detail-dialog";
import { AddEquipmentDialog } from "@/systems/dnd2024/session/player-sheet/add-equipment-dialog";
import { BagEditorDialog } from "@/systems/dnd2024/session/player-sheet/bag-editor-dialog";
import {
  PurseSumDialog,
  type PurseSumMode,
} from "@/systems/dnd2024/session/player-sheet/purse-sum-dialog";
import {
  armorItemBadges,
  armorTrainingWarning,
  toolItemBadges,
  weaponItemBadges,
  weaponTrainingWarning,
} from "@/systems/dnd2024/lib/equipment-format";
import { normalizeItems, withArmorEquipped } from "@/systems/dnd2024/lib/items";
import { COINS, formatPurse, normalizeMoney } from "@/systems/dnd2024/lib/money";
import { sortedByLabel } from "@/lib/sort";
import type { CharacterItemsPatch, WithId } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { tr } from "@/i18n";

type Source = "weapons" | "armors" | "tools" | "inventory";

interface Props {
  character: WithId<Dnd2024Character>;
  onCharacterItemsChange: (patch: CharacterItemsPatch) => void;
}

export function BagTab({ character, onCharacterItemsChange }: Props) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.bag" });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<{ item: Item; source: Source } | null>(null);
  const [purseOpen, setPurseOpen] = useState(false);
  const [purseSum, setPurseSum] = useState<PurseSumMode | null>(null);

  // Alphabetical, like every other list of the app.
  const alphabetical = (items: Item[]) => sortedByLabel(items, (item) => item.name);
  const weapons = alphabetical(normalizeItems(character.weapons));
  const armors = alphabetical(normalizeItems(character.armors));
  const tools = alphabetical(normalizeItems(character.tools));
  const inventory = alphabetical(normalizeItems(character.inventory));
  const money = normalizeMoney(character.money);
  const hasWeaponMastery = weaponMasteryCount(character.classId, character.level ?? 1) > 0;

  const sections: { source: Source; title: string; items: Item[] }[] = [
    { source: "weapons", title: tr("characters:equipment.weapons"), items: weapons },
    { source: "armors", title: tr("characters:equipment.armors"), items: armors },
    { source: "tools", title: tr("characters:equipment.tools"), items: tools },
    { source: "inventory", title: tr("characters:equipment.inventory"), items: inventory },
  ];
  const carriedKg = sections
    .flatMap((section) => section.items)
    .reduce((total, item) => total + (item.weightKg ?? 0) * Math.max(1, item.quantity ?? 1), 0);
  const size = character.size ?? "medium";
  const capacityKg = carryingCapacityKg(
    character.adjustedAbilityScores.str,
    hasPowerfulBuild(character.speciesId) ? largerSize(size) : size,
  );
  const overloaded = carriedKg > capacityKg;

  const itemsOf = (source: Source) => sections.find((s) => s.source === source)!.items;
  // What the character wears and wields, its tools, then the bag: one row each.
  const rowsOf = (...sources: Source[]) =>
    sources.flatMap((source) => itemsOf(source).map((item) => ({ item, source })));
  const groups = [
    { id: "worn", title: t("worn"), rows: rowsOf("weapons", "armors") },
    { id: "tools", title: tr("characters:equipment.tools"), rows: rowsOf("tools") },
    { id: "inventory", title: t("bagTitle"), rows: rowsOf("inventory") },
  ];

  const patchSection = (source: Source, items: Item[]) =>
    onCharacterItemsChange({ [source]: items } as CharacterItemsPatch);

  function setQuantity(source: Source, id: string, quantity: number) {
    patchSection(
      source,
      itemsOf(source).map((it) => (it.id === id ? { ...it, quantity: Math.max(1, quantity) } : it)),
    );
  }

  function toggleEquipped(item: Item) {
    if (!item.armor) return;
    patchSection("armors", withArmorEquipped(armors, item.id, !item.armor.equipped));
    setViewing({
      item: { ...item, armor: { ...item.armor, equipped: !item.armor.equipped } },
      source: "armors",
    });
  }

  function setCoin(key: keyof Money, value: number) {
    onCharacterItemsChange({ money: { ...money, [key]: Math.max(0, value) } });
  }

  return (
    <div id="player-bag" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 flex-1"
          aria-label={t("add")}
          onClick={() => setAdding(true)}
        >
          <PlusIcon className="size-4" /> {t("addShort")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setEditing(true)}
        >
          <PencilIcon className="size-3.5" /> {t("edit")}
        </Button>
      </div>

      <div
        id="player-bag-weight"
        className="bg-card grid gap-1 rounded-xl border px-3 py-2 text-xs"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">{t("carried")}</span>
          <span className={cn("font-medium tabular-nums", overloaded && "text-destructive")}>
            {formatWeight(Math.round(carriedKg * 10) / 10)} / {formatWeight(capacityKg)}
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full", overloaded ? "bg-destructive" : "bg-primary")}
            style={{ width: `${Math.min(100, (carriedKg / capacityKg) * 100)}%` }}
          />
        </div>
        {overloaded && <p className="text-destructive">{t("overloaded")}</p>}
      </div>

      {groups.map(({ id, title, rows }) =>
        rows.length === 0 ? null : (
          <section key={id} id={`player-bag-${id}`} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {title}
            </h3>
            <ul className="bg-card divide-y overflow-hidden rounded-xl border">
              {rows.map(({ item, source }) => {
                const warning = trainingWarning(item, source, character.classId);
                const details = describe(item, hasWeaponMastery);
                return (
                  <li key={item.id} className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      onClick={() => setViewing({ item, source })}
                      className="hover:bg-accent/60 min-w-0 flex-1 px-3 py-2 text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{item.name}</span>
                        {warning && (
                          <span
                            className="text-destructive"
                            title={t("notProficient")}
                            aria-label={t("notProficient")}
                          >
                            <TriangleAlertIcon className="size-3.5" />
                          </span>
                        )}
                      </span>
                      {details && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {details}
                        </span>
                      )}
                    </button>
                    {item.armor?.equipped && (
                      <span className="shrink-0 rounded border border-emerald-500/50 px-1.5 text-[10px] font-semibold text-emerald-600 uppercase dark:text-emerald-300">
                        {t("equipped")}
                      </span>
                    )}
                    {item.consumable ? (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={t("minus")}
                          onClick={() => setQuantity(source, item.id, item.quantity - 1)}
                        >
                          <MinusIcon className="size-3.5" />
                        </Button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={t("plus")}
                          onClick={() => setQuantity(source, item.id, item.quantity + 1)}
                        >
                          <PlusIcon className="size-3.5" />
                        </Button>
                      </span>
                    ) : (
                      item.quantity > 1 && (
                        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                          ×{item.quantity}
                        </span>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}

      <section id="player-bag-purse" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-muted-foreground flex-1 text-xs font-semibold tracking-wide uppercase">
            {t("purse")}
          </h3>
          <span className="text-sm font-bold tabular-nums">{formatPurse(money)}</span>
          {/* A sum gained or spent at the table; the pencil corrects a coin by hand. */}
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            aria-label={t("sum.spendTitle")}
            onClick={() => setPurseSum("spend")}
          >
            <MinusIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-7"
            aria-label={t("sum.addTitle")}
            onClick={() => setPurseSum("add")}
          >
            <PlusIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            aria-expanded={purseOpen}
            onClick={() => setPurseOpen(!purseOpen)}
          >
            <PencilIcon className="size-3" /> {t("edit")}
          </Button>
        </div>
        {purseOpen && (
          <ul className="bg-card divide-y overflow-hidden rounded-xl border">
            {COINS.map(({ key, label, short }) => (
              <li key={key} className="flex items-center gap-1 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t("minusCoin", { coin: short })}
                    onClick={() => setCoin(key, money[key] - 1)}
                  >
                    <MinusIcon className="size-3.5" />
                  </Button>
                  <CoinInput
                    value={money[key]}
                    label={label}
                    onCommit={(value) => setCoin(key, value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t("plusCoin", { coin: short })}
                    onClick={() => setCoin(key, money[key] + 1)}
                  >
                    <PlusIcon className="size-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PurseSumDialog
        mode={purseSum}
        money={money}
        onOpenChange={(open) => !open && setPurseSum(null)}
        onApply={(next) => onCharacterItemsChange({ money: next })}
      />

      <AddEquipmentDialog
        open={adding}
        onOpenChange={setAdding}
        showWeaponMastery={hasWeaponMastery}
        onAdd={(section, item) => {
          if (section === "money") return;
          const source = section as Source;
          patchSection(source, [...itemsOf(source), item]);
        }}
      />

      <BagEditorDialog
        open={editing}
        onOpenChange={setEditing}
        character={character}
        onCharacterItemsChange={onCharacterItemsChange}
      />

      <ItemDetailDialog
        item={viewing?.item ?? null}
        onClose={() => setViewing(null)}
        showMastery={hasWeaponMastery}
        onToggleEquipped={
          viewing?.source === "armors" && viewing.item.armor
            ? () => toggleEquipped(viewing.item)
            : undefined
        }
      />
    </div>
  );
}

/** « 1d8 Tranchant · Polyvalente », « CA 16 · Discrétion désav. »… — the item's line under its name. */
function describe(item: Item, withMastery: boolean): string {
  const badges = item.weapon
    ? weaponItemBadges(item, withMastery)
    : item.armor
      ? armorItemBadges({ armor: { ...item.armor, equipped: false } })
      : item.tool
        ? toolItemBadges(item)
        : [];
  return badges.join(" · ");
}

function trainingWarning(item: Item, source: Source, classId: string | undefined) {
  if (source === "weapons") return weaponTrainingWarning(item, classId);
  if (source === "armors") return armorTrainingWarning(item, classId);
  return null;
}

/**
 * Editable coin count: type an amount directly (« 500 »), committed on blur / Enter
 * so a multi-digit entry is a single write.
 */
function CoinInput({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    const parsed = Math.max(0, Math.floor(Number(draft)));
    if (draft.trim() === "" || Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    setDraft(String(parsed));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      aria-label={label}
      className="h-6 w-14 [appearance:textfield] px-1 text-center text-xs font-semibold tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
