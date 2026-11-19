import { useState, type ReactNode } from "react";
import type {
  AdventureParticipant,
  AdventureParticipantPlayerUpdate,
  Dnd2024Character,
} from "@adventure-keeper/schemas";
import {
  ABILITY_ABBR,
  ABILITY_LABELS,
  castingTimeLabel,
  spellcastingWith,
  type SpellDef,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvocationGroup } from "@/components/character/character-sheet/primitives";
import { SpellCard } from "@/systems/dnd2024/components/spell-card";
import { invocationEntries } from "@/systems/dnd2024/lib/invocations";
import { compareText } from "@/lib/sort";
import { findSpell, useSpells } from "@/systems/dnd2024/lib/spells";
import type { WithId } from "@/lib/collections";
import { Pips } from "@/systems/dnd2024/session/player-sheet/pips";
import { tr } from "@/i18n";
import { signed } from "@/lib/format";
import {
  combatSpells,
  type RollSpec,
  type SpellAction,
} from "@/systems/dnd2024/lib/player-actions";
import { cn } from "@/lib/utils";

interface Props {
  character: WithId<Dnd2024Character>;
  participant: WithId<AdventureParticipant>;
  onParticipantStateChange: (patch: AdventureParticipantPlayerUpdate) => void;
  /** Opens a spell's roll (attack then damage, or damage), filled in. */
  onRoll: (spec: RollSpec) => void;
  /** Casts a spell of level 1+: its slot is picked and spent, then it rolls. */
  onCast: (spell: SpellDef) => void;
}

