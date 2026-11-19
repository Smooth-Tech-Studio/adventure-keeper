import { useMemo } from "react";
import {
  grantedSpellsFor,
  heldFeatIds,
  type ChoiceDef,
  type SpellDef,
  hasInvocations,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import type { FormState, SetForm } from "@/systems/dnd2024/character-form/state";
import { meleeWeapons } from "@/systems/dnd2024/character-form/state";
import { Panel } from "@/systems/dnd2024/creation-wizard/fixed-substeps";
import { spellCounts } from "@/systems/dnd2024/creation-wizard/substeps";
import { SpellHand } from "@/systems/dnd2024/creation-wizard/visual-choices";
import { InvocationListEditor } from "@/systems/dnd2024/components/invocation-list-editor";
import type { ChoiceCatalogs } from "@/systems/dnd2024/lib/choices";
import { compareText } from "@/lib/sort";
import {
  filterSpellsForClass,
  findSpell,
  maxSpellLevel,
  useSpells,
} from "@/systems/dnd2024/lib/spells";

/**
 * The class's own spells, dealt as cards into two hands — cantrips, then the
 * spells prepared — the way the guided creation shows a feat's spells. Spells a
 * feature or the species grants sit apart, read-only: they are always prepared
 * and never count against the hands.
 *
 * Shared by the creation, the level-up and the sheet's « Sorts » panel.
 */

/** A hand of `count` cards, built like a feat's spell choice so `SpellHand` renders it. */
function handDef(id: string, label: string, count: number, pool: SpellDef[]): ChoiceDef {
  return {
    id,
    source: "class",
    kind: "spell",
    label,
    count,
    pool: { kind: "list", values: pool.map((spell) => spell.id) },
  };
}

const byLevelThenName = (a: SpellDef, b: SpellDef) =>
  a.level - b.level || compareText(a.name, b.name);

export function ClassSpellsStep({
  state,
  set,
  showErrors = false,
}: {
  state: FormState;
  set: SetForm;
  showErrors?: boolean;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "spells" });
  const dictionary = useSpells();
  const { classId, level } = state;

  const granted = useMemo(
    () =>
      grantedSpellsFor({
        classId,
        level,
        speciesId: state.speciesId || undefined,
        speciesChoice: state.speciesChoice || undefined,
        invocations: state.eldritchInvocations,
        picks: state.choices,
        featIds: heldFeatIds({
          classId: classId || undefined,
          speciesId: state.speciesId || undefined,
          backgroundId: state.backgroundId || undefined,
          level,
          picks: state.choices,
          invocations: state.eldritchInvocations,
        }),
      }),
    [
      classId,
      level,
      state.speciesId,
      state.speciesChoice,
      state.backgroundId,
      state.eldritchInvocations,
      state.choices,
    ],
  );
  const grantedIds = useMemo(() => new Set(granted.map((grant) => grant.spellId)), [granted]);

  const pools = useMemo(() => {
    if (!dictionary || !classId) return null;
    return {
      cantrips: filterSpellsForClass(dictionary, classId, { level: 0 })
        .filter((spell) => !grantedIds.has(spell.id))
        .sort(byLevelThenName),
      spells: filterSpellsForClass(dictionary, classId, { maxLevel: maxSpellLevel(classId, level) })
        .filter((spell) => spell.level >= 1 && !grantedIds.has(spell.id))
        .sort(byLevelThenName),
    };
  }, [dictionary, classId, level, grantedIds]);

  if (!dictionary || !pools) {
    return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  }

  const counts = spellCounts(state);
  const catalogs: ChoiceCatalogs = {
    spells: dictionary,
    tools: null,
    gear: null,
    weapons: null,
    armors: null,
    packs: null,
  };
  // One chip per spell: a spell two sources grant names both (« Druidique · Lignage gnome »).
  const grantedSpells = [...new Set(granted.map((grant) => grant.spellId))]
    .map((spellId) => ({
      sources: granted.filter((grant) => grant.spellId === spellId).map((g) => g.sourceLabel),
      spell: findSpell(dictionary, spellId),
    }))
    .filter((entry): entry is { sources: string[]; spell: SpellDef } => Boolean(entry.spell))
    .sort((a, b) => byLevelThenName(a.spell, b.spell));
  // Granted spells sit in their hand's list, locked; those with no hand on
  // screen (a cantrip for a class without cantrips) keep the panel below.
  const grantedIn = (cantrip: boolean) =>
    grantedSpells
      .filter(({ spell }) => (spell.level === 0) === cantrip)
      .map(({ spell, sources }) => ({
        id: spell.id,
        reason: t("grantedBy", { sources: sources.join(" · ") }),
      }));
  const inHand = new Set([
    ...(counts.cantrips.cap > 0 ? grantedIn(true).map((g) => g.id) : []),
    ...(counts.spells.cap > 0 ? grantedIn(false).map((g) => g.id) : []),
  ]);
  const leftOver = grantedSpells.filter(({ spell }) => !inHand.has(spell.id));
  const knownCantrips = state.cantrips
    .map((id) => findSpell(dictionary, id))
    .filter((spell): spell is SpellDef => Boolean(spell));
  const missing = (picked: number, cap: number) => showErrors && picked !== cap;

  return (
    <div className="flex flex-col gap-5">
      {counts.cantrips.cap > 0 && (
        <Panel
          title={t("cantrips")}
          className={
            missing(counts.cantrips.picked, counts.cantrips.cap) ? "border-destructive" : undefined
          }
        >
          <SpellHand
            def={handDef("class:cantrips", t("cantrips"), counts.cantrips.cap, pools.cantrips)}
            pool={pools.cantrips.map((spell) => spell.id)}
            values={state.cantrips}
            onChange={(ids) => set("cantrips", ids)}
            catalogs={catalogs}
            granted={grantedIn(true)}
          />
        </Panel>
      )}
      {counts.spells.cap > 0 && (
        <Panel
          title={t("preparedUpTo", { level: maxSpellLevel(classId, level) })}
          className={
            missing(counts.spells.picked, counts.spells.cap) ? "border-destructive" : undefined
          }
        >
          <SpellHand
            def={handDef("class:spells", t("prepared"), counts.spells.cap, pools.spells)}
            pool={pools.spells.map((spell) => spell.id)}
            values={state.spells}
            onChange={(ids) => set("spells", ids)}
            catalogs={catalogs}
            granted={grantedIn(false)}
          />
        </Panel>
      )}
      {leftOver.length > 0 && (
        <Panel title={t("always")}>
          <p className="text-muted-foreground text-xs">{t("alwaysHint")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {leftOver.map(({ sources, spell }) => (
              <li key={spell.id} className="bg-muted rounded-full border px-2.5 py-0.5 text-xs">
                <span className="font-medium">{spell.name}</span>
                <span className="text-muted-foreground"> · {sources.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {hasInvocations(classId) && (
        <Panel title={t("invocations")}>
          <InvocationListEditor
            classId={classId}
            level={level}
            value={state.eldritchInvocations}
            onChange={(picks) => set("eldritchInvocations", picks)}
            cantrips={knownCantrips}
            weapons={meleeWeapons(state.weapons).map(({ id, name }) => ({ id, name }))}
            pactWeaponId={state.pactWeaponId}
            onPactWeaponChange={(id) => set("pactWeaponId", id)}
          />
        </Panel>
      )}
    </div>
  );
}
