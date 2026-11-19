import { useMemo, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  TOOL_CATEGORY_DESCRIPTIONS,
  TOOL_CATEGORY_LABELS,
  backgroundFixedToolId,
  getBackground,
  getClass,
  toolMatchesChoiceGroup,
  type ToolChoiceGroup,
  toolExpertiseCount,
} from "@adventure-keeper/system-dnd2024";
import { Trans, useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToolCatalog } from "@/systems/dnd2024/lib/equipment";
import { sortedByLabel } from "@/lib/sort";

interface Props {
  classId: string;
  backgroundId: string;
  /** Player-chosen tool proficiencies (catalogue ids). */
  value: string[];
  onChange: (value: string[]) => void;
  /** Tools with expertise (catalogue ids). */
  expertise: string[];
  onExpertiseChange: (value: string[]) => void;
}

/**
 * Tool proficiencies shown "comme les langues" : granted ones (class /
 * background) as read-only rows with a source badge, player-picked ones with a
 * delete button, and a grouped picker to add the remaining choices. An
 * Expertise toggle appears on each row only for classes that grant tool
 * expertise (Rogue) — see `toolExpertiseSlots`.
 */
export function ToolProficiencyList({
  classId,
  backgroundId,
  value,
  onChange,
  expertise,
  onExpertiseChange,
}: Props) {
  const { t } = useTranslation("characters", { keyPrefix: "toolProficiencies" });
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  // Loaded up front: the rows below need tool names, not just the picker.
  const catalog = useToolCatalog();

  const expertiseSlots = toolExpertiseCount(classId);

  const klass = classId ? getClass(classId) : undefined;
  const background = backgroundId ? getBackground(backgroundId) : undefined;

  const granted = useMemo(() => {
    const rows: { id: string; source: string }[] = [];
    const seen = new Set<string>();
    const push = (id: string, source: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      rows.push({ id, source });
    };
    for (const id of klass?.toolProficiencies ?? []) push(id, t("class"));
    const fixed = background ? backgroundFixedToolId(background) : undefined;
    if (fixed) push(fixed, t("background"));
    return rows;
  }, [klass, background, t]);
  const grantedIds = useMemo(() => new Set(granted.map((g) => g.id)), [granted]);

  const choiceGroups = useMemo<ToolChoiceGroup[]>(() => {
    const groups: ToolChoiceGroup[] = [];
    if (klass?.toolChoice) {
      for (let i = 0; i < klass.toolChoice.count; i += 1) groups.push(klass.toolChoice.from);
    }
    const backgroundTool = background?.toolProficiency;
    if (backgroundTool && "choice" in backgroundTool) {
      groups.push(backgroundTool.choice);
    } else if (background && !backgroundTool) {
      // A custom background grants no tool: any of them is fair game.
      groups.push("any");
    }
    return groups;
  }, [klass, background]);
  const requiredChoices = choiceGroups.length;

  const chosen = value.filter((id) => !grantedIds.has(id));
  const proficientIds = [...grantedIds, ...chosen];

  const nameFor = (id: string) => catalog?.find((tool) => tool.id === id)?.name ?? id;
  const grantedSorted = sortedByLabel(granted, (entry) => nameFor(entry.id));
  const chosenSorted = sortedByLabel(chosen, nameFor);

  const available = useMemo(() => {
    if (!catalog) return [];
    const known = new Set([...grantedIds, ...value]);
    const query = search.trim().toLowerCase();
    return sortedByLabel(
      catalog.filter(
        (tool) =>
          !known.has(tool.id) &&
          choiceGroups.some((group) => toolMatchesChoiceGroup(tool.category, group)) &&
          (query === "" || tool.name.toLowerCase().includes(query)),
      ),
      (tool) => tool.name,
    );
  }, [catalog, grantedIds, value, choiceGroups, search]);

  const groupedAvailable = useMemo(() => {
    const byCategory = new Map<string, typeof available>();
    for (const tool of available) {
      const key = TOOL_CATEGORY_LABELS[tool.category];
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(tool);
    }
    return [...byCategory.entries()];
  }, [available]);

  function add(id: string) {
    onChange([...value.filter((existing) => existing !== id), id]);
    setPicking(false);
    setSearch("");
  }

  function removeChosen(id: string) {
    onChange(value.filter((existing) => existing !== id));
    onExpertiseChange(expertise.filter((existing) => existing !== id));
  }

  function toggleExpertise(id: string) {
    if (expertise.includes(id)) {
      onExpertiseChange(expertise.filter((existing) => existing !== id));
    } else if (expertise.length < expertiseSlots) {
      onExpertiseChange([...expertise, id]);
    }
  }

  function ExpertiseToggle({ id }: { id: string }) {
    if (expertiseSlots === 0) return null;
    const on = expertise.includes(id);
    return (
      <label className="flex shrink-0 items-center gap-1.5 text-xs">
        <Checkbox
          checked={on}
          disabled={!on && expertise.length >= expertiseSlots}
          onCheckedChange={() => toggleExpertise(id)}
          aria-label={t("expertise")}
        />
        {t("expertiseTag")}
      </label>
    );
  }

  /** What the tool is actually for — the catalogue has carried it all along. */
  function ToolHint({ id }: { id: string }) {
    const tool = catalog?.find((entry) => entry.id === id);
    const description =
      tool?.description ?? (tool ? TOOL_CATEGORY_DESCRIPTIONS[tool.category] : "");
    if (!description) return null;
    return <span className="text-muted-foreground block text-xs leading-snug">{description}</span>;
  }

  return (
    <div className="grid gap-2">
      <div>
        <Label>{t("title")}</Label>
        <p className="text-muted-foreground text-xs">
          <Trans t={t} i18nKey="intro" components={{ strong: <strong /> }} />
        </p>
        <p className="text-muted-foreground text-xs">
          {t("granted")}
          {requiredChoices > 0 ? t("count", { picked: chosen.length, count: requiredChoices }) : ""}
          .
          {expertiseSlots > 0 &&
            t("expertiseLine", { picked: expertise.length, count: expertiseSlots })}
        </p>
      </div>

      {proficientIds.length === 0 && <p className="text-muted-foreground text-sm">{t("none")}</p>}

      <ul className="flex flex-col gap-2">
        {grantedSorted.map((entry) => (
          <li
            key={`${entry.id}-${entry.source}`}
            className="bg-muted/30 flex items-center gap-2 rounded-md border p-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{nameFor(entry.id)}</span>
              <ToolHint id={entry.id} />
            </span>
            <ExpertiseToggle id={entry.id} />
            <Badge variant="secondary">{entry.source}</Badge>
          </li>
        ))}
        {chosenSorted.map((id) => (
          <li key={id} className="bg-muted/30 flex items-center gap-2 rounded-md border p-2">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{nameFor(id)}</span>
              <ToolHint id={id} />
            </span>
            <ExpertiseToggle id={id} />
            <Badge variant="outline">{t("chosen")}</Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8 shrink-0"
              aria-label={t("remove")}
              onClick={() => removeChosen(id)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      {requiredChoices > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={chosen.length >= requiredChoices}
          onClick={() => setPicking(true)}
        >
          <PlusIcon /> {t("add")}
        </Button>
      )}

      <Dialog
        open={picking}
        onOpenChange={(next) => {
          setPicking(next);
          if (!next) setSearch("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addTitle")}</DialogTitle>
          </DialogHeader>

          <Input
            autoFocus
            placeholder={t("search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="max-h-80 overflow-y-auto">
            {!catalog && (
              <p className="text-muted-foreground py-6 text-center text-sm">{t("loading")}</p>
            )}
            {catalog && groupedAvailable.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">{t("noneAvailable")}</p>
            )}
            {groupedAvailable.map(([category, tools]) => (
              <div key={category} className="mb-2">
                <p className="text-muted-foreground px-1 py-1 text-xs font-medium">{category}</p>
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className="hover:bg-accent flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => add(tool.id)}
                  >
                    {/* The name alone says nothing: « Matériel de contrefaçon »
                        is only obvious once you read what it does. */}
                    <span className="min-w-0">
                      <span className="block">{tool.name}</span>
                      <span className="text-muted-foreground block text-xs leading-snug">
                        {tool.description ?? TOOL_CATEGORY_DESCRIPTIONS[tool.category]}
                      </span>
                    </span>
                    <PlusIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
