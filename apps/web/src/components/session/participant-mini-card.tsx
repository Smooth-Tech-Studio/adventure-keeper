import { EyeIcon, HeartIcon, PawPrintIcon, ShieldIcon, StarIcon } from "lucide-react";
import type {
  AdventureParticipant,
  ReadyCharacter,
  SessionCombatant,
} from "@adventure-keeper/schemas";

import { CropIcon } from "@/components/character/crop-icon";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { tr } from "@/i18n";
import type { WithId } from "@/lib/collections";
import { systemOf } from "@/systems";

interface Props {
  participant: WithId<AdventureParticipant>;
  character?: WithId<ReadyCharacter>;
  combatant?: WithId<SessionCombatant>;
  /** GM only — show the character's passive Perception next to the AC. */
  showPassivePerception?: boolean;
  onClick?: () => void;
}

/** Compact card for a player at the session table: name, icon, PV, CA. */
export function ParticipantMiniCard({
  participant,
  character,
  combatant,
  showPassivePerception,
  onClick,
}: Props) {
  const maxHp = combatant?.maxHitPoints ?? character?.maxHitPoints;
  const currentHp =
    combatant?.currentHitPoints ?? participant.currentHitPoints ?? character?.maxHitPoints;
  const stats = character ? systemOf(character).combatStats(character) : undefined;
  const armorClass = combatant?.armorClass ?? stats?.armorClass;
  const passivePerception = stats?.passivePerception;
  const color = character?.color;

  const inner = (
    <>
      <CropIcon
        imageUrl={character?.imageUrl}
        crop={character?.imageCrop}
        color={color}
        fallback={initials(participant.characterName)}
        size={34}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold">
          {participant.characterName}
          {/* Under Wild Shape: the beast it has become. */}
          {participant.wildShape && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-emerald-700 dark:text-emerald-300">
              <PawPrintIcon className="size-3" />
              {participant.wildShape.name}
            </span>
          )}
          {participant.heroicInspiration && (
            <StarIcon
              className="ml-1 inline size-3 fill-amber-400 text-amber-500"
              aria-label={tr("session:inspect.inspiration")}
            />
          )}
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <HeartIcon className="text-destructive size-3" />
            {currentHp ?? "—"}/{maxHp ?? "—"}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <ShieldIcon className="size-3" />
            {armorClass ?? "—"}
          </span>
          {showPassivePerception && passivePerception !== undefined && (
            <span className="inline-flex items-center gap-0.5" title="Perception passive">
              <EyeIcon className="size-3" />
              {passivePerception}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const style = color ? { borderColor: color, backgroundColor: `${color}18` } : undefined;
  const base = "flex items-center gap-2 rounded-lg border p-2";

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(base, "hover:bg-accent/60 w-full transition-colors")}
    >
      {inner}
    </button>
  ) : (
    <div style={style} className={cn(base, "bg-card")}>
      {inner}
    </div>
  );
}
