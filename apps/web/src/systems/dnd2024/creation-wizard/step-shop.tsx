import { useMemo, useState } from "react";
import { MinusIcon, PlusIcon, SearchIcon } from "lucide-react";
import { formatCoinPrice, formatWeight } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { FormState, SetForm } from "@/systems/dnd2024/character-form/state";
import { compareText } from "@/lib/sort";
import { draftFromGearDef, type ItemDraft } from "@/systems/dnd2024/lib/items";
import { formatPurse, fromCopper } from "@/systems/dnd2024/lib/money";
import {
  itemsCostCp,
  itemsWeightKg,
  kitPurseCp,
  type StartingKit,
} from "@/systems/dnd2024/lib/starting-kit";
import type { ChoiceCatalogs } from "@/systems/dnd2024/lib/choices";
import { cn } from "@/lib/utils";

/**
 * Step 5 — spending what the starting packages handed over.
 *
 * Only **adventuring gear** is on sale: weapons and armour come from the class
 * package, and letting a level-1 character buy plate would make the package
 * choice meaningless.
 *
 * The purse is **derived, never stored**: it is the kit's gold minus what the
 * basket costs. That means there is no "apply the kit" moment to get wrong —
 * going back to step 1 and taking the gold option instead simply changes the
 * number. Overspending is allowed and flagged, as decided.
 */
interface Props {
  state: FormState;
  set: SetForm;
  kit: StartingKit;
  catalogs: ChoiceCatalogs;
}

export function StepShop({ state, set, kit, catalogs }: Props) {
  const { t, i18n } = useTranslation("wizard", { keyPrefix: "shop" });
  const [search, setSearch] = useState("");

  const basket = state.inventory;
  const spentCp = itemsCostCp(basket);
  const purseCp = kitPurseCp(kit);
  const leftCp = purseCp - spentCp;
  const overspent = leftCp < 0;

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalogs.gear ?? [])
      .filter((row) => query === "" || row.name.toLowerCase().includes(query))
      .sort((a, b) => compareText(a.name, b.name));
    // Sorted on the names, which follow the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogs.gear, search, i18n.language]);

  function add(gearId: string) {
    const def = catalogs.gear?.find((row) => row.id === gearId);
    if (!def) return;
    const existing = basket.find((item) => item.catalogId === gearId);
    set(
      "inventory",
      existing
        ? basket.map((item) =>
            item.catalogId === gearId ? { ...item, quantity: (item.quantity ?? 1) + 1 } : item,
          )
        : [...basket, draftFromGearDef(def)],
    );
  }

  /** Removing a line refunds it in full — the purse is recomputed from the basket. */
  function removeOne(item: ItemDraft) {
    const quantity = item.quantity ?? 1;
    set(
      "inventory",
      quantity > 1
        ? basket.map((row) => (row.id === item.id ? { ...row, quantity: quantity - 1 } : row))
        : basket.filter((row) => row.id !== item.id),
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* --- Catalogue ---------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            placeholder={t("search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="py-1 text-left font-medium">{t("item")}</th>
                <th className="py-1 text-right font-medium">{t("weight")}</th>
                <th className="py-1 text-right font-medium">{t("price")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground py-3">
                    {catalogs.gear ? t("noMatch") : t("loading")}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-border/50 border-t">
                  <td className="py-1.5 pr-2">{row.name}</td>
                  <td className="text-muted-foreground py-1.5 text-right tabular-nums">
                    {row.weightKg ? formatWeight(row.weightKg) : "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatCoinPrice(row.priceCp)}</td>
                  <td className="py-1.5 pl-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("buy", { name: row.name })}
                      onClick={() => add(row.id)}
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Purse + backpack --------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="border-input rounded-md border px-3 py-2">
          <div className="text-muted-foreground text-xs">{t("purse")}</div>
          <div className={cn("font-medium tabular-nums", overspent && "text-destructive")}>
            {formatPurse(fromCopper(Math.max(0, leftCp)))}
          </div>
          {overspent && (
            <p className="text-destructive mt-1 text-xs">
              {t("overspent", { amount: formatCoinPrice(-leftCp) })}
            </p>
          )}
          {!overspent && purseCp === 0 && (
            <p className="text-muted-foreground mt-1 text-xs">{t("noGold")}</p>
          )}
        </div>

        <div className="border-input flex min-h-64 flex-col gap-2 rounded-md border px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{t("backpack")}</span>
            <Badge variant="outline" className="tabular-nums">
              {formatWeight(Number(itemsWeightKg([...kit.inventory, ...basket]).toFixed(1)))}
            </Badge>
          </div>

          {kit.inventory.length > 0 && (
            <>
              <span className="text-muted-foreground text-xs">{t("fromPacks")}</span>
              <ul className="grid gap-0.5 text-sm">
                {kit.inventory.map((item) => (
                  <li key={item.id} className="text-muted-foreground flex gap-2">
                    <span className="w-7 shrink-0 text-right tabular-nums">
                      {item.quantity ?? 1}×
                    </span>
                    <span>{item.name}</span>
                  </li>
                ))}
              </ul>
              <Separator />
            </>
          )}

          <span className="text-muted-foreground text-xs">{t("bought")}</span>
          {basket.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("nothing")}</p>
          ) : (
            <ul className="grid gap-0.5 text-sm">
              {basket.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-right tabular-nums">
                    {item.quantity ?? 1}×
                  </span>
                  <span className="flex-1">{item.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("remove", { name: item.name })}
                    onClick={() => removeOne(item)}
                  >
                    <MinusIcon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
