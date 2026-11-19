import { Link } from "react-router-dom";
import { CheckIcon, PlusIcon } from "lucide-react";
import {
  characterSystemSatisfies,
  type Character,
  type CharacterSystem,
} from "@adventure-keeper/schemas";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CropIcon } from "@/components/character/crop-icon";
import { characterSubtitle } from "@/lib/character-subtitle";
import { initials } from "@/lib/format";
import { readyCharacters, type WithId } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { getSystem, soleSystemFor } from "@/systems";

interface CharacterPickerProps {
  /** Every character the player owns, drafts included (they are counted, not offered). */
  characters: WithId<Character>[];
  /** What the campaign accepts. */
  characterSystem: CharacterSystem;
  selectedId?: string;
  onSelect: (characterId: string) => void;
  /** Where "Créer un personnage" sends the player back to once it is saved. */
  returnTo: string;
  disabled?: boolean;
}

/**
 * The player's playable characters for a campaign, as a list of cards to pick
 * from, plus a way to create a new one and come back.
 */
export function CharacterPicker({
  characters,
  characterSystem,
  selectedId,
  onSelect,
  returnTo,
  disabled,
}: CharacterPickerProps) {
  const { t } = useTranslation("campaigns", { keyPrefix: "picker" });
  const ready = readyCharacters(characters);
  const drafts = characters.length - ready.length;
  const eligible = ready.filter((c) => characterSystemSatisfies(c.system, characterSystem));
  const incompatible = ready.length - eligible.length;
  // A campaign that takes one system only skips the choice of a system.
  const only = soleSystemFor(characterSystem);
  const createHref = `/characters/new?${new URLSearchParams({
    returnTo,
    ...(only ? { system: only } : {}),
  })}`;

  return (
    <div className="flex flex-col gap-2">
      {eligible.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {t("noneCompatible", { system: getSystem(characterSystem).label })}
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {eligible.map((character) => {
          const selected = character.id === selectedId;
          return (
            <li key={character.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onSelect(character.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                  "hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-60",
                  selected ? "border-primary bg-primary/5 ring-primary ring-1" : "bg-muted/30",
                )}
              >
                <CropIcon
                  imageUrl={character.imageUrl}
                  crop={character.imageCrop}
                  color={character.color}
                  fallback={initials(character.name || "?")}
                  size={40}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{character.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {characterSubtitle(character)}
                  </span>
                </span>
                {selected && <CheckIcon className="text-primary size-4 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>

      <Button asChild variant="outline" size="sm" className="self-start">
        <Link to={createHref}>
          <PlusIcon /> {t("createNew")}
        </Link>
      </Button>

      {(drafts > 0 || incompatible > 0) && (
        <p className="text-muted-foreground text-xs">
          {[
            drafts > 0 && t("hiddenDrafts", { count: drafts }),
            incompatible > 0 && t("otherSystem", { count: incompatible }),
          ]
            .filter(Boolean)
            .join(" · ")}
          .
        </p>
      )}
    </div>
  );
}
