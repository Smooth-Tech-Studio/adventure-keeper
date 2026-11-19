import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react";
import {
  InfoIcon,
  ListIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArmorFields,
  PriceWeightFields,
  ToolFields,
  WeaponFields,
} from "@/systems/dnd2024/components/equipment-fields";
import {
  defaultArmorProps,
  defaultToolProps,
  defaultWeaponProps,
  makeItemDraft,
  withArmorEquipped,
  type EquipmentKind,
  type ItemDraft,
} from "@/systems/dnd2024/lib/items";
import { sortedByLabel } from "@/lib/sort";

export type { ItemDraft };
export type { EquipmentKind };

/** One row in a catalogue picker. */
export interface CatalogOption {
  id: string;
  name: string;
  /** Short right-aligned hint (e.g. damage, AC formula, price). */
  hint?: string;
  /** One line on what the thing *is*, under the name — the numbers say the rest. */
  description?: string;
  /** Category label used to group the picker list. */
  group?: string;
}

interface ItemListEditorProps {
  label?: string;
  description?: string;
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  addLabel: string;
  dialogTitle: string;
  namePlaceholder?: string;
  /** What the dialog edits — drives the structured fieldset. Default: free item. */
  kind?: EquipmentKind;
  /** Show −/+ quantity shortcuts on consumable rows. */
  inlineQuantity?: boolean;
  /** Imperative handle — call `ref.current.openAdd()` to pop the "add item" dialog. */
  ref?: Ref<ItemListEditorHandle>;
  /** Hide the built-in "+ add" button (an outside control drives the `ref`). */
  externalAdd?: boolean;
  /** Entries offered by the "pré-remplir depuis la liste" picker. */
  catalog?: CatalogOption[];
  /** Build a full draft from a picked catalogue id. */
  buildCatalogDraft?: (id: string) => ItemDraft | undefined;
  /** Read-only chips shown under each row (damage, AC formula, tool ability…). */
  itemBadges?: (item: ItemDraft) => string[];
  /** A soft warning under the row (« Non maîtrisée par la classe »), shown with its icon. */
  itemWarning?: (item: ItemDraft) => string | null;
  /** Show the "équipée" toggle on rows that carry armour stats. */
  withEquipped?: boolean;
  /** `weapon` kind only — `false` hides the mastery ("botte") picker in the dialog. */
  allowWeaponMastery?: boolean;
}

/** Imperative API exposed through `ref` — lets an outside control open the "add" dialog. */
export interface ItemListEditorHandle {
  openAdd: () => void;
}

export function ItemListEditor({
  label,
  description,
  items,
  onChange,
  addLabel,
  dialogTitle,
  namePlaceholder,
  kind = "plain",
  inlineQuantity = false,
  ref,
  externalAdd = false,
  catalog,
  buildCatalogDraft,
  itemBadges,
  itemWarning,
  withEquipped = false,
  allowWeaponMastery = true,
}: ItemListEditorProps) {
  const { t } = useTranslation(["characters", "common"]);
  const [editing, setEditing] = useState<{ item: ItemDraft; isNew: boolean } | null>(null);

  useImperativeHandle(ref, () => ({
    openAdd: () => setEditing({ item: makeItemDraft(), isNew: true }),
  }));

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
    setEditing((current) => (current?.item.id === id ? null : current));
  }

  function bumpQuantity(id: string, delta: number) {
    onChange(
      items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  }

  function toggleEquipped(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (item?.armor) onChange(withArmorEquipped(items, id, !item.armor.equipped));
  }

  function save(draft: ItemDraft, isNew: boolean) {
    const next = isNew
      ? [...items, draft]
      : items.map((item) => (item.id === draft.id ? draft : item));
    // Saved as worn: whatever was worn in its slot comes off.
    onChange(draft.armor?.equipped ? withArmorEquipped(next, draft.id, true) : next);
    setEditing(null);
  }

  return (
    // One column that may shrink: a long name truncates instead of widening the
    // list (and pushing the row's buttons off a phone screen).
    <div className="grid min-w-0 grid-cols-1 gap-2">
      {(label || description) && (
        <div>
          {label && <Label>{label}</Label>}
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
      )}

      {items.length === 0 && <p className="text-muted-foreground text-sm">{t("items.none")}</p>}

      <ul className="flex flex-col gap-2">
        {sortedByLabel(items, (item) => item.name).map((item) => {
          const badges = itemBadges?.(item) ?? [];
          const warning = itemWarning?.(item);
          return (
            <li key={item.id} className="bg-muted/30 flex items-center gap-2 rounded-md border p-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {item.name || (
                    <span className="text-muted-foreground">{t("items.untitled")}</span>
                  )}
                  {item.quantity > 1 && !(inlineQuantity && item.consumable) && (
                    <span className="text-muted-foreground"> ×{item.quantity}</span>
                  )}
                </div>
                {(badges.length > 0 || warning) && (
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                    {badges.map((badge) => (
                      <span key={badge}>{badge}</span>
                    ))}
                    {warning && (
                      <span className="text-destructive inline-flex items-center gap-1">
                        <TriangleAlertIcon className="size-3" />
                        {warning}
                      </span>
                    )}
                  </div>
                )}
                {item.lore && (
                  <div className="text-muted-foreground truncate text-xs">{item.lore}</div>
                )}
              </div>

              {withEquipped && item.armor && (
                <label className="flex shrink-0 items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={item.armor.equipped}
                    onCheckedChange={() => toggleEquipped(item.id)}
                    aria-label={t("items.equippedLabel")}
                  />
                  {t("items.equipped")}
                </label>
              )}

              {inlineQuantity && item.consumable && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("items.minusOne")}
                    onClick={() => bumpQuantity(item.id, -1)}
                  >
                    <MinusIcon className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("items.plusOne")}
                    onClick={() => bumpQuantity(item.id, 1)}
                  >
                    <PlusIcon className="size-3.5" />
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("common:actions.edit")}
                onClick={() => setEditing({ item: { ...item }, isNew: false })}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 shrink-0"
                aria-label={t("common:actions.delete")}
                onClick={() => remove(item.id)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      {!externalAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setEditing({ item: makeItemDraft(), isNew: true })}
        >
          <PlusIcon /> {addLabel}
        </Button>
      )}

      <ItemDialog
        key={editing?.item.id ?? "closed"}
        open={editing !== null}
        title={dialogTitle}
        namePlaceholder={namePlaceholder}
        kind={kind}
        allowWeaponMastery={allowWeaponMastery}
        catalog={catalog}
        buildCatalogDraft={buildCatalogDraft}
        item={editing?.item ?? null}
        isNew={editing?.isNew ?? true}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={save}
        onDelete={editing && !editing.isNew ? () => remove(editing.item.id) : undefined}
      />
    </div>
  );
}

