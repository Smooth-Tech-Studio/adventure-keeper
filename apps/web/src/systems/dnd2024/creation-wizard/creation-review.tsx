import { ArrowRightIcon, CheckIcon, TriangleAlertIcon } from "lucide-react";
import type { Dnd2024Character } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dnd2024CharacterSheet } from "@/systems/dnd2024/sheet/dnd2024-sheet";
import type {
  EditBlock,
  SheetEditing,
  SheetOrigin,
} from "@/components/character/character-sheet/types";
import type { WithId } from "@/lib/collections";

export interface ReviewTodo {
  stepIndex: number;
  key: string;
  label: string;
}

/**
 * The last screen of the creation: the sheet itself, as it will be saved, under
 * a banner that says what is left to do. Each block has a « Modifier » back to
 * its step of the wizard; the blocks still to complete are outlined.
 */
export function CreationReview({
  preview,
  todo,
  todoBlocks,
  onEditTodo,
  onEditBlock,
}: {
  /** The sheet as it would be saved; `null` until the six scores are known. */
  preview: WithId<Dnd2024Character> | null;
  todo: ReviewTodo[];
  /** The blocks the `todo` entries fall in. */
  todoBlocks: ReadonlySet<EditBlock | SheetOrigin>;
  onEditTodo: (entry: ReviewTodo) => void;
  onEditBlock: (block: EditBlock | SheetOrigin) => void;
}) {
  const { t } = useTranslation("wizard", { keyPrefix: "review" });
  const editing: SheetEditing = {
    onEdit: onEditBlock,
    onEditOrigin: onEditBlock,
    modified: new Set(),
    actions: null,
    review: true,
    todo: todoBlocks,
  };

  return (
    <div className="flex flex-col gap-4">
      {todo.length > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-3"
        >
          <TriangleAlertIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{t("almost")}</span>
            <span className="text-muted-foreground"> · {t("todo", { count: todo.length })}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {todo.slice(0, 3).map((entry) => (
              <Button
                key={`${entry.stepIndex}:${entry.key}`}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEditTodo(entry)}
              >
                {entry.label} <ArrowRightIcon />
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-600/50 bg-emerald-600/10 px-4 py-3"
        >
          <CheckIcon className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <p className="text-sm">
            <span className="font-semibold">{t("ready")}</span>
            <span className="text-muted-foreground"> · {t("readyHint")}</span>
          </p>
        </div>
      )}

      {preview ? (
        <Dnd2024CharacterSheet character={preview} editing={editing} />
      ) : (
        <p className="text-muted-foreground text-sm">{t("noPreview")}</p>
      )}
    </div>
  );
}
