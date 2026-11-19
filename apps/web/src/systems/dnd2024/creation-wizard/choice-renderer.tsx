import { useMemo, useState } from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import {
  choicePoolValues,
  equipmentOwnerOf,
  parseProficiencyValue,
  type AbilityScoreBlock,
  type ChoiceContext,
  type ChoiceDef,
  type ChoicePick,
} from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AbilityIncrease,
  KitVersus,
  SizePicker,
  SkillRows,
  SpellAbilityPicker,
  SpellHand,
} from "@/systems/dnd2024/creation-wizard/visual-choices";
import {
  choiceValueLabel,
  choiceValueSummary,
  type ChoiceCatalogs,
} from "@/systems/dnd2024/lib/choices";
import { cn } from "@/lib/utils";
import { currentLanguage } from "@/i18n";

/**
 * One `ChoiceDef`, rendered. This is the component the generic choice model buys
 * us: class skills, a background's tool group, Doué's three mixed proficiencies,
 * a subclass, a fighting style and an equipment package all come through here.
 *
 * Two presentations, picked from the shape of the choice rather than from its
 * kind: a single pick out of a short list shows as cards (lineage, equipment
 * package, size), anything else as a grid of cards to tick, searchable.
 */
interface Props {
  def: ChoiceDef;
  values: string[];
  onChange: (values: string[]) => void;
  catalogs: ChoiceCatalogs;
  context: ChoiceContext;
  /** Shown in red under the field once the step has been submitted. */
  error?: string;
  /** Final scores, when known — the skill rows show the resulting bonus. */
  scores?: AbilityScoreBlock | null;
  proficiencyBonus?: number;
  /** The character's class, for choices that read better against it. */
  classId?: string;
  /** Every pick so far, for renderings that refer to another choice. */
  picks?: readonly ChoicePick[];
}

/** Above this, a single pick is a picker rather than a row of cards. */
const CARD_LIMIT = 12;

