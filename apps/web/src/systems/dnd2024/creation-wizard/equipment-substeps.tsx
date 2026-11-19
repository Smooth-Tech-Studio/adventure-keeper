import { useTranslation } from "react-i18next";

import { Panel } from "@/systems/dnd2024/creation-wizard/fixed-substeps";
import type { ItemDraft } from "@/systems/dnd2024/lib/items";
import { formatPurse, fromCopper } from "@/systems/dnd2024/lib/money";
import type { StartingKit } from "@/systems/dnd2024/lib/starting-kit";
import { cn } from "@/lib/utils";

const purseText = (cp: number) =>
  cp < 0 ? `−${formatPurse(fromCopper(-cp))}` : formatPurse(fromCopper(cp));

function ItemLines({ items, muted }: { items: ItemDraft[]; muted?: boolean }) {
  return (
    <ul className={cn("grid gap-1 text-sm", muted && "text-muted-foreground")}>
      {items.map((item) => (
        <li key={item.id} className="flex justify-between gap-2">
          <span>{item.name}</span>
          <span className="tabular-nums">×{item.quantity ?? 1}</span>
        </li>
      ))}
    </ul>
  );
}

/** Step 5, first screen: what the packages already put in the bag. */
export function KitStep({
  kit,
  packages,
  purseCp,
}: {
  kit: StartingKit;
  /** « Paquetage lourd », « 50 po »… — the options picked at steps 1 and 3. */
  packages: string[];
  purseCp: number;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "kit" });
  const groups: [string, ItemDraft[]][] = [
    [t("weapons"), kit.weapons],
    [t("armors"), kit.armors],
    [t("tools"), kit.tools],
    [t("gear"), kit.inventory],
  ];
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <span className="type-label">{t("purse")}</span>
        <span className="type-figure">{purseText(purseCp)}</span>
        <span className="text-muted-foreground text-xs">
          {packages.length > 0 ? packages.join(" + ") : t("noPack")}
        </span>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        {groups
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => (
            <Panel key={label} title={label}>
              <ItemLines items={items} />
            </Panel>
          ))}
      </div>
      {groups.every(([, items]) => items.length === 0) && (
        <p className="text-muted-foreground text-sm">{t("goldOnly")}</p>
      )}
    </div>
  );
}
