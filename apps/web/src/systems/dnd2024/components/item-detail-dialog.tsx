import type { Item } from "@adventure-keeper/schemas";
import { formatCoinPrice, formatWeight } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { findById, useGearCatalog, useToolCatalog } from "@/systems/dnd2024/lib/equipment";
import {
  armorItemBadges,
  toolItemBadges,
  toolUsage,
  weaponGlossary,
  weaponItemBadges,
} from "@/systems/dnd2024/lib/equipment-format";

interface Props {
  item: Item | null;
  onClose: () => void;
  /** Armour rows only — the "worn" toggle. */
  onToggleEquipped?: () => void;
  /** `false` for classes without a Weapon Mastery feature — hides the weapon's mastery. */
  showMastery?: boolean;
}

/** Read-only consultation of an item (weapon / armour / tool / gear). */
export function ItemDetailDialog({ item, onClose, onToggleEquipped, showMastery = true }: Props) {
  // Plain gear and tools carry no stat block; their description comes from the catalogue.
  const { t } = useTranslation("characters", { keyPrefix: "itemDetail" });
  const gearCatalog = useGearCatalog(item !== null && !item.weapon && !item.armor && !item.tool);
  const toolCatalog = useToolCatalog(item?.tool !== undefined);
  const catalogDescription = item?.catalogId
    ? item.tool
      ? findById(toolCatalog, item.catalogId)?.description
      : findById(gearCatalog, item.catalogId)?.description
    : undefined;
  const badges = item
    ? item.weapon
      ? weaponItemBadges(item, showMastery)
      : item.armor
        ? armorItemBadges(item)
        : item.tool
          ? toolItemBadges(item)
          : []
    : [];
  const glossary = item?.weapon ? weaponGlossary([item], showMastery) : [];
  const usage = item?.tool ? toolUsage(item) : undefined;
  const price = typeof item?.priceCp === "number" ? formatCoinPrice(item.priceCp) : null;

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item?.name ?? "Objet"}</DialogTitle>
        </DialogHeader>

        {item && (
          <div className="flex flex-col gap-3 text-sm">
            {badges.length > 0 && (
              <div className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                {badges.map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </div>
            )}

            {onToggleEquipped && item.armor && (
              <label className="flex items-center gap-2">
                <Checkbox checked={item.armor.equipped} onCheckedChange={onToggleEquipped} />
                {t("equipped")}
              </label>
            )}

            {catalogDescription && <p>{catalogDescription}</p>}

            {usage && <p className="text-muted-foreground text-xs">{usage}</p>}

            {glossary.length > 0 && (
              <dl className="grid gap-1 text-xs">
                {glossary.map((entry) => (
                  <div key={entry.term}>
                    <dt className="font-medium">{entry.term}</dt>
                    <dd className="text-muted-foreground">{entry.description}</dd>
                  </div>
                ))}
              </dl>
            )}

            {item.lore && <p className="whitespace-pre-wrap">{item.lore}</p>}

            {(price || typeof item.weightKg === "number" || item.quantity > 1) && (
              <p className="text-muted-foreground text-xs">
                {price && t("price", { price })}
                {price && typeof item.weightKg === "number" && " · "}
                {typeof item.weightKg === "number" &&
                  t("weight", { weight: formatWeight(item.weightKg) })}
                {(price || typeof item.weightKg === "number") && item.quantity > 1 && " · "}
                {item.quantity > 1 && t("quantity", { quantity: item.quantity })}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
