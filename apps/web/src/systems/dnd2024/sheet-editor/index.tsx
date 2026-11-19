import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BookUserIcon,
  ChevronDownIcon,
  DicesIcon,
  DnaIcon,
  ListChecksIcon,
  PencilIcon,
  SwordsIcon,
} from "lucide-react";
import type { Dnd2024Character } from "@adventure-keeper/schemas";
import { validateChoices } from "@adventure-keeper/system-dnd2024";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dnd2024CharacterSheet } from "@/systems/dnd2024/sheet/dnd2024-sheet";
import type { EditBlock, SheetEditing } from "@/components/character/character-sheet/types";
import {
  characterToState,
  deriveFormState,
  formStateToInput,
  stateChoiceDefs,
  validateForm,
  withChoiceFields,
  withPrunedPicks,
  type FormState,
  type SetForm,
} from "@/systems/dnd2024/character-form/state";
import { spellIssues } from "@/systems/dnd2024/creation-wizard/substeps";
import {
  BLOCK_ERRORS,
  BLOCK_FIELDS,
  blockDefs,
  choiceBlock,
  modifiedBlocks,
  panelHelp,
  panelTitle,
} from "@/systems/dnd2024/sheet-editor/blocks";
import { EditPanelBody } from "@/systems/dnd2024/sheet-editor/panels";
import { useCharacterStory } from "@/components/character/story/use-character-story";
import { useRegisterPacks } from "@/systems/dnd2024/hooks/use-content-packs";
import {
  buildChoiceContext,
  picksForExistingSheet,
  useChoiceCatalogs,
} from "@/systems/dnd2024/lib/choices";
import { updateCharacter, type WithId } from "@/lib/collections";
import { cn } from "@/lib/utils";

interface Props {
  character: WithId<Dnd2024Character>;
  /** Called once a save went through, so the page reloads the sheet. */
  onSaved: () => void;
  onSetExperience?: (xp: number) => void;
}

const loadState = (character: Dnd2024Character): FormState => ({
  ...characterToState(character),
  choices: picksForExistingSheet(character),
});

/** Opened from the « Modifier » menu, not from a pencil on the sheet. */
const MENU_BLOCKS: ReadonlySet<EditBlock> = new Set(["abilities", "skills"]);

/** How wide each menu block's dialog opens, centred on the screen. */
const DIALOG_WIDTH: Partial<Record<EditBlock, string>> = {
  abilities: "sm:max-w-2xl",
  skills: "sm:max-w-4xl",
};

/**
 * The owner's sheet: a pencil on a block opens the matching creation screens
 * in a side panel, the sheet recomputes behind it, and one bar saves every
 * change at once. The « Modifier » menu opens the abilities and the skills in
 * a dialog, and the change of class, species or background in the guided
 * creation, that part alone. A level goes up from the XP bar.
 */
