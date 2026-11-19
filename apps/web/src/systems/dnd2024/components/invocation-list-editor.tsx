import { useEffect, useMemo, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  allInvocations,
  getInvocation,
  invocationAvailable,
  invocationsKnown,
  validInvocations,
  type InvocationDef,
  type InvocationPick,
  type SpellDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Item, ItemActions } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compareText, sortedByLabel } from "@/lib/sort";
import { tr } from "@/i18n";

const NO_WEAPON = "__none__";

interface Props {
  /** The class that learns the invocations: it says how many it knows. */
  classId: string;
  level: number;
  /** Chosen invocations (`spellId` = the cantrip an invocation is attached to). */
  value: InvocationPick[];
  onChange: (picks: InvocationPick[]) => void;
  /** The Warlock cantrips the character knows — what Décharge déchirante & co. attach to. */
  cantrips: SpellDef[];
  /** Melee weapons the character carries, for the pact weapon. */
  weapons: { id: string; name: string }[];
  /** Pact weapon item id; `""` = none. */
  pactWeaponId: string;
  onPactWeaponChange: (id: string) => void;
  error?: string;
}

/** The known cantrips an invocation could attach to (damaging / attack-roll), minus the ones it already uses. */
function eligibleCantrips(
  invocation: InvocationDef,
  cantrips: SpellDef[],
  picks: InvocationPick[],
): SpellDef[] {
  if (!invocation.cantrip) return [];
  const used = new Set(picks.filter((p) => p.id === invocation.id).map((p) => p.spellId));
  return cantrips
    .filter((spell) =>
      invocation.cantrip === "attack"
        ? spell.attackRoll === true
        : spell.damage != null && spell.damage.kind !== "heal",
    )
    .filter((spell) => !used.has(spell.id));
}

/** Why an invocation can't be taken yet, or `null` when it can. */
function lockedReason(
  invocation: InvocationDef,
  level: number,
  picks: InvocationPick[],
  cantrips: SpellDef[],
): string | null {
  const ids = picks.map((p) => p.id);
  if (!invocationAvailable(invocation, level, ids)) {
    if (level < invocation.minLevel) {
      return tr("characters:invocations.levelRequired", { level: invocation.minLevel });
    }
    const required = invocation.requires ? getInvocation(invocation.requires) : undefined;
    return required
      ? tr("characters:invocations.requires", { name: required.name })
      : tr("characters:invocations.unmet");
  }
  if (invocation.cantrip && eligibleCantrips(invocation, cantrips, picks).length === 0) {
    return tr(
      invocation.cantrip === "attack"
        ? "characters:invocations.pickCantripAttack"
        : "characters:invocations.pickCantripDamage",
    );
  }
  return null;
}

