import type { AdventureParticipant } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Textarea } from "@/components/ui/textarea";
import { useDebouncedNotes } from "@/hooks/use-debounced-notes";
import type { WithId } from "@/lib/collections";

interface Props {
  participant: WithId<AdventureParticipant>;
  onNotesChange: (value: string) => void;
}

export function NotesTab({ participant, onNotesChange }: Props) {
  const { t } = useTranslation("session");
  const [notes, editNotes] = useDebouncedNotes(participant.notes ?? "", onNotesChange);

  return (
    <Textarea
      rows={14}
      value={notes}
      onChange={(e) => editNotes(e.target.value)}
      placeholder={t("standard.notesPlaceholder")}
      className="text-xs"
    />
  );
}
