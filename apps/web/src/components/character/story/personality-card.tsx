import { useState } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import type { CharacterPersonality } from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setCharacterPersonality } from "@/lib/character-story";

const FIELDS = ["traits", "ideals", "bonds", "flaws"] as const;

/** Personality lines, read-only or editable in place by the owner. */
export function PersonalityView({ personality }: { personality?: CharacterPersonality }) {
  const { t } = useTranslation("characters", { keyPrefix: "story.personality" });
  const filled = FIELDS.filter((f) => personality?.[f]?.trim());
  if (filled.length === 0) return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {filled.map((field) => (
        <div key={field}>
          <dt className="text-muted-foreground text-xs font-medium">{t(field)}</dt>
          <dd className="whitespace-pre-wrap">{personality?.[field]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PersonalityCard({
  characterId,
  personality,
  onSaved,
}: {
  characterId: string;
  personality?: CharacterPersonality;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["characters", "common"]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterPersonality>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await setCharacterPersonality(characterId, draft);
      setEditing(false);
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error(t("common:saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleCard
      title={t("story.personality.title")}
      description={t("story.personality.intro")}
      storageKey="char-personality"
    >
      {editing ? (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field} className="grid gap-1">
                <Label htmlFor={`personality-${field}`} className="text-xs">
                  {t(`story.personality.${field}`)}
                </Label>
                <Textarea
                  id={`personality-${field}`}
                  rows={2}
                  maxLength={1000}
                  placeholder={t(`story.personality.${field}Placeholder`)}
                  value={draft[field] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={busy}>
              {t("common:actions.save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PersonalityView personality={personality} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t("story.personality.edit")}
            onClick={() => {
              setDraft({ ...personality });
              setEditing(true);
            }}
          >
            <PencilIcon className="size-4" />
          </Button>
        </div>
      )}
    </CollapsibleCard>
  );
}