export function ChoiceRenderer({
  def,
  values,
  onChange,
  catalogs,
  context,
  error,
  scores,
  proficiencyBonus = 2,
  classId,
  picks,
}: Props) {
  const pool = useMemo(() => choicePoolValues(def, context), [def, context]);
  const asCards = def.count === 1 && pool.length > 0 && pool.length <= CARD_LIMIT;
  const owner = equipmentOwnerOf(def.id);
  const visual = { def, pool, values, onChange, catalogs };

  // Some choices read better as objects than as a list.
  let picker;
  if (owner) {
    picker = (
      <KitVersus
        {...visual}
        owner={owner}
        picks={picks}
        dexModifier={scores ? Math.floor((scores.dex - 10) / 2) : null}
      />
    );
  } else if (def.kind === "spell" && pool.length > 0) {
    picker = <SpellHand {...visual} />;
  } else if (def.kind === "ability" && def.allowRepeat) {
    picker = <AbilityIncrease {...visual} scores={scores} />;
  } else if (def.kind === "skill" && pool.length > 1 && pool.length <= 18) {
    picker = <SkillRows {...visual} scores={scores} proficiencyBonus={proficiencyBonus} />;
  } else if (def.kind === "ability" && /incantation/i.test(def.label)) {
    picker = <SpellAbilityPicker {...visual} scores={scores} classId={classId} />;
  } else if (def.id.endsWith(":size")) {
    picker = <SizePicker {...visual} labelOf={(value) => choiceValueLabel(def, value, catalogs)} />;
  } else if (asCards) {
    picker = (
      <CardPicker def={def} pool={pool} values={values} onChange={onChange} catalogs={catalogs} />
    );
  } else {
    picker = (
      <ChecklistPicker
        def={def}
        pool={pool}
        values={values}
        onChange={onChange}
        catalogs={catalogs}
      />
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{def.label}</span>
        <Badge variant={values.length === def.count ? "secondary" : "outline"}>
          {values.length} / {def.count}
        </Badge>
      </div>
      {def.hint && <p className="text-muted-foreground text-xs">{def.hint}</p>}

      {picker}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

interface PickerProps {
  def: ChoiceDef;
  pool: string[];
  values: string[];
  onChange: (values: string[]) => void;
  catalogs: ChoiceCatalogs;
}

function CardPicker({ def, pool, values, onChange, catalogs }: PickerProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
      {pool.map((value) => {
        const selected = values.includes(value);
        const summary = choiceValueSummary(def, value, catalogs);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(selected ? [] : [value])}
            aria-pressed={selected}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-sm transition-colors",
              selected
                ? "border-primary bg-primary/10"
                : "border-input hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <span className="font-medium">{choiceValueLabel(def, value, catalogs)}</span>
            {summary && <span className="text-muted-foreground mt-1 block text-xs">{summary}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Families a long list is cut into: skills first, then tools by kind. */
const GROUP_ORDER = ["skills", "artisan", "instrument", "gaming", "otherTools"] as const;
type Group = (typeof GROUP_ORDER)[number] | "";

function groupOf(def: ChoiceDef, value: string, catalogs: ChoiceCatalogs): Group {
  let toolId: string | undefined;
  if (def.kind === "proficiency") {
    const parsed = parseProficiencyValue(value);
    if (parsed?.kind === "skill") return "skills";
    toolId = parsed?.id;
  } else if (def.kind === "tool") {
    toolId = value;
  } else {
    return "";
  }
  const category = catalogs.tools?.find((tool) => tool.id === toolId)?.category;
  return category === "artisan" || category === "instrument" || category === "gaming"
    ? category
    : "otherTools";
}

/**
 * Anything else — a long list, or several picks: every value is a card to
 * tick, grouped by family (Doué's skills, then its tools by kind) and filtered
 * by a search once the list is long. A single pick swaps on click; once the
 * count is reached, the cards left unticked rest.
 */
function ChecklistPicker({ def, pool, values, onChange, catalogs }: PickerProps) {
  const { t } = useTranslation("wizard", { keyPrefix: "choice" });
  const [search, setSearch] = useState("");
  const full = values.length >= def.count;

  const rows = useMemo(
    () =>
      pool
        .map((value) => ({
          value,
          label: choiceValueLabel(def, value, catalogs),
          summary: choiceValueSummary(def, value, catalogs),
          group: groupOf(def, value, catalogs),
        }))
        .sort(
          (a, b) =>
            GROUP_ORDER.indexOf(a.group as never) - GROUP_ORDER.indexOf(b.group as never) ||
            a.label.localeCompare(b.label, currentLanguage()),
        ),
    [pool, def, catalogs],
  );
  const query = search.trim().toLowerCase();
  // What is ticked stays in view, whatever the search.
  const shown = rows.filter(
    (row) => query === "" || values.includes(row.value) || row.label.toLowerCase().includes(query),
  );
  const groups = [...new Set(shown.map((row) => row.group))];

  function toggle(value: string) {
    if (values.includes(value)) onChange(values.filter((kept) => kept !== value));
    else if (def.count === 1) onChange([value]);
    else if (!full) onChange([...values, value]);
  }

  return (
    <div className="grid gap-3">
      {pool.length > CARD_LIMIT && (
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            placeholder={t("search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}
      {shown.length === 0 && <p className="text-muted-foreground text-sm">{t("noResult")}</p>}
      {groups.map((group) => (
        <section key={group} className="grid gap-1.5">
          {group && groups.length > 1 && <h4 className="type-label">{t(`groups.${group}`)}</h4>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-1.5">
            {shown
              .filter((row) => row.group === group)
              .map((row) => {
                const selected = values.includes(row.value);
                const resting = !selected && full && def.count > 1;
                return (
                  <button
                    key={row.value}
                    type="button"
                    onClick={() => toggle(row.value)}
                    aria-pressed={selected}
                    disabled={resting}
                    className={cn(
                      "flex gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-accent hover:text-accent-foreground",
                      resting && "opacity-45",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border",
                        selected && "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {selected && <CheckIcon className="size-3" />}
                    </span>
                    <span className="grid gap-0.5">
                      <span className="font-medium">{row.label}</span>
                      {row.summary && (
                        <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                          {row.summary}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