function CatalogPicker({
  catalog,
  onPick,
}: {
  catalog: CatalogOption[];
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation("characters", { keyPrefix: "items" });
  const [query, setQuery] = useState("");
  /** The row whose description is unfolded: names only, the details on demand. */
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? catalog.filter((row) => row.name.toLowerCase().includes(q)) : catalog;
    const byGroup = new Map<string, CatalogOption[]>();
    for (const row of rows) {
      const key = row.group ?? "";
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(row);
    }
    return [...byGroup.entries()].map(
      ([group, groupRows]) => [group, sortedByLabel(groupRows, (row) => row.name)] as const,
    );
  }, [catalog, query]);

  return (
    <div className="grid gap-2">
      <Input
        id="catalog-search"
        autoFocus
        placeholder={t("search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="max-h-72 overflow-y-auto rounded-md border">
        {groups.length === 0 && (
          <p className="text-muted-foreground p-2 text-sm">{t("noResult")}</p>
        )}
        {groups.map(([group, rows]) => (
          <div key={group || "_"}>
            {group && (
              <p className="text-muted-foreground bg-muted sticky top-0 border-b px-2 py-1 text-xs font-medium">
                {group}
              </p>
            )}
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <div className="flex items-start">
                    <button
                      type="button"
                      className="hover:bg-accent flex min-w-0 flex-1 items-start justify-between gap-2 px-2 py-1.5 text-left text-sm"
                      onClick={() => onPick(row.id)}
                    >
                      <span className="min-w-0 truncate">{row.name}</span>
                      {row.hint && (
                        <span className="text-muted-foreground mt-0.5 shrink-0 text-xs">
                          {row.hint}
                        </span>
                      )}
                    </button>
                    {row.description && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-expanded={detailsId === row.id}
                        aria-label={t("details", { name: row.name })}
                        onClick={() => setDetailsId(detailsId === row.id ? null : row.id)}
                      >
                        <InfoIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                  {detailsId === row.id && (
                    <p className="text-muted-foreground px-2 pb-2 text-xs leading-snug">
                      {row.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ItemDialog({
  open,
  title,
  namePlaceholder,
  kind,
  allowWeaponMastery = true,
  catalog,
  buildCatalogDraft,
  item,
  isNew,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  title: string;
  namePlaceholder?: string;
  kind: EquipmentKind;
  allowWeaponMastery?: boolean;
  catalog?: CatalogOption[];
  buildCatalogDraft?: (id: string) => ItemDraft | undefined;
  item: ItemDraft | null;
  isNew: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: ItemDraft, isNew: boolean) => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation(["characters", "common"]);
  const [name, setName] = useState("");
  const [lore, setLore] = useState("");
  const [consumable, setConsumable] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  /** The structured fields carried on the item (catalogue block + price / weight). */
  const [structured, setStructured] = useState<Partial<ItemDraft>>({});
  /** The catalogue picker is collapsed until the user asks for it. */
  const [showPicker, setShowPicker] = useState(false);

  const structural = kind !== "plain";
  const showConsumable = kind === "plain" || kind === "gear";
  // Weapons stack too (fléchettes, javelines, munitions) — they get a plain
  // quantity field, no "consumable" checkbox.
  const showQuantity = (showConsumable && consumable) || kind === "weapon";

  useEffect(() => {
    setName(item?.name ?? "");
    setLore(item?.lore ?? "");
    setConsumable(item?.consumable ?? false);
    setQuantity(item?.quantity ?? 1);
    setError(null);
    setShowPicker(false);
    setStructured({
      catalogId: item?.catalogId,
      priceCp: item?.priceCp,
      weightKg: item?.weightKg,
      weapon: item?.weapon ?? (kind === "weapon" ? defaultWeaponProps() : undefined),
      armor: item?.armor ?? (kind === "armor" ? defaultArmorProps() : undefined),
      tool: item?.tool ?? (kind === "tool" ? defaultToolProps() : undefined),
    });
  }, [item, kind]);

  function patch(next: Partial<ItemDraft>) {
    setStructured((current) => ({ ...current, ...next }));
  }

  function pickFromCatalog(id: string) {
    const draft = buildCatalogDraft?.(id);
    if (!draft) return;
    setName(draft.name);
    setConsumable(Boolean(draft.consumable));
    setQuantity(draft.quantity ?? 1);
    setStructured({
      catalogId: draft.catalogId,
      priceCp: draft.priceCp,
      weightKg: draft.weightKg,
      weapon: draft.weapon,
      armor: draft.armor,
      tool: draft.tool,
    });
    setError(null);
    setShowPicker(false);
  }

  function submit() {
    if (!item) return;
    if (!name.trim()) {
      setError(t("items.nameRequired"));
      return;
    }
    const nextQuantity = showQuantity ? Math.max(1, Math.round(quantity) || 1) : 1;
    onSave(
      {
        id: item.id,
        name: name.trim(),
        lore: lore.trim() || undefined,
        consumable: kind === "weapon" ? nextQuantity > 1 : showConsumable ? consumable : false,
        quantity: nextQuantity,
        catalogId: structured.catalogId,
        priceCp: structured.priceCp,
        weightKg: structured.weightKg,
        weapon: kind === "weapon" ? structured.weapon : undefined,
        armor: kind === "armor" ? structured.armor : undefined,
        tool: kind === "tool" ? structured.tool : undefined,
      },
      isNew,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? title : t("items.editTitle", { name: item?.name || title })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {isNew &&
            catalog &&
            catalog.length > 0 &&
            (showPicker ? (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>{t("items.prefill")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => setShowPicker(false)}
                  >
                    {t("items.hide")}
                  </Button>
                </div>
                <CatalogPicker catalog={catalog} onPick={pickFromCatalog} />
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setShowPicker(true)}
              >
                <ListIcon /> {t("items.prefill")}
              </Button>
            ))}

          <div className="grid gap-2">
            <Label htmlFor="item-name">{t("items.name")}</Label>
            <Input
              id="item-name"
              autoFocus
              placeholder={namePlaceholder ?? t("items.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !structural && submit()}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          {kind === "weapon" && structured.weapon && (
            <WeaponFields
              value={structured.weapon}
              onChange={(weapon) => patch({ weapon })}
              allowMastery={allowWeaponMastery}
            />
          )}
          {kind === "armor" && structured.armor && (
            <ArmorFields value={structured.armor} onChange={(armor) => patch({ armor })} />
          )}
          {kind === "tool" && structured.tool && (
            <ToolFields value={structured.tool} onChange={(tool) => patch({ tool })} />
          )}

          {structural && (
            <PriceWeightFields
              priceCp={structured.priceCp}
              weightKg={structured.weightKg}
              onPriceCp={(priceCp) => patch({ priceCp })}
              onWeightKg={(weightKg) => patch({ weightKg })}
            />
          )}

          <div className="grid gap-2">
            <Label htmlFor="item-lore">{t("items.lore")}</Label>
            <Textarea
              id="item-lore"
              rows={3}
              value={lore}
              onChange={(event) => setLore(event.target.value)}
            />
          </div>

          {showConsumable && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="item-consumable"
                checked={consumable}
                onCheckedChange={(checked) => setConsumable(checked === true)}
              />
              <Label htmlFor="item-consumable" className="font-normal">
                {t("items.consumable")}
              </Label>
            </div>
          )}

          {showQuantity && (
            <div className="grid w-28 gap-2">
              <Label htmlFor="item-qty">{t("items.quantity")}</Label>
              <Input
                id="item-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2Icon /> {t("common:actions.delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="button" onClick={submit}>
              {isNew ? t("common:actions.add") : t("common:actions.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
