import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PencilIcon } from "lucide-react";
import type { Skill } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AbilityBlock,
  AbilityTile,
  SheetCard,
  SkillRow,
  VitalTile,
  type SheetAbility,
  type SheetVariant,
  type SheetVital,
} from "@/systems/dnd2024/sheet/sheet-parts";
import {
  isTodo,
  type EditBlock,
  type SheetEditing,
  type SheetOrigin,
} from "@/components/character/character-sheet/types";
import { useSwipe } from "@/hooks/use-swipe";
import { compareText } from "@/lib/sort";
import { cn } from "@/lib/utils";

export interface SheetSection {
  id: string;
  label: string;
  /** Shown as a small counter on the tab (number of spells…). */
  count?: number;
  /** Only on a phone (the bag), or only on a computer. */
  only?: SheetVariant;
  render: (variant: SheetVariant) => ReactNode;
}

/** Everything both layouts show, computed once by the system's sheet. */
export interface SheetModel {
  name: string;
  icon: (size: number) => ReactNode;
  /** Species · class · level · background · alignment. */
  subtitle: string;
  /** Size, senses, extra movement, resistances. */
  traits: string[];
  editHref?: string;
  progression: ReactNode;
  vitals: SheetVital[];
  abilities: SheetAbility[];
  /** The tabs of « Jeu »: combat, spells, features, equipment… */
  sections: SheetSection[];
  /** « Histoire »: the backstory, its chapters and the journal. */
  story: ReactNode;
  onViewSkill: (skill: Skill) => void;
  /** Owner-only pencils and actions (or the review's buttons); absent on a read-only sheet. */
  editing?: SheetEditing;
}

function EditButton({ href, iconOnly = false }: { href: string; iconOnly?: boolean }) {
  const { t } = useTranslation("sheet", { keyPrefix: "layout" });
  return (
    <Button asChild variant="outline" size={iconOnly ? "icon" : "sm"}>
      <Link to={href} aria-label={iconOnly ? t("edit") : undefined}>
        <PencilIcon /> {!iconOnly && t("edit")}
      </Link>
    </Button>
  );
}

/**
 * The pencil on a block — « Modifié » once it holds unsaved changes. At the
 * review of the creation, a « Modifier » button back to the wizard's step.
 * With `origin`, the block of a feature's origin: its own step at the review,
 * the « options » panel in the editor (species and background have none there:
 * they change through the bigger « rebuild »).
 */