export function SheetEditor({ character, onSaved, onSetExperience }: Props) {
  const { t } = useTranslation("sheet", { keyPrefix: "editor" });
  const navigate = useNavigate();
  const saved = useMemo(() => loadState(character), [character]);
  // The story tabs read and save their own data, from the saved sheet.
  const story = useCharacterStory(character, onSaved);
  const [draft, setDraft] = useState<FormState>(saved);
  const [open, setOpen] = useState<EditBlock | null>(null);
  const [saving, setSaving] = useState(false);

  // A fresh copy from the server (after a save) becomes the new starting point.
  useEffect(() => setDraft(saved), [saved]);

  useRegisterPacks(draft.packContent);

  const defs = useMemo(() => stateChoiceDefs(draft), [draft]);
  const catalogs = useChoiceCatalogs(defs);
  const context = useMemo(() => buildChoiceContext(catalogs), [catalogs]);
  const choiceErrors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const error of validateChoices(defs, draft.choices, draft.level, context)) {
      map[error.choiceId] ??= error.message;
    }
    return map;
  }, [defs, draft.choices, draft.level, context]);

  const modified = useMemo(() => modifiedBlocks(saved, draft), [saved, draft]);
  const derived = useMemo(() => deriveFormState(withChoiceFields(draft)), [draft]);

  // What the sheet shows: the stored character, overlaid with the draft.
  const preview = useMemo<WithId<Dnd2024Character>>(() => {
    if (modified.size === 0) return character;
    try {
      return { ...character, ...formStateToInput(withChoiceFields(draft)) };
    } catch {
      return character;
    }
  }, [character, draft, modified]);

  const set: SetForm = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  function setPick(choiceId: string, values: string[]) {
    setDraft((current) => {
      const others = current.choices.filter((pick) => pick.choiceId !== choiceId);
      return withPrunedPicks({
        ...current,
        choices: values.length > 0 ? [...others, { choiceId, values }] : others,
      });
    });
  }

  /** Puts one block back as it was saved. */
  function revert(block: EditBlock) {
    setDraft((current) => {
      const next = { ...current };
      const blockIds = new Set(
        [...blockDefs(saved, block), ...blockDefs(current, block)].map((def) => def.id),
      );
      next.choices = [
        ...current.choices.filter((pick) => !blockIds.has(pick.choiceId)),
        ...saved.choices.filter((pick) => blockIds.has(pick.choiceId)),
      ];
      for (const key of BLOCK_FIELDS[block]) {
        (next as Record<string, unknown>)[key] = saved[key];
      }
      return withPrunedPicks(next);
    });
  }

  /** The first problem in a changed block, with the block to open for it. */
  function firstIssue(): { block: EditBlock; message: string } | null {
    const errors = validateForm(withChoiceFields(draft));
    for (const block of modified) {
      const key = BLOCK_ERRORS[block].find((field) => errors[field]);
      if (key) return { block, message: errors[key]! };
      const choice = defs.find((def) => choiceBlock(def) === block && choiceErrors[def.id]);
      if (choice) return { block, message: choiceErrors[choice.id] };
      if (block === "spells") {
        const spells = spellIssues(draft);
        if (spells.length) return { block, message: spells[0] };
      }
    }
    return null;
  }

  async function save() {
    const issue = firstIssue();
    if (issue) {
      setOpen(issue.block);
      toast.error(issue.message);
      return;
    }
    setSaving(true);
    try {
      await updateCharacter(character.id, formStateToInput(withChoiceFields(draft)));
      toast.success(t("updated"));
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const rebuildHref = (what: "class" | "species" | "background") =>
    `/characters/${character.id}/rebuild?what=${what}`;

  const item = (icon: React.ReactNode, label: string, onSelect: () => void) => (
    <DropdownMenuItem onSelect={onSelect}>
      {icon}
      {label}
    </DropdownMenuItem>
  );
  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PencilIcon /> {t("edit")} <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {item(<SwordsIcon />, t("menu.class"), () => navigate(rebuildHref("class")))}
        {item(<DnaIcon />, t("menu.species"), () => navigate(rebuildHref("species")))}
        {item(<BookUserIcon />, t("menu.background"), () => navigate(rebuildHref("background")))}
        <DropdownMenuSeparator />
        {item(<DicesIcon />, t("menu.abilities"), () => setOpen("abilities"))}
        {item(<ListChecksIcon />, t("menu.skills"), () => setOpen("skills"))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /** One block's edit panel: its title, the creation screens, and its buttons. */
  const panel = (block: EditBlock) => (
    <>
      <SheetHeader>
        <span className="text-muted-foreground text-[11px] tracking-wider uppercase">
          {t("edit")}
        </span>
        <SheetTitle>{panelTitle(block)}</SheetTitle>
        <SheetDescription className="sr-only">{panelHelp(block)}</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <EditPanelBody
          block={block}
          state={draft}
          set={set}
          setPick={setPick}
          derived={derived}
          catalogs={catalogs}
          context={context}
          choiceErrors={choiceErrors}
        />
        <details className="rounded-xl border text-[13px]">
          <summary className="cursor-pointer px-3 py-2 font-medium">{t("why")}</summary>
          <p className="text-muted-foreground px-3 pb-3">{panelHelp(block)}</p>
        </details>
      </SheetBody>
      <SheetFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={!modified.has(block)}
          onClick={() => revert(block)}
        >
          {t("revertBlock")}
        </Button>
        <Button type="button" onClick={() => setOpen(null)}>
          {t("done")}
        </Button>
      </SheetFooter>
    </>
  );

  const editing: SheetEditing = { onEdit: setOpen, modified, actions, menuBlocks: MENU_BLOCKS };
  const changed = [...modified].map((block) => panelTitle(block));

  return (
    <div className="pb-24">
      <Dnd2024CharacterSheet
        character={preview}
        showEditLink
        editing={editing}
        story={story}
        onSetExperience={onSetExperience}
        onApplyLevel={() => navigate(`/characters/${character.id}/level-up`)}
      />

      {/* The abilities and the skills open centred; every other block, from the side. */}
      <Sheet
        open={open !== null && !DIALOG_WIDTH[open]}
        onOpenChange={(next) => !next && setOpen(null)}
      >
        <SheetContent>{open && !DIALOG_WIDTH[open] && panel(open)}</SheetContent>
      </Sheet>
      <Dialog
        open={open !== null && Boolean(DIALOG_WIDTH[open])}
        onOpenChange={(next) => !next && setOpen(null)}
      >
        <DialogContent
          className={cn(
            "flex max-h-[90svh] max-w-[calc(100%-1rem)] flex-col gap-0 p-0",
            open ? DIALOG_WIDTH[open] : undefined,
          )}
        >
          {open && DIALOG_WIDTH[open] && panel(open)}
        </DialogContent>
      </Dialog>

      {modified.size > 0 && (
        <div
          role="status"
          className="bg-foreground text-background fixed bottom-4 left-1/2 z-40 flex w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl py-2 pr-2 pl-4 shadow-xl"
        >
          <div className="min-w-0 flex-1 text-sm">
            <b className="font-semibold">{t("modified", { count: modified.size })}</b>
            <span className="block truncate text-xs opacity-70">{changed.join(", ")}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="hover:bg-background/10 hover:text-background"
            onClick={() => setDraft(saved)}
            disabled={saving}
          >
            {t("revertAll")}
          </Button>
          <Button type="button" variant="secondary" onClick={save} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
