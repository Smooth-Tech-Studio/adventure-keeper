import { useEffect, useState } from "react";
import { PackageIcon, ShieldIcon, SwordIcon, WrenchIcon } from "lucide-react";
import type { Item } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ItemDialog } from "@/components/character/item-list-editor";
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
  cleanItems,
  draftFromArmorDef,
  draftFromGearDef,
  draftFromToolDef,
  draftFromWeaponDef,
  makeItemDraft,
} from "@/systems/dnd2024/lib/items";
import type { EquipmentKind } from "@/systems/dnd2024/lib/items";
import type { CharacterItemsPatch } from "@/lib/collections";
import { tr } from "@/i18n";

type BagSection = keyof CharacterItemsPatch;

const KINDS: {
  kind: Exclude<EquipmentKind, "plain">;
  section: Extract<BagSection, "weapons" | "armors" | "tools" | "inventory">;
  label: string;
  title: string;
  placeholder: string;
  icon: typeof SwordIcon;
}[] = [
  {
    kind: "weapon",
    section: "weapons",
    get label() {
      return tr("session:sheet.bag.kinds.weapon");
    },
    get title() {
      return tr("characters:equipment.newWeapon");
    },
    get placeholder() {
      return tr("characters:equipment.weaponPlaceholder");
    },
    icon: SwordIcon,
  },
  {
    kind: "armor",
    section: "armors",
    get label() {
      return tr("session:sheet.bag.kinds.armor");
    },
    get title() {
      return tr("characters:equipment.newArmor");
    },
    get placeholder() {
      return tr("characters:equipment.armorPlaceholder");
    },
    icon: ShieldIcon,
  },
  {
    kind: "tool",
    section: "tools",
    get label() {
      return tr("session:sheet.bag.kinds.tool");
    },
    get title() {
      return tr("characters:equipment.newTool");
    },
    get placeholder() {
      return tr("characters:equipment.toolPlaceholder");
    },
    icon: WrenchIcon,
  },
  {
    kind: "gear",
    section: "inventory",
    get label() {
      return tr("session:sheet.bag.kinds.gear");
    },
    get title() {
      return tr("characters:equipment.newItem");
    },
    get placeholder() {
      return tr("characters:equipment.itemPlaceholder");
    },
    icon: PackageIcon,
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (section: BagSection, item: Item) => void;
  /** `false` for classes without a Weapon Mastery feature — hides the "botte" picker. */
  showWeaponMastery?: boolean;
}

/**
 * "+" in the session bag: pick a type, then the same structured add-item form
 * used on the character-creation sheet (catalogue pre-fill included).
 */
export function AddEquipmentDialog({ open, onOpenChange, onAdd, showWeaponMastery = true }: Props) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.bag" });
  const [picked, setPicked] = useState<(typeof KINDS)[number] | null>(null);
  const [draft, setDraft] = useState(makeItemDraft);

  const weaponCatalog = useWeaponCatalog();
  const armorCatalog = useArmorCatalog();
  const toolCatalog = useToolCatalog();
  const gearCatalog = useGearCatalog();

  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);

  // A fresh blank draft whenever the type-picker hands control to the form.
  useEffect(() => {
    if (picked) setDraft(makeItemDraft());
  }, [picked]);

  const catalog = picked
    ? {
        weapon: weaponOptions(weaponCatalog),
        armor: armorOptions(armorCatalog),
        tool: toolOptions(toolCatalog),
        gear: gearOptions(gearCatalog),
      }[picked.kind]
    : undefined;

  function buildCatalogDraft(id: string) {
    if (!picked) return undefined;
    if (picked.kind === "weapon") {
      const def = findById(weaponCatalog, id);
      return def ? draftFromWeaponDef(def) : undefined;
    }
    if (picked.kind === "armor") {
      const def = findById(armorCatalog, id);
      return def ? draftFromArmorDef(def) : undefined;
    }
    if (picked.kind === "tool") {
      const def = findById(toolCatalog, id);
      return def ? draftFromToolDef(def) : undefined;
    }
    const def = findById(gearCatalog, id);
    return def ? draftFromGearDef(def) : undefined;
  }

  return (
    <>
      <Dialog open={open && picked === null} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("add")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map(({ kind, label, icon: Icon }) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                className="h-20 flex-col gap-1.5"
                onClick={() => setPicked(KINDS.find((k) => k.kind === kind) ?? null)}
              >
                <Icon className="size-5" />
                {label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {picked && (
        <ItemDialog
          key={`${picked.kind}-${draft.id}`}
          open={open}
          title={picked.title}
          namePlaceholder={picked.placeholder}
          kind={picked.kind}
          allowWeaponMastery={showWeaponMastery}
          catalog={catalog}
          buildCatalogDraft={buildCatalogDraft}
          item={draft}
          isNew
          onOpenChange={(o) => {
            if (!o) onOpenChange(false);
          }}
          onSave={(saved) => {
            const [item] = cleanItems([saved]);
            if (item) onAdd(picked.section, item);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