/** Prerequisites as a one-liner (`Niv 5+ · Pacte de la lame`), or `null` when there are none. */
function prerequisiteLabel(invocation: InvocationDef): string | null {
  const parts = [
    invocation.minLevel > 0
      ? tr("characters:invocations.minLevel", { level: invocation.minLevel })
      : null,
    invocation.requires ? (getInvocation(invocation.requires)?.name ?? null) : null,
    invocation.condition ?? null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * « Manifestations occultes » picker (the Warlock's): the number known depends on the
 * level, each one may require a minimum level or another invocation (a Pact),
 * and a few attach to one of the character's cantrips.
 */
export function InvocationListEditor({
  classId,
  level,
  value,
  onChange,
  cantrips,
  weapons,
  pactWeaponId,
  onPactWeaponChange,
  error,
}: Props) {
  const { t } = useTranslation("characters", { keyPrefix: "invocations" });
  const [picking, setPicking] = useState(false);
  /** Set while choosing the cantrip an invocation attaches to (second step). */
  const [cantripFor, setCantripFor] = useState<InvocationDef | null>(null);
  const [search, setSearch] = useState("");

  const cap = invocationsKnown(classId, level);
  const cantripName = (id: string | undefined) =>
    cantrips.find((spell) => spell.id === id)?.name ?? id ?? "";

  // Alphabetical, but remember each pick's position so a removal targets the right one.
  const chosen = useMemo(
    () =>
      sortedByLabel(
        value.flatMap((pick, index) => {
          const invocation = getInvocation(pick.id);
          return invocation ? [{ pick, index, invocation }] : [];
        }),
        (entry) => entry.invocation.name,
      ),
    [value],
  );
  const atCap = value.length >= cap;
  const hasPactBlade = value.some((pick) => pick.id === "pact-of-the-blade");

  // Drop picks that no longer hold (level lowered, Pact removed, cantrip forgotten).
  const knownCantripIds = useMemo(() => cantrips.map((spell) => spell.id), [cantrips]);
  useEffect(() => {
    const kept = validInvocations(value, level, knownCantripIds);
    if (kept.length !== value.length) onChange(kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, value, knownCantripIds]);

  // The pact weapon must stay one of the carried melee weapons.
  useEffect(() => {
    if (pactWeaponId && !(hasPactBlade && weapons.some((weapon) => weapon.id === pactWeaponId))) {
      onPactWeaponChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPactBlade, weapons, pactWeaponId]);

  const { available, locked } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const candidates = allInvocations()
      .filter((i) => i.repeatable || !value.some((pick) => pick.id === i.id))
      .filter((i) => query === "" || i.name.toLowerCase().includes(query));
    return {
      available: candidates.filter((i) => lockedReason(i, level, value, cantrips) === null),
      locked: candidates.filter((i) => lockedReason(i, level, value, cantrips) !== null),
    };
  }, [search, level, value, cantrips]);

  function closePicker() {
    setPicking(false);
    setCantripFor(null);
    setSearch("");
  }

  function add(invocation: InvocationDef, spellId?: string) {
    if (atCap) return;
    onChange([...value, spellId ? { id: invocation.id, spellId } : { id: invocation.id }]);
    closePicker();
  }

  function choose(invocation: InvocationDef) {
    if (invocation.cantrip) setCantripFor(invocation);
    else add(invocation);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label>{t("title")}</Label>
        <Badge variant={value.length > cap ? "destructive" : "secondary"}>
          {value.length} / {cap}
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">{t("intro")}</p>

      {chosen.length === 0 && <p className="text-muted-foreground text-sm">{t("none")}</p>}

      <ul className="flex flex-col gap-2">
        {chosen.map(({ pick, index, invocation }) => (
          <li key={`${pick.id}:${pick.spellId ?? index}`}>
            <Item variant="muted" size="xs">
              <div className="min-w-0 flex-1 p-1">
                <span className="block truncate text-sm font-medium">
                  {invocation.name}
                  {pick.spellId && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {cantripName(pick.spellId)}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground block text-xs">{invocation.summary}</span>
              </div>
              <ItemActions>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 shrink-0"
                  aria-label={t("remove", { name: invocation.name })}
                  onClick={() => remove(index)}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </ItemActions>
            </Item>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={atCap}
        onClick={() => setPicking(true)}
      >
        <PlusIcon /> {t("add")}
      </Button>
      {atCap && <p className="text-muted-foreground text-xs">{t("atCap")}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {hasPactBlade && (
        <div className="grid gap-1.5">
          <Label>{t("pactWeapon")}</Label>
          <Select
            value={pactWeaponId || NO_WEAPON}
            onValueChange={(id) => onPactWeaponChange(id === NO_WEAPON ? "" : id)}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_WEAPON}>{t("noWeapon")}</SelectItem>
              {sortedByLabel(weapons, (weapon) => weapon.name).map((weapon) => (
                <SelectItem key={weapon.id} value={weapon.id}>
                  {weapon.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {weapons.length === 0 ? t("addWeaponFirst") : t("pactWeaponHint")}
          </p>
        </div>
      )}

      <Dialog
        open={picking}
        onOpenChange={(open) => {
          if (open) setPicking(true);
          else closePicker();
        }}
      >
        <DialogContent>
          {cantripFor ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("cantripTitle", { name: cantripFor.name })}</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">
                {cantripFor.cantrip === "attack" ? t("cantripAttack") : t("cantripDamage")}
              </p>
              <div className="max-h-80 overflow-y-auto">
                {sortedByLabel(eligibleCantrips(cantripFor, cantrips, value), (s) => s.name).map(
                  (spell) => (
                    <button
                      key={spell.id}
                      type="button"
                      className="hover:bg-accent flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm"
                      onClick={() => add(cantripFor, spell.id)}
                    >
                      {spell.name}
                      <PlusIcon className="text-muted-foreground size-4" />
                    </button>
                  ),
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setCantripFor(null)}
              >
                {t("back")}
              </Button>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("add")}</DialogTitle>
              </DialogHeader>
              <Input
                autoFocus
                placeholder={t("search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="h-80 overflow-y-auto">
                {available.length === 0 && locked.length === 0 && (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    {t("noneAvailable")}
                  </p>
                )}
                {[...available]
                  .sort((a, b) => compareText(a.name, b.name))
                  .map((invocation) => {
                    const prerequisite = prerequisiteLabel(invocation);
                    return (
                      <button
                        key={invocation.id}
                        type="button"
                        className="hover:bg-accent grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left text-sm"
                        onClick={() => choose(invocation)}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {invocation.name}
                          </span>
                          <PlusIcon className="text-muted-foreground size-4 shrink-0" />
                        </span>
                        {prerequisite && (
                          <span className="text-muted-foreground text-xs">{prerequisite}</span>
                        )}
                        <span className="text-muted-foreground text-xs">{invocation.summary}</span>
                      </button>
                    );
                  })}
                {locked.length > 0 && (
                  <>
                    <p className="text-muted-foreground px-1 pt-3 pb-1 text-xs font-medium">
                      {t("unmetHeading")}
                    </p>
                    {[...locked]
                      .sort((a, b) => compareText(a.name, b.name))
                      .map((invocation) => (
                        <div
                          key={invocation.id}
                          className="grid gap-0.5 rounded-md px-2 py-1.5 text-sm opacity-50"
                        >
                          <span className="truncate font-medium">{invocation.name}</span>
                          <span className="text-xs">
                            {lockedReason(invocation, level, value, cantrips)}
                          </span>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