export function EditPen({
  editing,
  block,
  origin,
  labelled = false,
}: {
  editing?: SheetEditing;
  block: EditBlock;
  origin?: SheetOrigin;
  /** Says what it edits next to the pencil — where two pencils sit side by side. */
  labelled?: boolean;
}) {
  const { t } = useTranslation("sheet", { keyPrefix: "layout" });
  if (!editing || (!editing.review && editing.menuBlocks?.has(block))) return null;
  let open = () => editing.onEdit(block);
  if (origin && editing.onEditOrigin) {
    const onEditOrigin = editing.onEditOrigin;
    open = () => onEditOrigin(origin);
  } else if (origin === "species" || origin === "background") {
    return null;
  }
  const label = t("editBlock", { block: t(`blocks.${origin ?? block}`) });
  if (editing.review) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-primary h-7 px-2 text-xs normal-case tracking-normal"
        onClick={open}
        aria-label={label}
      >
        <PencilIcon className="size-3.5" />
        {t("edit")}
      </Button>
    );
  }
  const modified = editing.modified.has(block);
  return (
    <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
      {modified && (
        <span className="rounded-full bg-amber-500/15 px-2 py-px text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          {t("modified")}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size={labelled ? "sm" : "icon"}
        className={cn("text-muted-foreground", labelled ? "h-7 px-2 text-xs" : "size-7")}
        onClick={open}
        aria-label={label}
      >
        <PencilIcon className="size-3.5" />
        {labelled && t(`blocks.${origin ?? block}`)}
      </Button>
    </span>
  );
}

/** A ring around a block that holds unsaved changes. */
function modifiedRing(editing: SheetEditing | undefined, block: EditBlock) {
  return editing?.modified.has(block) ? "ring-2 ring-amber-500/60" : undefined;
}

function TraitList({ traits }: { traits: string[] }) {
  if (traits.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {traits.map((trait) => (
        <li key={trait}>
          <Badge variant="outline" className="rounded-full font-normal">
            {trait}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/** Portrait, name, identity line, traits, progression, then the key numbers. */
function SheetHeader({ model, variant }: { model: SheetModel; variant: SheetVariant }) {
  const wide = variant === "wide";
  // The identity's pencil sits by the name; the menu (level-up, origins) stays apart.
  const actions = model.editing ? (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {model.editing.actions}
    </div>
  ) : (
    model.editHref && <EditButton href={model.editHref} iconOnly={!wide} />
  );
  return (
    <div className="grid gap-3">
      <Card className="gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {model.icon(wide ? 72 : 52)}
          <div className="grid min-w-0 flex-1 gap-1">
            <h2 className="flex flex-wrap items-center gap-x-1 text-xl font-bold tracking-tight text-balance sm:text-2xl">
              {model.name}
              <EditPen editing={model.editing} block="identity" />
            </h2>
            <p className="text-muted-foreground text-sm">{model.subtitle}</p>
          </div>
          {wide && actions}
        </div>
        <TraitList traits={model.traits} />
        {model.progression}
        {/* On a phone, the pencil and the menu get their own line: the name keeps its room. */}
        {!wide && actions && <div className="flex justify-end">{actions}</div>}
      </Card>
      <dl className={cn("grid grid-cols-4 gap-2", wide && "@5xl:grid-cols-7")}>
        {model.vitals.map((vital) => (
          <VitalTile key={vital.label} vital={vital} />
        ))}
      </dl>
    </div>
  );
}

/** « Jeu » for the table, « Histoire » for the story: two spaces, the switch full width. */
function PlayOrStory({ model, play }: { model: SheetModel; play: ReactNode }) {
  const { t } = useTranslation("sheet", { keyPrefix: "layout" });
  return (
    <Tabs defaultValue="play" className="gap-4">
      <TabsList className="h-10 w-full">
        <TabsTrigger value="play">{t("play")}</TabsTrigger>
        <TabsTrigger value="story">{t("story")}</TabsTrigger>
      </TabsList>
      <TabsContent value="play">{play}</TabsContent>
      <TabsContent value="story" className="grid gap-3">
        {model.story}
      </TabsContent>
    </Tabs>
  );
}

/** A section's tab: its label, and its counter. */
function SectionTrigger({ section }: { section: Pick<SheetSection, "id" | "label" | "count"> }) {
  return (
    <TabsTrigger value={section.id} data-section={section.id}>
      {section.label}
      {section.count != null && (
        <span className="bg-muted rounded-full px-1.5 py-px text-[11px] tabular-nums">
          {section.count}
        </span>
      )}
    </TabsTrigger>
  );
}

/** Computer: abilities and skills on the left, the sections in tabs on the right. */
export function WideSheet({ model }: { model: SheetModel }) {
  const { t } = useTranslation("sheet", { keyPrefix: "layout" });
  const sections = model.sections.filter((section) => section.only !== "narrow");

  const play = (
    <div className="grid items-start gap-4 @5xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="grid gap-2">
        <div className="text-muted-foreground flex min-h-7 flex-wrap items-center gap-x-1 text-xs">
          <span className="flex-1">{t("abilitiesAndSkills")}</span>
          <EditPen editing={model.editing} block="abilities" labelled />
          <EditPen editing={model.editing} block="skills" labelled />
        </div>
        <div
          className={cn(
            "grid grid-cols-2 gap-2.5 rounded-xl",
            modifiedRing(model.editing, "abilities") ?? modifiedRing(model.editing, "skills"),
            (isTodo(model.editing, "abilities") || isTodo(model.editing, "skills")) &&
              "outline-2 outline-offset-2 outline-amber-500 outline-dashed",
          )}
        >
          {model.abilities.map((ability) => (
            <AbilityBlock key={ability.ability} ability={ability} onViewSkill={model.onViewSkill} />
          ))}
        </div>
      </div>

      <Tabs defaultValue={sections[0]?.id} className="min-w-0 gap-3">
        <TabsList variant="line" className="overflow-x-auto [scrollbar-width:none]">
          {sections.map((section) => (
            <SectionTrigger key={section.id} section={section} />
          ))}
        </TabsList>
        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            {section.render("wide")}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <SheetHeader model={model} variant="wide" />
      <PlayOrStory model={model} play={play} />
    </div>
  );
}

/** Phone, abilities' tab: the six tiles, then the skills (trained only, or all). */
function AbilitiesPanel({ model }: { model: SheetModel }) {
  const { t } = useTranslation("sheet", { keyPrefix: "layout" });
  const [onlyTrained, setOnlyTrained] = useState(true);
  const skills = model.abilities
    .flatMap((ability) => ability.skills)
    .sort((a, b) => compareText(a.label, b.label));
  const trained = skills.filter((skill) => skill.rank > 0);
  const shownSkills = onlyTrained && trained.length > 0 ? trained : skills;

  return (
    <div className="grid gap-3">
      <SheetCard
        title={t("abilities")}
        action={<EditPen editing={model.editing} block="abilities" />}
        todo={isTodo(model.editing, "abilities")}
      >
        <div className="grid grid-cols-3 gap-2">
          {model.abilities.map((ability) => (
            <AbilityTile key={ability.ability} ability={ability} />
          ))}
        </div>
      </SheetCard>
      <SheetCard
        title={
          <>
            {t("skills")}
            {trained.length > 0 && (
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value={onlyTrained ? "trained" : "all"}
                onValueChange={(value) => value && setOnlyTrained(value === "trained")}
                aria-label={t("shownSkills")}
                className="normal-case tracking-normal"
              >
                <ToggleGroupItem value="trained" className="h-6 px-2 text-xs">
                  {t("trained")}
                </ToggleGroupItem>
                <ToggleGroupItem value="all" className="h-6 px-2 text-xs">
                  {t("all")}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </>
        }
        action={<EditPen editing={model.editing} block="skills" />}
        todo={isTodo(model.editing, "skills")}
      >
        <ul className="divide-y">
          {shownSkills.map((skill) => (
            <li key={skill.skill}>
              <SkillRow skill={skill} variant="narrow" onView={model.onViewSkill} />
            </li>
          ))}
        </ul>
      </SheetCard>
    </div>
  );
}

/**
 * Phone: the header, then one tab at a time — the abilities first, the bag on
 * its own. The bar scrolls sideways, fading on the side where tabs hide; a
 * sideways swipe on the content moves to the next tab.
 */
export function NarrowSheet({ model }: { model: SheetModel }) {
  const { t } = useTranslation("sheet", { keyPrefix: "layout" });
  const barRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });

  const panels: { id: string; label: string; count?: number; content: ReactNode }[] = [
    { id: "abilities", label: t("abilities"), content: <AbilitiesPanel model={model} /> },
    ...model.sections
      .filter((section) => section.only !== "wide")
      .map((section) => ({
        id: section.id,
        label: section.label,
        count: section.count,
        content: section.render("narrow"),
      })),
  ];
  // Combat is where a sheet opens; the abilities are one tap to its left.
  const [active, setActive] = useState(panels[1]?.id ?? panels[0].id);
  const index = Math.max(
    0,
    panels.findIndex((panel) => panel.id === active),
  );

  const swipe = useSwipe(
    (step) => {
      const target = panels[index + step];
      if (target) setActive(target.id);
    },
    { touchOnly: true },
  );

  // The selected tab stays in view; a fade marks the side where tabs hide.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const update = () =>
      setFade({
        left: bar.scrollLeft > 2,
        right: bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2,
      });
    const tab = bar.querySelector<HTMLElement>(`[data-section="${active}"]`);
    tab?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    update();
    bar.addEventListener("scroll", update, { passive: true });
    return () => bar.removeEventListener("scroll", update);
  }, [active]);

  const play = (
    <Tabs value={active} onValueChange={setActive} className="gap-3">
      <TabsList
        ref={barRef}
        variant="line"
        className={cn(
          "overflow-x-auto [scrollbar-width:none]",
          fade.right &&
            !fade.left &&
            "[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)]",
          fade.left &&
            !fade.right &&
            "[mask-image:linear-gradient(to_left,#000_calc(100%-2.5rem),transparent)]",
          fade.left &&
            fade.right &&
            "[mask-image:linear-gradient(to_right,transparent,#000_2.5rem,#000_calc(100%-2.5rem),transparent)]",
        )}
        aria-label={t("sections")}
      >
        {panels.map((panel) => (
          <SectionTrigger key={panel.id} section={panel} />
        ))}
      </TabsList>
      {panels.map((panel) => (
        <TabsContent key={panel.id} value={panel.id} className="touch-pan-y" {...swipe}>
          {panel.content}
        </TabsContent>
      ))}
    </Tabs>
  );

  return (
    <div className="flex flex-col gap-4">
      <SheetHeader model={model} variant="narrow" />
      <PlayOrStory model={model} play={play} />
    </div>
  );
}