function Tag({ children, tone }: { children: ReactNode; tone?: "concentration" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1.5 text-[10px] font-semibold uppercase",
        tone === "concentration"
          ? "border-violet-400/50 text-violet-600 dark:text-violet-300"
          : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/**
 * One level of spells, as a block of the card: its header (and its slots),
 * then a row per spell — the name opens the spell, the right side rolls it.
 */
function SpellGroup({
  title,
  aside,
  list,
  actions,
  concentratedId,
  onView,
  onRoll,
  onCast,
  onToggleConcentration,
}: {
  title: string;
  aside?: ReactNode;
  list: SpellDef[];
  actions: Map<string, SpellAction>;
  concentratedId: string | null;
  onView: (spell: SpellDef) => void;
  onRoll: (spec: RollSpec) => void;
  onCast: (spell: SpellDef) => void;
  onToggleConcentration: (spell: SpellDef, active: boolean) => void;
}) {
  const { t } = useTranslation("session");
  return (
    <>
      <div className="bg-muted/40 flex items-center gap-2 border-t px-3 py-1.5">
        <h4 className="flex-1 text-xs font-semibold">{title}</h4>
        {aside}
      </div>
      {list.map((spell) => {
        const active = concentratedId === spell.id;
        const action = actions.get(spell.id);
        const info =
          action?.info ||
          [castingTimeLabel(spell.castingTime), spell.range].filter(Boolean).join(" · ");
        return (
          <div key={spell.id} className="flex items-center gap-2 border-t pr-2">
            <div className="min-w-0 flex-1 py-2 pl-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="truncate text-left text-sm font-semibold hover:underline"
                  onClick={() => onView(spell)}
                >
                  {spell.name}
                </button>
                {spell.concentration && <Tag tone="concentration">{t("player.concentration")}</Tag>}
                {spell.ritual && <Tag>{t("player.ritual")}</Tag>}
              </div>
              <p className="text-muted-foreground truncate text-xs">{info}</p>
            </div>
            {spell.concentration && (
              <Button
                type="button"
                size="sm"
                variant={active ? "secondary" : "ghost"}
                className="h-7 shrink-0 px-2 text-[11px]"
                aria-pressed={active}
                onClick={() => onToggleConcentration(spell, active)}
              >
                {active ? t("sheet.spells.concentrating") : t("sheet.spells.concentrate")}
              </Button>
            )}
            {spell.level > 0 ? (
              // Casting it spends a slot: the dialog picks which, then rolls.
              <button
                type="button"
                className="hover:bg-accent text-muted-foreground shrink-0 rounded-lg px-2 py-1 text-sm font-semibold whitespace-nowrap tabular-nums"
                aria-label={t("player.cast.castSpell", { name: spell.name })}
                onClick={() => onCast(spell)}
              >
                {action?.roll ? action.summary : t("player.cast.button")}
              </button>
            ) : (
              action?.roll && (
                <button
                  type="button"
                  className="hover:bg-accent text-muted-foreground shrink-0 rounded-lg px-2 py-1 text-sm font-semibold whitespace-nowrap tabular-nums"
                  aria-label={t("player.rollSpell", { name: spell.name })}
                  onClick={() => onRoll(action.roll!)}
                >
                  {action.summary}
                </button>
              )
            )}
          </div>
        );
      })}
    </>
  );
}

export function SpellsTab({
  character,
  participant,
  onParticipantStateChange,
  onRoll,
  onCast,
}: Props) {
  const { t } = useTranslation("session", { keyPrefix: "sheet.spells" });
  const spells = useSpells(true);
  const [viewed, setViewed] = useState<SpellDef | null>(null);

  const used = participant.spellSlotsUsed ?? {};
  const concentration = participant.concentration ?? null;

  function setUsed(key: string, value: number) {
    onParticipantStateChange({ spellSlotsUsed: { ...used, [key]: value } });
  }

  function toggleConcentration(spell: SpellDef, active: boolean) {
    onParticipantStateChange({
      concentration: active ? null : { spellId: spell.id, label: spell.name },
    });
  }

  const slotLevels = Object.keys(character.spellSlots ?? {})
    .map(Number)
    .filter((n) => (character.spellSlots as Record<string, number>)[String(n)] > 0)
    .sort((a, b) => a - b);

  // A spell two sources grant (Druid and Forest Gnome) is listed once.
  const granted = [...new Set((character.grantedSpells ?? []).map((g) => g.spellId))]
    .map((id) => (spells ? findSpell(spells, id) : undefined))
    .filter((s): s is SpellDef => Boolean(s))
    .sort((a, b) => a.level - b.level || compareText(a.name, b.name));
  const grantedIds = new Set(granted.map((s) => s.id));

  const cantrips = (character.cantrips ?? [])
    .map((id) => (spells ? findSpell(spells, id) : undefined))
    .filter((s): s is SpellDef => s != null && !grantedIds.has(s.id))
    .sort((a, b) => compareText(a.name, b.name));
  const leveled = (character.spells ?? [])
    .map((id) => (spells ? findSpell(spells, id) : undefined))
    .filter((s): s is SpellDef => s != null && !grantedIds.has(s.id))
    .sort((a, b) => a.level - b.level || compareText(a.name, b.name));
  const invocations = invocationEntries(character, spells);

  // Species-granted spells use the ability the player picked for them.
  const speciesGrantedIds = new Set(
    (character.grantedSpells ?? []).filter((g) => g.source === "species").map((g) => g.spellId),
  );
  const chosenIds = new Set([...(character.cantrips ?? []), ...(character.spells ?? [])]);
  const speciesCasting = character.speciesSpellcasting ?? null;
  const viewedFromSpecies =
    viewed != null &&
    speciesCasting != null &&
    speciesGrantedIds.has(viewed.id) &&
    !chosenIds.has(viewed.id);
  // A feat's spells (« Initié à la magie ») use the ability picked for the feat.
  const featCasting = new Map(
    (character.grantedSpells ?? [])
      .filter((g) => g.ability && !chosenIds.has(g.spellId))
      .map((g) => [
        g.spellId,
        {
          label: g.sourceLabel,
          ...spellcastingWith(g.ability!, character.abilityModifiers, character.proficiencyBonus),
        },
      ]),
  );
  const viewedFromFeat = viewed ? featCasting.get(viewed.id) : undefined;
  const byLevel = new Map<number, SpellDef[]>();
  for (const spell of leveled) {
    if (!byLevel.has(spell.level)) byLevel.set(spell.level, []);
    byLevel.get(spell.level)!.push(spell);
  }

  const actions = new Map((spells ? combatSpells(character, spells) : []).map((a) => [a.id, a]));
  const concentratedId = concentration?.spellId ?? null;
  const group = {
    actions,
    concentratedId,
    onView: setViewed,
    onRoll,
    onCast,
    onToggleConcentration: toggleConcentration,
  };
  const slotPips = (key: string, max: number, label: string) => (
    <span className="flex items-center gap-1.5">
      <Pips
        total={max}
        filled={used[key] ?? 0}
        label={label}
        onChange={(value) => setUsed(key, value)}
      />
      <span className="text-muted-foreground text-xs tabular-nums">
        {max - (used[key] ?? 0)} / {max}
      </span>
    </span>
  );
  const slotsOf = (level: number) =>
    (character.spellSlots as Record<string, number> | undefined)?.[String(level)] ?? 0;
  // Slot levels with no spell of that level still show their slots (upcasting).
  const levels = [...new Set([...byLevel.keys(), ...slotLevels])].sort((a, b) => a - b);
  const caster = character.spellcastingAbility;

  return (
    <div className="flex flex-col gap-3">
      {caster && (
        <div className="bg-card grid grid-cols-3 divide-x overflow-hidden rounded-xl border text-center">
          {[
            [ABILITY_ABBR[caster], t("ability")],
            [character.spellSaveDc ?? "—", t("dc")],
            [signed(character.spellAttackBonus ?? 0), t("attack")],
          ].map(([value, label]) => (
            <div key={label} className="py-2">
              <div className="text-lg font-bold tabular-nums">{value}</div>
              <div className="text-muted-foreground text-[10px] uppercase">{label}</div>
            </div>
          ))}
        </div>
      )}
      {!character.armorProficient && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          {tr("session:sheet.calc.noSpellsInArmor")}
        </p>
      )}

      {!spells && <p className="text-muted-foreground text-xs">{t("loading")}</p>}

      {spells &&
        (cantrips.length > 0 || granted.length > 0 || levels.length > 0 || character.pactMagic) && (
          <div className="bg-card overflow-hidden rounded-xl border [&>div:first-child]:border-t-0">
            {cantrips.length > 0 && (
              <SpellGroup
                title={t("cantrips")}
                aside={<span className="text-muted-foreground text-xs">{t("atWill")}</span>}
                list={cantrips}
                {...group}
              />
            )}
            {granted.length > 0 && <SpellGroup title={t("granted")} list={granted} {...group} />}
            {character.pactMagic && (
              <SpellGroup
                title={t("pact", { level: character.pactMagic.level })}
                aside={slotPips("pact", character.pactMagic.count, t("pactSpent"))}
                list={[]}
                {...group}
              />
            )}
            {levels.map((level) => (
              <SpellGroup
                key={level}
                title={t("level", { level })}
                aside={
                  slotsOf(level) > 0
                    ? slotPips(String(level), slotsOf(level), t("slotsSpent", { level }))
                    : undefined
                }
                list={byLevel.get(level) ?? []}
                {...group}
              />
            ))}
          </div>
        )}

      {speciesCasting && granted.some((s) => speciesGrantedIds.has(s.id)) && (
        <p className="text-muted-foreground text-xs">
          {t("speciesCasting", {
            dc: speciesCasting.saveDc,
            attack: signed(speciesCasting.attackBonus),
          })}
        </p>
      )}
      {[...new Map([...featCasting.values()].map((c) => [c.label, c])).values()].map((c) => (
        <p key={c.label} className="text-muted-foreground text-xs">
          {t("featCasting", {
            label: c.label,
            ability: ABILITY_LABELS[c.ability],
            dc: c.saveDc,
            attack: signed(c.attackBonus),
          })}
        </p>
      ))}

      {spells &&
        cantrips.length === 0 &&
        leveled.length === 0 &&
        granted.length === 0 &&
        invocations.length === 0 && <p className="text-muted-foreground text-xs">{t("none")}</p>}

      <p className="text-muted-foreground text-xs">{t("hint")}</p>

      {invocations.length > 0 && <InvocationGroup entries={invocations} compact />}

      <Dialog open={viewed !== null} onOpenChange={(open) => !open && setViewed(null)}>
        <DialogContent>
          <DialogHeader className="sr-only">
            <DialogTitle>{viewed?.name ?? t("spell")}</DialogTitle>
          </DialogHeader>
          {viewed && (
            <SpellCard
              spell={viewed}
              caster={{
                saveDc: viewedFromFeat
                  ? viewedFromFeat.saveDc
                  : viewedFromSpecies
                    ? speciesCasting!.saveDc
                    : (character.spellSaveDc ?? null),
                attackBonus: viewedFromFeat
                  ? viewedFromFeat.attackBonus
                  : viewedFromSpecies
                    ? speciesCasting!.attackBonus
                    : (character.spellAttackBonus ?? null),
                level: character.level ?? 1,
                proficiencyBonus: character.proficiencyBonus,
                spellcastingAbility: viewedFromFeat
                  ? viewedFromFeat.ability
                  : viewedFromSpecies
                    ? speciesCasting!.ability
                    : character.spellcastingAbility,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
