import { useMemo, useState } from "react";
import {
  CREATURE_SIZE_ABBR,
  CREATURE_SIZE_LABELS,
  MONSTER_TYPE_LABELS,
  allMonsters,
  monsterSizes,
  type CreatureSize,
  type MonsterDef,
  type MonsterType,
} from "@/systems/dnd2024/vocabulary";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useContentPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import { packNameOf } from "@/systems/dnd2024/lib/pack-labels";
import { sortedByLabel } from "@/lib/sort";
import { currentLanguage } from "@/i18n";

const ANY_SIZE = "any";

interface Props {
  trigger: React.ReactNode;
  onPick: (monster: MonsterDef) => void;
}

/**
 * Dialog to pick a monster to pre-fill an enemy stat block: the SRD bank, plus
 * the monsters of the active content packs (the campaign's, the GM's library),
 * each marked with its pack. The enemy copies the stats, so the pack is not
 * needed afterwards.
 */
export function MonsterPicker({ trigger, onPick }: Props) {
  // Pack monsters come through the lookups: reading the overlay re-renders
  // the picker when packs load.
  const { t } = useTranslation(["adventures", "common"]);
  const { overlay } = useContentPacks();
  const monsters = useMemo(
    () => allMonsters(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlay],
  );
  const sizes = useMemo(
    () => monsterSizes(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlay],
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [size, setSize] = useState<CreatureSize | typeof ANY_SIZE>(ANY_SIZE);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = monsters.filter(
      (monster) =>
        (query === "" || monster.name.toLowerCase().includes(query)) &&
        (size === ANY_SIZE || monster.size === size),
    );
    const byType = new Map<MonsterType, MonsterDef[]>();
    for (const monster of filtered) {
      const list = byType.get(monster.type) ?? [];
      list.push(monster);
      byType.set(monster.type, list);
    }
    return [...byType.entries()]
      .sort((a, b) =>
        MONSTER_TYPE_LABELS[a[0]].localeCompare(MONSTER_TYPE_LABELS[b[0]], currentLanguage()),
      )
      .map(([type, list]) => [type, sortedByLabel(list, (monster) => monster.name)] as const);
  }, [monsters, search, size]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          setSize(ANY_SIZE);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("monsters.title")}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder={t("monsters.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select value={size} onValueChange={(value) => setSize(value as typeof size)}>
            <SelectTrigger className="w-44 shrink-0" aria-label={t("monsters.bySize")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_SIZE}>{t("monsters.anySize")}</SelectItem>
              {sizes.map((option) => (
                <SelectItem key={option} value={option}>
                  {CREATURE_SIZE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {groups.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">{t("monsters.none")}</p>
          )}
          {groups.map(([type, monsters]) => (
            <div key={type} className="mb-2">
              <p className="text-muted-foreground px-1 py-1 text-xs font-medium">
                {MONSTER_TYPE_LABELS[type]}
              </p>
              {monsters.map((monster) => (
                <button
                  key={monster.id}
                  type="button"
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    onPick(monster);
                    setOpen(false);
                    setSearch("");
                    setSize(ANY_SIZE);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{monster.name}</span>
                  {packNameOf(monster.id) && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {packNameOf(monster.id)}
                    </Badge>
                  )}
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {CREATURE_SIZE_ABBR[monster.size]} ·{" "}
                    {t("common:stats.cr", { value: monster.cr })} ·{" "}
                    {t("common:stats.ac", { value: monster.armorClass })} ·{" "}
                    {t("common:stats.hp", { value: monster.hitPoints })}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
