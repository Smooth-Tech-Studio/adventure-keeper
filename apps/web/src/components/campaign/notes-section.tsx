import { useCallback } from "react";
import { PencilIcon, PinIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { Note, NoteVisibility } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCrudSection } from "@/hooks/use-crud-section";
import { createNote, deleteNote, subscribeNotes, updateNote } from "@/lib/notes";
import { run } from "@/lib/run";
import type { WithId } from "@/lib/collections";

interface Props {
  campaignId: string;
  userId: string;
}

interface Draft {
  title: string;
  body: string;
  visibility: NoteVisibility;
}

// The GM's notebook: every note is GM-only (`visibility` kept for old docs).
const emptyDraft: Draft = { title: "", body: "", visibility: "gm" };

export function NotesSection({ campaignId, userId }: Props) {
  const { t } = useTranslation(["campaigns", "common"]);
  const {
    items: notes,
    editingId,
    creating,
    draft,
    setDraft,
    busy,
    startCreate,
    startEdit,
    cancel,
    submit,
  } = useCrudSection<WithId<Note>, Draft>({
    emptyDraft,
    subscribe: useCallback((onChange) => subscribeNotes(campaignId, onChange), [campaignId]),
    toDraft: (note) => ({
      title: note.title,
      body: note.body ?? "",
      visibility: note.visibility,
    }),
    validate: (d) => (d.title.trim() ? null : t("notes.titleRequired")),
    create: (d) => createNote(campaignId, d, userId),
    update: (id, d) =>
      updateNote(campaignId, id, {
        title: d.title.trim(),
        body: d.body.trim(),
        visibility: d.visibility,
      }),
    saveErrorMessage: t("notes.saveFailed"),
  });

  const form = (
    <div className="grid gap-2 rounded-md border p-3">
      <Input
        placeholder={t("notes.titlePlaceholder")}
        value={draft.title}
        onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
      />
      <Textarea
        rows={4}
        placeholder={t("notes.bodyPlaceholder")}
        value={draft.body}
        onChange={(event) => setDraft((d) => ({ ...d, body: event.target.value }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            {t("common:actions.cancel")}
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={busy}>
            {editingId ? t("common:actions.save") : t("common:actions.create")}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {!creating && !editingId && (
        <Button type="button" size="sm" className="self-end" onClick={startCreate}>
          <PlusIcon /> {t("notes.new")}
        </Button>
      )}
      {creating && form}

      {notes.length === 0 && !creating && (
        <p className="text-muted-foreground text-sm">{t("notes.none")}</p>
      )}

      {notes.map((note) => {
        if (editingId === note.id) return <div key={note.id}>{form}</div>;
        return (
          <div key={note.id} className="grid gap-1 rounded-md border p-3">
            <div className="flex items-center gap-2">
              {note.pinned && <PinIcon className="size-3.5 shrink-0 text-amber-500" />}
              <span className="min-w-0 flex-1 truncate font-medium">{note.title}</span>
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={note.pinned ? t("notes.unpin") : t("notes.pin")}
                  onClick={() =>
                    run(
                      () => updateNote(campaignId, note.id, { pinned: !note.pinned }),
                      t("notes.actionFailed"),
                    )
                  }
                >
                  <PinIcon
                    className={note.pinned ? "size-4 text-amber-500" : "size-4 opacity-60"}
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t("common:actions.edit")}
                  onClick={() => startEdit(note)}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 size-8"
                  aria-label={t("common:actions.delete")}
                  onClick={() =>
                    run(() => deleteNote(campaignId, note.id), t("notes.deleteFailed"))
                  }
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </>
            </div>
            {note.body?.trim() && (
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{note.body}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
