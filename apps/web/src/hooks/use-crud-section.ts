import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import { run } from "@/lib/run";

interface CrudSectionConfig<Item, Draft> {
  /** Blank draft for "create" and after cancel. */
  emptyDraft: Draft;
  /** Live subscription to the list — wrap in `useCallback` so the effect is stable. */
  subscribe: (onChange: (items: Item[]) => void) => () => void;
  /** Pre-fill the draft when editing an existing row. */
  toDraft: (item: Item) => Draft;
  /** Return an error message to block submit, or `null` when the draft is valid. */
  validate?: (draft: Draft) => string | null;
  create: (draft: Draft) => Promise<unknown>;
  update: (id: string, draft: Draft) => Promise<unknown>;
  /** Toast shown when create / update rejects. */
  saveErrorMessage: string;
}

export interface CrudSection<Item, Draft> {
  items: Item[];
  editingId: string | null;
  creating: boolean;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  busy: boolean;
  startCreate: () => void;
  startEdit: (item: Item) => void;
  cancel: () => void;
  submit: () => void;
}

/**
 * The "list + create form + inline edit/delete" state machine shared by the
 * campaign notes and resources sections. Rendering stays in each component —
 * this only owns the list subscription, the draft, and the submit lifecycle.
 */
export function useCrudSection<Item extends { id: string }, Draft>(
  config: CrudSectionConfig<Item, Draft>,
): CrudSection<Item, Draft> {
  const { emptyDraft, subscribe, toDraft, validate, create, update, saveErrorMessage } = config;

  const [items, setItems] = useState<Item[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribe(setItems), [subscribe]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
    setCreating(true);
  }

  function startEdit(item: Item) {
    setCreating(false);
    setEditingId(item.id);
    setDraft(toDraft(item));
  }

  function cancel() {
    setCreating(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  function submit() {
    const error = validate?.(draft) ?? null;
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    void run(async () => {
      if (editingId) await update(editingId, draft);
      else await create(draft);
      cancel();
    }, saveErrorMessage).finally(() => setBusy(false));
  }

  return {
    items,
    editingId,
    creating,
    draft,
    setDraft,
    busy,
    startCreate,
    startEdit,
    cancel,
    submit,
  };
}
